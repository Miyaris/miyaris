import uuid
import zoneinfo
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auction import Auction, AuctionStatus
from app.models.bid import Bid
from app.models.escrow import (
    DeliveryMethod,
    EscrowStatus,
    EscrowTransaction,
    PaymentMethod,
)
from app.models.user import User
from app.models.watch import ListingType, Watch, WatchStatus
from app.schemas.auction import AuctionCreate, AuctionUpdate
from app.utils.commission import compute_tiered_commission
from app.utils.exceptions import ConflictError, ForbiddenError, NotFoundError

# Haftalık müzayede penceresi: Pazartesi 00:00 → Pazar 23:59:59 (Europe/Istanbul)
ISTANBUL_TZ = zoneinfo.ZoneInfo("Europe/Istanbul")


def compute_next_week_window() -> tuple[datetime, datetime]:
    """Bir sonraki haftanın Pazartesi 00:00 — Pazar 23:59:59 (UTC olarak döndürür).

    Bugün hangi gün olursa olsun her zaman BİR SONRAKI Pazartesi (1-7 gün sonra).
    Saatler Europe/Istanbul yerel saatiyle hesaplanır, sonuç UTC'ye çevrilir.
    """
    now_tr = datetime.now(ISTANBUL_TZ)
    # weekday(): Monday=0..Sunday=6
    days_until_monday = (7 - now_tr.weekday()) % 7
    if days_until_monday == 0:
        # Bugün Pazartesi ise BİR SONRAKİ Pazartesi (7 gün sonra)
        days_until_monday = 7
    next_monday_tr = (now_tr + timedelta(days=days_until_monday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    next_sunday_end_tr = next_monday_tr + timedelta(
        days=6, hours=23, minutes=59, seconds=59
    )
    return (
        next_monday_tr.astimezone(timezone.utc),
        next_sunday_end_tr.astimezone(timezone.utc),
    )


def compute_current_week_window() -> tuple[datetime, datetime]:
    """İçinde bulunduğumuz haftanın Pazartesi 00:00 — Pazar 23:59:59 (UTC).

    Admin'in "geç katılım" akışı için: bir saati bu haftanın müzayedesine
    ekliyoruz. Pazartesi geçmişte olabilir (örn. bugün Çarşamba) — bu
    durumda scheduler bir sonraki tick'te status'u LIVE'a çekecek.
    """
    now_tr = datetime.now(ISTANBUL_TZ)
    this_monday_tr = (now_tr - timedelta(days=now_tr.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    this_sunday_end_tr = this_monday_tr + timedelta(
        days=6, hours=23, minutes=59, seconds=59
    )
    return (
        this_monday_tr.astimezone(timezone.utc),
        this_sunday_end_tr.astimezone(timezone.utc),
    )


async def create_auction(
    db: AsyncSession, user: User, payload: AuctionCreate
) -> Auction:
    watch = (
        await db.execute(select(Watch).where(Watch.id == payload.watch_id))
    ).scalar_one_or_none()
    if not watch:
        raise NotFoundError("Saat bulunamadı")
    if watch.seller_id != user.id:
        raise ForbiddenError("Bu saat size ait değil")
    if watch.status != WatchStatus.ACTIVE:
        raise ConflictError(
            "Saat ACTIVE statüsünde olmadan açık artırma açılamaz "
            "(sertifikasyon onayı bekleniyor olabilir)"
        )
    # Yalnızca AUCTION tipli ilanlar müzayedeye sokulabilir; DIRECT_SALE
    # ilanları Miyaris Mağaza üzerinden sabit fiyatla satılır.
    if watch.listing_type != ListingType.AUCTION:
        raise ConflictError(
            "Direkt satış ilanları müzayedeye sokulamaz. "
            "Bu saat Miyaris Mağaza'da sabit fiyatla listelenmiş — "
            "müzayedeye çıkarmak için yeni bir ilan açın."
        )

    existing = (
        await db.execute(
            select(Auction).where(
                Auction.watch_id == watch.id,
                Auction.status != AuctionStatus.CANCELLED,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise ConflictError("Bu saat için zaten aktif bir açık artırma var")

    # Haftalık müzayede penceresi sistem tarafından hesaplanır — kullanıcı tarih girmez
    starts_at, ends_at = compute_next_week_window()

    auction = Auction(
        watch_id=payload.watch_id,
        starting_price=payload.starting_price,
        reserve_price=payload.reserve_price,
        buy_it_now_price=payload.buy_it_now_price,
        min_bid_increment=payload.min_bid_increment,
        current_price=payload.starting_price,
        starts_at=starts_at,
        ends_at=ends_at,
        status=AuctionStatus.SCHEDULED,
    )
    db.add(auction)
    await db.commit()
    await db.refresh(auction)
    return auction


async def get_auction(db: AsyncSession, auction_id: uuid.UUID) -> Auction:
    result = await db.execute(
        select(Auction)
        .where(Auction.id == auction_id)
        .options(selectinload(Auction.watch).selectinload(Watch.images))
    )
    auction = result.scalar_one_or_none()
    if not auction:
        raise NotFoundError("Açık artırma bulunamadı")
    return auction


async def list_auctions(
    db: AsyncSession,
    status: AuctionStatus | None = None,
    brand: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[Auction]:
    stmt = (
        select(Auction)
        .options(selectinload(Auction.watch).selectinload(Watch.images))
        .order_by(Auction.ends_at.asc())
        .limit(limit)
        .offset(offset)
    )
    if status:
        stmt = stmt.where(Auction.status == status)
    if brand:
        stmt = stmt.join(Watch).where(Watch.brand.ilike(f"%{brand}%"))
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def update_auction(
    db: AsyncSession, auction_id: uuid.UUID, user: User, payload: AuctionUpdate
) -> Auction:
    auction = await get_auction(db, auction_id)
    if auction.watch.seller_id != user.id:
        raise ForbiddenError("Bu açık artırmayı güncelleme yetkiniz yok")
    if auction.status != AuctionStatus.SCHEDULED:
        raise ConflictError(
            "Sadece henüz başlamamış açık artırmalar güncellenebilir"
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(auction, field, value)

    await db.commit()
    await db.refresh(auction)
    return auction


async def cancel_auction(
    db: AsyncSession, auction_id: uuid.UUID, user: User
) -> Auction:
    auction = await get_auction(db, auction_id)
    if auction.watch.seller_id != user.id:
        raise ForbiddenError("Yetkiniz yok")
    if auction.status != AuctionStatus.SCHEDULED:
        raise ConflictError(
            "Sadece henüz başlamamış açık artırmalar iptal edilebilir"
        )
    auction.status = AuctionStatus.CANCELLED
    await db.commit()
    return auction


async def count_bids(db: AsyncSession, auction_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count(Bid.id)).where(Bid.auction_id == auction_id)
    )
    return result.scalar_one() or 0


async def buy_now(
    db: AsyncSession,
    auction_id: uuid.UUID,
    buyer: User,
    delivery_method: DeliveryMethod,
    payment_method: PaymentMethod,
) -> tuple[Auction, EscrowTransaction]:
    """'Hemen Al' — açık artırma bitişini beklemeden anında satış.

    Alıcı bu noktada hem teslimat (SHIPPING/STORE_PICKUP) hem ödeme
    (CREDIT_CARD/BANK_TRANSFER) yöntemini seçmiş olur. BANK_TRANSFER ise
    %2.5 EFT indirimi otomatik uygulanır.

    State geçişi:
      - Auction: SCHEDULED/LIVE → ENDED
      - Watch: ACTIVE → SOLD
      - Yeni EscrowTransaction (PENDING_PAYMENT) — amount=standart fiyat,
        discount_amount=EFT indirimi (varsa), fee=post-discount * %5
    """
    auction = await get_auction(db, auction_id)

    if auction.buy_it_now_price is None:
        raise ConflictError("Bu açık artırma için 'Hemen Al' fiyatı tanımlı değil")
    if auction.status not in (AuctionStatus.SCHEDULED, AuctionStatus.LIVE):
        raise ConflictError(
            f"'Hemen Al' kullanılamaz — durum: {auction.status.value}"
        )
    if auction.watch.seller_id == buyer.id:
        raise ForbiddenError("Kendi saatinizi satın alamazsınız")

    # State transition'ı — atomic
    auction.status = AuctionStatus.ENDED
    auction.current_price = auction.buy_it_now_price
    auction.watch.status = WatchStatus.SOLD

    listed_price = auction.buy_it_now_price
    # EFT indirimi hesabı (escrow_service ile aynı sabit kullanılır)
    from app.services.escrow_service import EFT_DISCOUNT_RATE
    if payment_method == PaymentMethod.BANK_TRANSFER:
        discount = (listed_price * EFT_DISCOUNT_RATE).quantize(Decimal("0.01"))
    else:
        discount = Decimal("0.00")
    effective_paid = listed_price - discount
    fee, _ = compute_tiered_commission(effective_paid)

    escrow = EscrowTransaction(
        auction_id=auction.id,
        buyer_id=buyer.id,
        seller_id=auction.watch.seller_id,
        amount=listed_price,
        discount_amount=discount,
        platform_fee=fee,
        delivery_method=delivery_method,
        payment_method=payment_method,
        status=EscrowStatus.PENDING_PAYMENT,
    )
    db.add(escrow)

    await db.commit()
    await db.refresh(auction)
    await db.refresh(escrow)
    return auction, escrow


# ============================================================================
# Admin: müzayede yönetimi (panel ayrı router'da bağlı)
# ============================================================================


async def list_admin_scheduled(
    db: AsyncSession, limit: int = 50, offset: int = 0
) -> list[Auction]:
    """Admin panel için aktif/scheduled/live müzayedeler.

    ENDED/COMPLETED/CANCELLED hariç — bunlar artık eskrow/operasyon akışına
    ait. SCHEDULED en yakın → LIVE → en uzak sırasıyla.
    """
    stmt = (
        select(Auction)
        .where(
            Auction.status.in_(
                (AuctionStatus.SCHEDULED, AuctionStatus.LIVE)
            )
        )
        .options(
            selectinload(Auction.watch).selectinload(Watch.images),
            selectinload(Auction.watch).selectinload(Watch.seller),
        )
        .order_by(Auction.starts_at.asc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def admin_move_to_current_week(
    db: AsyncSession, auction_id: uuid.UUID
) -> Auction:
    """Müzayedeyi bu haftanın penceresine çek (geç katılım).

    Yan etki: starts_at geçmişte ise status'u anında LIVE'a çekiyoruz.
    Aksi durumda scheduler bir sonraki tick'te (max 30 sn) halleder.

    Kısıtlar:
      - Sadece SCHEDULED veya LIVE auction'lar move edilebilir
      - ENDED/COMPLETED/CANCELLED bloklanır (geri alınamaz state'ler)
    """
    auction = await get_auction(db, auction_id)
    if auction.status not in (AuctionStatus.SCHEDULED, AuctionStatus.LIVE):
        raise ConflictError(
            f"Bu müzayede {auction.status.value} durumunda — taşınamaz"
        )

    starts_at, ends_at = compute_current_week_window()
    now = datetime.now(timezone.utc)

    # Güvenlik: bu haftanın bitişi geçmişse (örn. Pazar gecesi 23:59:59'dan
    # sonra ama Pazartesi'den önceki garip saniyeler) hiç schedule etme
    if ends_at <= now:
        raise ConflictError(
            "Bu haftanın penceresi kapanmış — bir sonraki haftayı kullan"
        )

    auction.starts_at = starts_at
    auction.ends_at = ends_at
    auction.extended_until = None  # önceki extension'ı temizle

    # starts_at geçmişte ise anında LIVE'a çek (scheduler tick'i beklemeden)
    if starts_at <= now and auction.status == AuctionStatus.SCHEDULED:
        auction.status = AuctionStatus.LIVE

    await db.commit()
    await db.refresh(auction)
    return auction


async def admin_cancel(db: AsyncSession, auction_id: uuid.UUID) -> Auction:
    """Admin override iptal — satıcı sahiplik kontrolü yok, LIVE da iptal
    edilebilir. ENDED/COMPLETED iptal edilemez (kazanan + eskrow var)."""
    auction = await get_auction(db, auction_id)
    if auction.status in (
        AuctionStatus.ENDED,
        AuctionStatus.COMPLETED,
        AuctionStatus.CANCELLED,
    ):
        raise ConflictError(
            f"{auction.status.value} durumundaki müzayede iptal edilemez"
        )
    auction.status = AuctionStatus.CANCELLED
    await db.commit()
    await db.refresh(auction)
    return auction


async def list_my_participations(
    db: AsyncSession, user: User, limit: int = 50, offset: int = 0
) -> list[dict]:
    """Kullanıcının teklif verdiği tüm açık artırmaların özeti.

    Tek query ile her açık artırma için: kullanıcının max bid'i, mevcut fiyat,
    is_leading (max == current_price), bid_count. Watch ve images eager-load.
    """
    # Subquery: bu kullanıcının her açık artırmadaki maks teklifi
    my_max = (
        select(
            Bid.auction_id.label("auction_id"),
            func.max(Bid.amount).label("my_highest"),
        )
        .where(Bid.bidder_id == user.id)
        .group_by(Bid.auction_id)
        .subquery()
    )

    # Subquery: her açık artırmadaki toplam bid sayısı
    bid_counts = (
        select(Bid.auction_id, func.count(Bid.id).label("cnt"))
        .group_by(Bid.auction_id)
        .subquery()
    )

    stmt = (
        select(Auction, my_max.c.my_highest, bid_counts.c.cnt)
        .join(my_max, Auction.id == my_max.c.auction_id)
        .outerjoin(bid_counts, Auction.id == bid_counts.c.auction_id)
        .options(selectinload(Auction.watch).selectinload(Watch.images))
        .order_by(Auction.ends_at.desc())
        .limit(limit)
        .offset(offset)
    )

    rows = (await db.execute(stmt)).all()

    items: list[dict] = []
    for auction, my_highest, cnt in rows:
        primary = next((i.url for i in auction.watch.images if i.is_primary), None)
        if not primary and auction.watch.images:
            primary = auction.watch.images[0].url
        items.append(
            {
                "auction_id": auction.id,
                "watch_id": auction.watch.id,
                "brand": auction.watch.brand,
                "model": auction.watch.model,
                "primary_image_url": primary,
                "my_highest_bid": my_highest,
                "current_price": auction.current_price,
                "is_leading": my_highest == auction.current_price,
                "status": auction.status,
                "ends_at": auction.ends_at,
                "extended_until": auction.extended_until,
                "bid_count": cnt or 0,
            }
        )
    return items
