import uuid
from datetime import datetime, timezone
from decimal import Decimal

from slugify import slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ai_valuation import AIValuation
from app.models.auction import Auction, AuctionStatus
from app.models.escrow import (
    DeliveryMethod,
    EscrowStatus,
    EscrowTransaction,
    PaymentMethod,
)
from app.models.user import User
from app.models.watch import (
    AIProcessingStatus,
    ListingType,
    Watch,
    WatchImage,
    WatchStatus,
)
from app.schemas.watch import WatchCreate, WatchUpdate
from app.utils.commission import compute_tiered_commission
from app.utils.exceptions import ConflictError, ForbiddenError, NotFoundError


async def _generate_unique_slug(db: AsyncSession, base: str) -> str:
    slug = slugify(base)[:200] or "watch"
    candidate = slug
    suffix = 1
    while True:
        existing = await db.execute(select(Watch.id).where(Watch.slug == candidate))
        if existing.scalar_one_or_none() is None:
            return candidate
        suffix += 1
        candidate = f"{slug}-{suffix}"


def _generate_delivery_code(watch_id: uuid.UUID) -> str:
    """Satıcıya verilen partner-mağaza teslimat kodu.

    Watch UUID'sinin ilk 6 hex karakterinden deterministik üretilir —
    çarpışma yok, kodun saatle 1-1 eşleşmesi garantili.

    Örnek: 'MYR-A4F8B2'
    """
    suffix = watch_id.hex[:6].upper()
    return f"MYR-{suffix}"


async def create_watch(db: AsyncSession, seller: User, payload: WatchCreate) -> Watch:
    slug = await _generate_unique_slug(
        db, f"{payload.brand}-{payload.model}-{payload.reference_number}"
    )
    # DIRECT_SALE: saat satılana kadar ekspertize gitmez → doğrudan ACTIVE
    # AUCTION:     müzayedeye çıkmadan ÖNCE ekspertiz şart → PENDING_PRE_EXPERTISE
    if payload.listing_type == ListingType.DIRECT_SALE:
        initial_status = WatchStatus.ACTIVE
        if payload.asking_price is None or payload.asking_price <= 0:
            raise ConflictError(
                "DIRECT_SALE ilanlarında asking_price zorunludur (> 0)."
            )
    else:
        initial_status = WatchStatus.PENDING_PRE_EXPERTISE

    watch_id = uuid.uuid4()
    watch = Watch(
        id=watch_id,
        seller_id=seller.id,
        brand=payload.brand,
        model=payload.model,
        reference_number=payload.reference_number,
        year=payload.year,
        serial_number=payload.serial_number,
        box_papers=payload.box_papers,
        condition=payload.condition,
        description=payload.description,
        slug=slug,
        delivery_code=_generate_delivery_code(watch_id),
        listing_type=payload.listing_type,
        asking_price=payload.asking_price,
        status=initial_status,
        ai_processing_status=AIProcessingStatus.QUEUED,
    )
    for idx, url in enumerate(payload.image_urls):
        watch.images.append(
            WatchImage(url=str(url), sort_order=idx, is_primary=(idx == 0))
        )
    db.add(watch)
    await db.commit()
    await db.refresh(watch)
    return watch


async def get_watch(db: AsyncSession, watch_id: uuid.UUID) -> Watch:
    watch = (
        await db.execute(select(Watch).where(Watch.id == watch_id))
    ).scalar_one_or_none()
    if not watch:
        raise NotFoundError("Saat bulunamadı")
    return watch


async def get_watch_by_slug(db: AsyncSession, slug: str) -> Watch:
    """Public detay sayfası için slug ile lookup. Images eager-load."""
    watch = (
        await db.execute(
            select(Watch)
            .where(Watch.slug == slug)
            .options(selectinload(Watch.images))
        )
    ).scalar_one_or_none()
    if not watch:
        raise NotFoundError("Saat bulunamadı")
    return watch


_EDITABLE_STATUSES = (
    WatchStatus.DRAFT,
    WatchStatus.PENDING_REVIEW,
    # AUCTION akışı: ön ekspertiz beklerken satıcı yazım hatası /
    # görsel düzenlemesi yapabilir
    WatchStatus.PENDING_PRE_EXPERTISE,
)


