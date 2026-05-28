"""Presenter (canlı müzayede sunucusu) servis katmanı.

Presenter yetkili kullanıcının kendi showcase'lerini açma, listeleme ve
canlı yayında yönetme (süre uzatma + satışı tamamlama) operasyonlarını
kapsar. Standart satıcı akışından üç farkı:

  1. **Moderasyon atlanır**: Watch direkt ACTIVE statüsünde oluşur — ön
     ekspertiz veya admin onayı beklemez. Yetki güveni presenter rolünden
     gelir.
  2. **AI valuation tetiklenmez**: ai_processing_status=NONE; worker
     pipeline'a düşmez.
  3. **Custom datetime**: Haftalık çark uygulanmaz. Presenter spesifik
     başlangıç tarihi+saati ve süre dakikası girer; starts_at şu anda veya
     geçmişte ise auction anında LIVE'a çekilir (scheduler tick'i
     beklenmez).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from slugify import slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auction import Auction, AuctionStatus
from app.models.bid import Bid
from app.models.escrow import EscrowTransaction
from app.models.user import User
from app.models.watch import (
    AIProcessingStatus,
    ListingType,
    Watch,
    WatchImage,
    WatchStatus,
)
from app.schemas.presenter import PresenterShowcaseCreate
from app.utils.commission import compute_tiered_commission
from app.utils.exceptions import ConflictError, ForbiddenError, NotFoundError

# Bir presenter aksiyonuyla varsayılan olarak eklenen süre
DEFAULT_EXTEND_SECONDS = 30


def _generate_delivery_code(watch_id: uuid.UUID) -> str:
    return f"MYR-{watch_id.hex[:6].upper()}"


async def _generate_unique_slug(db: AsyncSession, base: str) -> str:
    slug = slugify(base)[:200] or "showcase"
    candidate = slug
    suffix = 1
    while True:
        existing = await db.execute(
            select(Watch.id).where(Watch.slug == candidate)
        )
        if existing.scalar_one_or_none() is None:
            return candidate
        suffix += 1
        candidate = f"{slug}-{suffix}"


async def create_showcase(
    db: AsyncSession,
    user: User,
    payload: PresenterShowcaseCreate,
) -> Auction:
    """Tek transaction'da watch + auction yarat.

    Yan etkiler:
      * Watch ACTIVE, listing_type=AUCTION, ai_processing_status=NONE
      * Auction SCHEDULED (starts_at gelecek) veya LIVE (starts_at geçmiş)
      * extended_until=None — presenter zamanla manuel uzatır

    Sahiplik: watch.seller_id = presenter.id. Presenter aynı zamanda
    "satıcı" rolüyle değerlendirilir; finalize_sale → escrow seller_id de
    presenter'a yazılır.
    """
    if not user.is_presenter:
        # Defense-in-depth: route guard zaten 403 atar, ama yardımcı
        # fonksiyonu test ortamında çağıran biri olabilir.
        raise ForbiddenError("Presenter yetkisi gerekli")

    now = datetime.now(timezone.utc)
    ends_at = payload.starts_at + timedelta(minutes=payload.duration_minutes)
    if ends_at <= now:
        raise ConflictError(
            "Müzayede bitişi geçmişte olamaz — süreyi artırın veya "
            "başlangıç saatini ileri çekin"
        )

    # Watch oluştur — ekspertiz/moderasyon atlanmış akış
    watch_id = uuid.uuid4()
    slug = await _generate_unique_slug(
        db, f"{payload.brand}-{payload.model}-{payload.reference_number}"
    )
    watch = Watch(
        id=watch_id,
        seller_id=user.id,
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
        listing_type=ListingType.AUCTION,
        asking_price=None,
        status=WatchStatus.ACTIVE,  # Doğrudan ACTIVE — moderasyon atlanır
        ai_processing_status=AIProcessingStatus.NONE,  # Worker tetiklenmez
    )
    for idx, url in enumerate(payload.image_urls):
        watch.images.append(
            WatchImage(url=str(url), sort_order=idx, is_primary=(idx == 0))
        )
    db.add(watch)

    # Auction oluştur — custom datetime, anlık LIVE veya gelecekte SCHEDULED
    initial_status = (
        AuctionStatus.LIVE
        if payload.starts_at <= now
        else AuctionStatus.SCHEDULED
    )
    auction = Auction(
        watch_id=watch_id,
        starting_price=payload.starting_price,
        reserve_price=payload.reserve_price,
        buy_it_now_price=payload.buy_it_now_price,
        min_bid_increment=payload.min_bid_increment,
        current_price=payload.starting_price,
        starts_at=payload.starts_at,
        ends_at=ends_at,
        status=initial_status,
        # Public /auctions grid'inde gözükmesin — presenter Instagram'dan
        # direkt /auctions/{id} linkini paylaşıyor.
        is_presenter_auction=True,
    )
    db.add(auction)

    await db.commit()
    await db.refresh(auction)
    return auction


async def list_my_showcases(
    db: AsyncSession,
    user: User,
    limit: int = 50,
    offset: int = 0,
) -> list[Auction]:
    """Bu presenter'ın kendi açtığı tüm müzayedeler.

    Watch images selectin yüklenir (kart render için). Sırlama: en yakın
    starts_at üstte (gelecekteki yayınlar listenin başında).
    """
    stmt = (
        select(Auction)
        .join(Watch, Auction.watch_id == Watch.id)
        .where(Watch.seller_id == user.id)
        .options(selectinload(Auction.watch).selectinload(Watch.images))
        .order_by(Auction.starts_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def get_my_showcase(
    db: AsyncSession,
    auction_id: uuid.UUID,
    user: User,
) -> Auction:
    """Presenter'ın kendi showcase'inin tek detayı.

    Live page (`/presenter/live/{id}`) tarafından kullanılır — listenin
    içinde UUID arama yerine direkt fetch + ownership doğrulama yapar,
    böylece UUID büyük/küçük harf farkı veya sayfalama sınırı yüzünden
    "bulunamadı" hatası vermez.
    """
    return await _get_owned_auction(db, auction_id, user)


async def _get_owned_auction(
    db: AsyncSession,
    auction_id: uuid.UUID,
    user: User,
) -> Auction:
    """Auction'ı yükle + ownership doğrula. Sahibi değilse 403."""
    stmt = (
        select(Auction)
        .where(Auction.id == auction_id)
        .options(selectinload(Auction.watch).selectinload(Watch.images))
    )
    auction = (await db.execute(stmt)).scalar_one_or_none()
    if auction is None:
        raise NotFoundError("Müzayede bulunamadı")
    if auction.watch.seller_id != user.id:
        # Başka bir presenter'ın showcase'ine müdahale etmek yasak.
        raise ForbiddenError("Bu müzayede size ait değil")
    return auction


