"""Escrow state machine.

Geçiş tablosu (yetkili rol parantez içinde):

  PENDING_PAYMENT          ──[buyer]──►  FUNDED
  FUNDED                   ──[admin]──►  AWAITING_AUTHENTICATION
  AWAITING_AUTHENTICATION  ──[admin]──►  AUTHENTICATED
  AUTHENTICATED            ──[admin]──►  SHIPPED_TO_BUYER
  SHIPPED_TO_BUYER         ──[admin]──►  DELIVERED
  DELIVERED                ──[admin]──►  RELEASED
  *                        ──[admin]──►  REFUNDED  (terminal)

Yalnızca ileri geçiş — geri dönüş yok. Refund her noktadan yapılabilir
(saat fiziksel olarak gelmediyse, alıcıdan/satıcıdan iletişim kopduysa).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auction import Auction
from app.models.escrow import EscrowStatus, EscrowTransaction, PaymentMethod
from app.models.user import User
from app.models.watch import ListingType, Watch, WatchStatus
from app.schemas.escrow import FundRequest
from app.utils.commission import compute_tiered_commission
from app.utils.exceptions import ConflictError, ForbiddenError, NotFoundError

# Yasal: kredi kartı surcharge'ı yasak. Onun yerine BANK_TRANSFER seçen
# alıcılara %2.5 EFT indirimi uygulanır.
EFT_DISCOUNT_RATE = Decimal("0.025")

# İleri geçiş kuralları — hangi state'ten hangi state'e?
_FORWARD_TRANSITIONS: dict[EscrowStatus, EscrowStatus] = {
    EscrowStatus.FUNDED: EscrowStatus.AWAITING_AUTHENTICATION,
    EscrowStatus.AWAITING_AUTHENTICATION: EscrowStatus.AUTHENTICATED,
    EscrowStatus.AUTHENTICATED: EscrowStatus.SHIPPED_TO_BUYER,
    EscrowStatus.SHIPPED_TO_BUYER: EscrowStatus.DELIVERED,
    EscrowStatus.DELIVERED: EscrowStatus.RELEASED,
}


def _query_with_relations():
    """Ortak SELECT — escrow + auction.watch.images + iki user'ı eager-load."""
    return (
        select(EscrowTransaction)
        .options(
            selectinload(EscrowTransaction.auction)
            .selectinload(Auction.watch)
            .selectinload(Watch.images)
        )
    )


async def _load_with_users(
    db: AsyncSession, escrow_id: uuid.UUID
) -> tuple[EscrowTransaction, User, User]:
    """Escrow + alıcı + satıcı user nesnelerini tek seferde yükle."""
    escrow = (
        await db.execute(_query_with_relations().where(EscrowTransaction.id == escrow_id))
    ).scalar_one_or_none()
    if not escrow:
        raise NotFoundError("Güvenli Kasa kaydı bulunamadı")

    users = (
        await db.execute(
            select(User).where(User.id.in_([escrow.buyer_id, escrow.seller_id]))
        )
    ).scalars().all()
    by_id = {u.id: u for u in users}
    return escrow, by_id[escrow.buyer_id], by_id[escrow.seller_id]