async def update_watch(
    db: AsyncSession, watch_id: uuid.UUID, user: User, payload: WatchUpdate
) -> Watch:
    watch = await get_watch(db, watch_id)
    if watch.seller_id != user.id:
        raise ForbiddenError("Bu saati güncelleme yetkiniz yok")
    if watch.status not in _EDITABLE_STATUSES:
        raise ConflictError(
            "Yalnızca taslak, inceleme veya ön ekspertiz aşamasındaki "
            "saatler güncellenebilir"
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(watch, field, value)

    await db.commit()
    await db.refresh(watch)
    return watch


async def buy_direct_sale(
    db: AsyncSession,
    watch_id: uuid.UUID,
    buyer: User,
    delivery_method: DeliveryMethod,
    payment_method: PaymentMethod,
) -> tuple[Watch, EscrowTransaction]:
    """Miyaris Mağaza — DIRECT_SALE saat için tek tık satın alma akışı.

    State geçişleri:
      - Watch: ACTIVE → AWAITING_EXPERTISE (satıştan sonra ekspertize gider)
      - Sentetik Auction: ENDED (escrow.auction_id FK'sini doldurmak için)
      - EscrowTransaction: PENDING_PAYMENT

    Sentetik auction, escrow modelinin auction_id'ye bağlı olması nedeniyle
    yaratılır; başka müzayede semantiği taşımaz (status doğrudan ENDED).
    """
    watch = (
        await db.execute(
            select(Watch).where(Watch.id == watch_id)
        )
    ).scalar_one_or_none()
    if not watch:
        raise NotFoundError("Saat bulunamadı")

    if watch.listing_type != ListingType.DIRECT_SALE:
        raise ConflictError(
            "Bu saat müzayedededir; satın almak için ilana teklif verin."
        )
    if watch.status != WatchStatus.ACTIVE:
        raise ConflictError(
            f"Saat satın alınabilir durumda değil (mevcut durum: {watch.status.value})"
        )
    if watch.asking_price is None or watch.asking_price <= 0:
        raise ConflictError("Saatin asking_price'ı tanımlı değil")
    if watch.seller_id == buyer.id:
        raise ForbiddenError("Kendi saatinizi satın alamazsınız")

    # Çift satın alma koruması: bu saat için aktif (ödeme bekleyen veya
    # ileri seviyede) bir escrow varsa yeni satışa izin verme. RELEASED/
    # REFUNDED bittiği için yeni alımın önünü açar.
    existing_escrow = (
        await db.execute(
            select(EscrowTransaction)
            .join(Auction, EscrowTransaction.auction_id == Auction.id)
            .where(
                Auction.watch_id == watch.id,
                EscrowTransaction.status.notin_(
                    [EscrowStatus.RELEASED, EscrowStatus.REFUNDED]
                ),
            )
        )
    ).scalar_one_or_none()
    if existing_escrow:
        raise ConflictError(
            "Bu saat için henüz tamamlanmamış bir sipariş var. "
            "Stok serbest kalana kadar bekleyin."
        )

    listed_price = watch.asking_price

    # EFT indirimi — BANK_TRANSFER seçildiyse %2.5
    from app.services.escrow_service import EFT_DISCOUNT_RATE
    if payment_method == PaymentMethod.BANK_TRANSFER:
        discount = (listed_price * EFT_DISCOUNT_RATE).quantize(Decimal("0.01"))
    else:
        discount = Decimal("0.00")
    effective_paid = listed_price - discount
    fee, _ = compute_tiered_commission(effective_paid)

    # Sentetik auction — escrow FK gereği. Müzayede semantiği yok.
    now = datetime.now(timezone.utc)
    synthetic_auction = Auction(
        watch_id=watch.id,
        starting_price=listed_price,
        reserve_price=None,
        buy_it_now_price=listed_price,
        min_bid_increment=Decimal("1"),
        current_price=listed_price,
        starts_at=now,
        ends_at=now,
        status=AuctionStatus.ENDED,
    )
    db.add(synthetic_auction)
    await db.flush()  # synthetic_auction.id elde et

    escrow = EscrowTransaction(
        auction_id=synthetic_auction.id,
        buyer_id=buyer.id,
        seller_id=watch.seller_id,
        amount=listed_price,
        discount_amount=discount,
        platform_fee=fee,
        delivery_method=delivery_method,
        payment_method=payment_method,
        status=EscrowStatus.PENDING_PAYMENT,
    )
    db.add(escrow)

    # NOT: watch.status burada DEĞİŞTİRİLMEZ. Alıcı henüz ödeme yapmadı (escrow
    # PENDING_PAYMENT). Saat alıcı fund() ettikten sonra AWAITING_EXPERTISE'e
    # geçer (escrow_service.fund içindeki hook), escrow RELEASED olduğunda da
    # SOLD'a geçer (escrow_service.advance hook). Alıcı ödemezse saat ACTIVE
    # kalır ve başka bir alıcı satın alabilir.

    await db.commit()
    await db.refresh(escrow)
    await db.refresh(watch)
    return watch, escrow


async def list_marketplace_direct_sales(
    db: AsyncSession,
    brand: str | None = None,
    limit: int = 60,
    offset: int = 0,
) -> list[Watch]:
    """Vitrin — ACTIVE durumda DIRECT_SALE saatler (en yeni önce).

    Müzayedeye çıkmayan saatler için 'Hemen Al' grid'i besler. Images eager-load
    çünkü kart render için gerekli.
    """
    stmt = (
        select(Watch)
        .where(
            Watch.status == WatchStatus.ACTIVE,
            Watch.listing_type == ListingType.DIRECT_SALE,
        )
        .options(selectinload(Watch.images))
        .order_by(Watch.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if brand:
        stmt = stmt.where(Watch.brand.ilike(f"%{brand}%"))
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def list_my_watches(
    db: AsyncSession, user: User, limit: int = 50, offset: int = 0
) -> list[Watch]:
    result = await db.execute(
        select(Watch)
        .where(Watch.seller_id == user.id)
        .order_by(Watch.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def get_my_watch_detail(
    db: AsyncSession, watch_id: uuid.UUID, user: User
) -> tuple[Watch, AIValuation | None]:
    """Sahip için saat detayı + en son AI valuation kaydı.

    Yabancılara görünmeyen alanları (ai_processing_error, valuation reasoning)
    `WatchOwnerDetail` schema'sı ile döner.
    """
    watch = (
        await db.execute(
            select(Watch)
            .where(Watch.id == watch_id)
            .options(selectinload(Watch.valuations))
        )
    ).scalar_one_or_none()

    if not watch:
        raise NotFoundError("Saat bulunamadı")
    if watch.seller_id != user.id:
        raise ForbiddenError("Bu saat size ait değil")

    latest = (
        max(watch.valuations, key=lambda v: v.created_at)
        if watch.valuations
        else None
    )
    return watch, latest