async def extend_auction(
    db: AsyncSession,
    auction_id: uuid.UUID,
    user: User,
    seconds: int = DEFAULT_EXTEND_SECONDS,
) -> Auction:
    """`+30 Saniye Ekle` — extended_until'i bumplar.

    Hesap: mevcut effective end = (extended_until or ends_at), yeni
    effective end = mevcut + seconds. Scheduler tick'i geleneksel
    ends_at değil bu alanı baz alır.
    """
    if seconds <= 0 or seconds > 600:
        raise ConflictError("Eklenebilir süre 1-600 saniye arası olmalı")

    auction = await _get_owned_auction(db, auction_id, user)
    if auction.status != AuctionStatus.LIVE:
        raise ConflictError(
            f"Sadece LIVE müzayedelere süre eklenebilir (mevcut: {auction.status.value})"
        )

    current_end = auction.extended_until or auction.ends_at
    auction.extended_until = current_end + timedelta(seconds=seconds)
    await db.commit()
    await db.refresh(auction)
    return auction


async def finalize_sale(
    db: AsyncSession,
    auction_id: uuid.UUID,
    user: User,
) -> tuple[Auction, EscrowTransaction | None]:
    """`SATTIM!` — müzayedeyi anında bitir, en yüksek teklifle escrow aç.

    State geçişi:
      * Auction LIVE → ENDED, winning_bid_id=highest.id
      * Watch ACTIVE → SOLD
      * EscrowTransaction (PENDING_PAYMENT), delivery+payment_method=NULL
        (alıcı sonra seçer; mevcut escrow akışıyla aynı semantik)
      * Reserve fiyatı varsa ve winning amount altındaysa satış IPTAL
        edilmez ama escrow oluşturulmaz — auction ENDED, watch ACTIVE kalır
        (presenter manuel satış kararını override etti, biz reserve uyarısı
        atıyoruz).

    Eğer hiç teklif yoksa: 409 ConflictError. Presenter ihtiyaten "yeniden
    planla" akışına yönlendirilir (bu sürüm: showcase'i tekrar yarat).
    """
    auction = await _get_owned_auction(db, auction_id, user)
    if auction.status != AuctionStatus.LIVE:
        raise ConflictError(
            f"Sadece LIVE müzayede satışı kesinleştirilebilir "
            f"(mevcut: {auction.status.value})"
        )

    # En yüksek teklif (eşitlikte ilk gelen kazanır)
    winning_bid = (
        await db.execute(
            select(Bid)
            .where(Bid.auction_id == auction.id)
            .order_by(Bid.amount.desc(), Bid.placed_at.asc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if winning_bid is None:
        raise ConflictError("Teklif yok — satış kesinleştirilemez")

    # Reserve kontrolü
    below_reserve = (
        auction.reserve_price is not None
        and winning_bid.amount < auction.reserve_price
    )

    auction.status = AuctionStatus.ENDED
    escrow: EscrowTransaction | None = None

    if not below_reserve:
        auction.winning_bid_id = winning_bid.id
        auction.watch.status = WatchStatus.SOLD
        fee, _ = compute_tiered_commission(winning_bid.amount)
        escrow = EscrowTransaction(
            auction_id=auction.id,
            buyer_id=winning_bid.bidder_id,
            seller_id=auction.watch.seller_id,
            amount=winning_bid.amount,
            platform_fee=fee,
        )
        db.add(escrow)

    await db.commit()
    await db.refresh(auction)
    if escrow is not None:
        await db.refresh(escrow)
    return auction, escrow