async def list_for_buyer(
    db: AsyncSession, user: User, limit: int = 50, offset: int = 0
) -> list[tuple[EscrowTransaction, User]]:
    """Alıcının siparişleri + karşı taraf (satıcı) bilgisi."""
    result = (
        await db.execute(
            _query_with_relations()
            .where(EscrowTransaction.buyer_id == user.id)
            .order_by(EscrowTransaction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().unique().all()

    seller_ids = {e.seller_id for e in result}
    sellers = (
        await db.execute(select(User).where(User.id.in_(seller_ids)))
    ).scalars().all() if seller_ids else []
    sellers_by_id = {u.id: u for u in sellers}

    return [(e, sellers_by_id[e.seller_id]) for e in result]


async def list_for_seller(
    db: AsyncSession, user: User, limit: int = 50, offset: int = 0
) -> list[tuple[EscrowTransaction, User]]:
    """Satıcının satışları + karşı taraf (alıcı) bilgisi."""
    result = (
        await db.execute(
            _query_with_relations()
            .where(EscrowTransaction.seller_id == user.id)
            .order_by(EscrowTransaction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().unique().all()

    buyer_ids = {e.buyer_id for e in result}
    buyers = (
        await db.execute(select(User).where(User.id.in_(buyer_ids)))
    ).scalars().all() if buyer_ids else []
    buyers_by_id = {u.id: u for u in buyers}

    return [(e, buyers_by_id[e.buyer_id]) for e in result]


async def list_admin_active(
    db: AsyncSession, limit: int = 100, offset: int = 0
) -> list[tuple[EscrowTransaction, User, User]]:
    """Admin: aktif (RELEASED/REFUNDED dışı) tüm escrow'lar."""
    result = (
        await db.execute(
            _query_with_relations()
            .where(
                EscrowTransaction.status.notin_(
                    [EscrowStatus.RELEASED, EscrowStatus.REFUNDED]
                )
            )
            .order_by(EscrowTransaction.created_at.asc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().unique().all()

    user_ids: set[uuid.UUID] = set()
    for e in result:
        user_ids.add(e.buyer_id)
        user_ids.add(e.seller_id)
    users = (
        await db.execute(select(User).where(User.id.in_(user_ids)))
    ).scalars().all() if user_ids else []
    by_id = {u.id: u for u in users}

    return [(e, by_id[e.buyer_id], by_id[e.seller_id]) for e in result]


async def get_for_party(
    db: AsyncSession, escrow_id: uuid.UUID, user: User
) -> tuple[EscrowTransaction, User, User]:
    """Buyer veya seller kendi escrow'unu görsün — başkasınınkini değil."""
    escrow, buyer, seller = await _load_with_users(db, escrow_id)
    if user.id not in (escrow.buyer_id, escrow.seller_id):
        raise ForbiddenError("Bu sipariş size ait değil")
    return escrow, buyer, seller


async def get_admin(
    db: AsyncSession, escrow_id: uuid.UUID
) -> tuple[EscrowTransaction, User, User]:
    """Admin tüm escrow'ları görebilir."""
    return await _load_with_users(db, escrow_id)


# === State transition'ları ===

def compute_discount(amount: Decimal, payment_method: PaymentMethod) -> Decimal:
    """BANK_TRANSFER seçildiyse %2.5 EFT indirimi. Yoksa 0."""
    if payment_method == PaymentMethod.BANK_TRANSFER:
        return (amount * EFT_DISCOUNT_RATE).quantize(Decimal("0.01"))
    return Decimal("0.00")


async def fund(
    db: AsyncSession, escrow_id: uuid.UUID, user: User, payload: FundRequest
) -> EscrowTransaction:
    """Alıcı ödemeyi tamamladı — PENDING_PAYMENT → FUNDED.

    Alıcının 3 seçimi bu noktada bağlanır:
      - delivery_method: SHIPPING / STORE_PICKUP
      - payment_method: CREDIT_CARD / BANK_TRANSFER
      - (otomatik) BANK_TRANSFER → %2.5 EFT indirimi (discount_amount)

    `amount` standart fiyat olarak korunur (scheduler tarafından set edildi).
    `discount_amount` indirim tutarı. Alıcı fiilen `amount - discount_amount`
    öder. Platform komisyonu post-discount tutardan hesaplanır.
    """
    escrow, _, _ = await _load_with_users(db, escrow_id)
    if escrow.buyer_id != user.id:
        raise ForbiddenError("Sadece alıcı ödeme yapabilir")
    if escrow.status != EscrowStatus.PENDING_PAYMENT:
        raise ConflictError(
            f"Ödeme alınamaz — escrow durumu: {escrow.status.value}"
        )

    discount = compute_discount(escrow.amount, payload.payment_method)
    effective_paid = escrow.amount - discount

    # Tiered komisyon — sabit %5 yerine progressive dilimler
    commission, _ = compute_tiered_commission(effective_paid)
    escrow.discount_amount = discount
    escrow.platform_fee = commission
    escrow.payment_method = payload.payment_method
    escrow.delivery_method = payload.delivery_method
    escrow.status = EscrowStatus.FUNDED
    escrow.payment_provider_ref = payload.payment_provider_ref or "deneme"
    escrow.funded_at = datetime.now(timezone.utc)

    # DIRECT_SALE akışı: ödeme alındığı anda saat ACTIVE → AWAITING_EXPERTISE
    # geçişi yapılır (ekspertiz için anlasmali magazaya teslim sırası). AUCTION
    # tarafında saat zaten scheduler/buy_now sırasında SOLD yapılıyor.
    watch = escrow.auction.watch if escrow.auction else None
    if (
        watch is not None
        and watch.listing_type == ListingType.DIRECT_SALE
        and watch.status == WatchStatus.ACTIVE
    ):
        watch.status = WatchStatus.AWAITING_EXPERTISE

    await db.commit()
    await db.refresh(escrow)
    return escrow


async def advance(
    db: AsyncSession,
    escrow_id: uuid.UUID,
    expected_from: EscrowStatus,
) -> EscrowTransaction:
    """Admin: state'i bir sonraki aşamaya itele.

    expected_from: hangi state'ten geliyoruz (idempotency + race kontrol).
    Kontrol başarısızsa ConflictError.
    """
    escrow, _, _ = await _load_with_users(db, escrow_id)
    if escrow.status != expected_from:
        raise ConflictError(
            f"Beklenen durum {expected_from.value} ama mevcut {escrow.status.value}"
        )

    next_status = _FORWARD_TRANSITIONS.get(expected_from)
    if next_status is None:
        raise ConflictError(f"{expected_from.value}'tan ileri geçiş yok")

    escrow.status = next_status
    if next_status == EscrowStatus.RELEASED:
        escrow.released_at = datetime.now(timezone.utc)
        # DIRECT_SALE akışı: para satıcıya serbest bırakıldığında saat artık
        # SOLD. AUCTION akışında watch zaten scheduler/buy_now sırasında SOLD
        # yapılmıştı; ikinci kez set etmek no-op.
        watch = escrow.auction.watch if escrow.auction else None
        if (
            watch is not None
            and watch.listing_type == ListingType.DIRECT_SALE
            and watch.status != WatchStatus.SOLD
        ):
            watch.status = WatchStatus.SOLD

    await db.commit()
    await db.refresh(escrow)
    return escrow


# === Sahtekarlik onleme akisi ===


async def upload_seller_seal_photo(
    db: AsyncSession,
    escrow_id: uuid.UUID,
    user: User,
    photo_url: str,
) -> EscrowTransaction:
    """Satici kargo oncesi muhurlu kutu fotografini yukler.

    Yalniz satici kendi escrow'unun fotografini koyabilir. Tekrar
    yukleme izinli (uzerine yazilir) — sat ici fotografi hatali cekerse
    yeniden gonderebilir.

    Akis: en azindan FUNDED durumunda olmali. PENDING_PAYMENT'ta yukleme
    erken (para yatmadi, kargo riskli), RELEASED/REFUNDED'da gec (akis
    bitmis).
    """
    from datetime import datetime, timezone

    escrow, _, _ = await _load_with_users(db, escrow_id)
    if user.id != escrow.seller_id:
        raise ForbiddenError("Bu siparis size ait degil")
    if escrow.status in (
        EscrowStatus.PENDING_PAYMENT,
        EscrowStatus.RELEASED,
        EscrowStatus.REFUNDED,
    ):
        raise ConflictError(
            "Muhur fotografi su anda yuklenemez (akis durumu uygun degil)"
        )

    escrow.seller_seal_photo_url = photo_url
    escrow.seller_seal_uploaded_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(escrow)
    return escrow


async def upload_buyer_unboxing(
    db: AsyncSession,
    escrow_id: uuid.UUID,
    user: User,
    video_url: str,
    seal_intact: bool,
) -> EscrowTransaction:
    """Alici paket acma videosu + muhur durumu beyan eder.

    seal_intact=False ise escrow DISPUTED durumuna gecer; admin
    panelinden manuel iade akisi baslar. seal_intact=True ise akis
    normal ilerler (alici sonraki adimda teslim aldigini onaylar).

    Yalniz alici kendi escrow'una koyabilir. Tekrar yukleme izinli ama
    bir kez DISPUTED'a gectiyse beyan kilitli (admin mudahale eder).
    """
    from datetime import datetime, timezone

    escrow, _, _ = await _load_with_users(db, escrow_id)
    if user.id != escrow.buyer_id:
        raise ForbiddenError("Bu siparis size ait degil")
    if escrow.status == EscrowStatus.DISPUTED:
        raise ConflictError(
            "Itiraz acilmis siparise yeni beyan eklenemez; admin yardim eder"
        )
    if escrow.status in (
        EscrowStatus.PENDING_PAYMENT,
        EscrowStatus.FUNDED,
        EscrowStatus.REFUNDED,
    ):
        raise ConflictError(
            "Paket acma videosu su anda yuklenemez (akis durumu uygun degil)"
        )

    escrow.buyer_unboxing_video_url = video_url
    escrow.buyer_unboxing_uploaded_at = datetime.now(timezone.utc)
    escrow.seal_intact = seal_intact

    # Muhur kirik beyani: otomatik DISPUTED. Admin sonra iade akisini
    # tetikler veya satici/alici uyusmazliginda hakem olur.
    if not seal_intact:
        escrow.status = EscrowStatus.DISPUTED

    await db.commit()
    await db.refresh(escrow)
    return escrow


async def refund(
    db: AsyncSession, escrow_id: uuid.UUID
) -> EscrowTransaction:
    """Admin: terminal red. Para alıcıya iade edilir (deneme).

    RELEASED haricinde her state'ten yapılabilir. RELEASED ise para zaten
    satıcıya gitmiş — chargeback gerekir, MVP scope dışı.
    """
    escrow, _, _ = await _load_with_users(db, escrow_id)
    if escrow.status == EscrowStatus.RELEASED:
        raise ConflictError("SERBEST BIRAKILMIŞ Güvenli Kasa için iade kart iadesi süreci gerektirir")
    if escrow.status == EscrowStatus.REFUNDED:
        raise ConflictError("Güvenli Kasa zaten iade edildi")

    escrow.status = EscrowStatus.REFUNDED
    await db.commit()
    await db.refresh(escrow)
    return escrow
