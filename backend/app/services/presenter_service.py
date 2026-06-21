"""Presenter (canlı müzayede sunucusu) servis katmanı — oturum modeli.

Mental model:
  * Bir presenter `PresenterSession` (oturum) açar. Oturum: ad, başlangıç
    saati, açıklama, status (planning / live / ended / cancelled).
  * Oturum içine birden çok Saat LOT'u ekler (Watch + Auction birleşik).
    Lot'lar oturumda sırayla canlı yayınlanır.
  * Live ekranında presenter "Sıradaki Saat" ile lot'lar arası geçer; her
    lot ya SATTIM ile satılır (escrow oluşur) ya da reserve altı/teklifsiz
    biter (no-sale).

Farkları (eski "showcase" yapısından):
  * Saat eklemek artık her seferinde canlı yayın açmıyor.
  * Public /auctions sayfasında her saat ayrı kart değil, oturum tek kart.
  * Yeni bir saat eklemek için canlıya geçmiş olmasına gerek yok — planning
    fazında istenildiği kadar saat eklenir.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from slugify import slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auction import Auction, AuctionStatus
from app.models.bid import Bid
from app.models.escrow import EscrowTransaction
from app.models.presenter_session import (
    PresenterSession,
    PresenterSessionStatus,
)
from app.models.user import User
from app.models.watch import (
    AIProcessingStatus,
    ListingType,
    Watch,
    WatchImage,
    WatchStatus,
)
from app.schemas.presenter import (
    PresenterLotCreate,
    PresenterSessionCreate,
)
from app.utils.commission import compute_tiered_commission
from app.utils.exceptions import ConflictError, ForbiddenError, NotFoundError

# Canlı bir lot'un ends_at için varsayılan tutucu — gerçek bitiş presenter
# SATTIM / Sıradaki Saat ile manuel tetiklenir. Scheduler bu tarihi
# beklerken müzayede kapanmasın diye uzak gelecek (1 hafta).
LOT_DEFAULT_DURATION = timedelta(days=7)
DEFAULT_EXTEND_SECONDS = 30


def _generate_delivery_code(watch_id: uuid.UUID) -> str:
    return f"MYR-{watch_id.hex[:6].upper()}"


async def _generate_unique_slug(db: AsyncSession, base: str) -> str:
    slug = slugify(base)[:200] or "lot"
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


# ============================================================================
# Oturum (Session) CRUD
# ============================================================================


async def create_session(
    db: AsyncSession,
    user: User,
    payload: PresenterSessionCreate,
) -> PresenterSession:
    """Yeni oturum aç. Statü PLANNING — saatler ayrı endpoint'le eklenir."""
    if not user.is_presenter:
        raise ForbiddenError("Presenter yetkisi gerekli")

    session = PresenterSession(
        presenter_id=user.id,
        name=payload.name,
        description=payload.description,
        scheduled_at=payload.scheduled_at,
        status=PresenterSessionStatus.PLANNING,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def list_my_sessions(
    db: AsyncSession, user: User, limit: int = 50, offset: int = 0
) -> list[PresenterSession]:
    """Bu presenter'a ait tüm oturumlar — en yeni planlanmış üstte."""
    stmt = (
        select(PresenterSession)
        .where(PresenterSession.presenter_id == user.id)
        .options(
            selectinload(PresenterSession.lots).selectinload(Auction.watch).selectinload(Watch.images)
        )
        .order_by(PresenterSession.scheduled_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def get_my_session(
    db: AsyncSession, session_id: uuid.UUID, user: User
) -> PresenterSession:
    """Oturum detayı + ownership doğrulama."""
    stmt = (
        select(PresenterSession)
        .where(PresenterSession.id == session_id)
        .options(
            selectinload(PresenterSession.lots)
            .selectinload(Auction.watch)
            .selectinload(Watch.images)
        )
    )
    session = (await db.execute(stmt)).scalar_one_or_none()
    if session is None:
        raise NotFoundError("Oturum bulunamadı")
    if session.presenter_id != user.id:
        raise ForbiddenError("Bu oturum size ait değil")
    return session


# ============================================================================
# Oturum bilgilerini düzenleme (sadece PLANNING durumunda)
# ============================================================================


async def update_session(
    db: AsyncSession,
    session_id: uuid.UUID,
    user: User,
    payload,  # PresenterSessionUpdate — type kendi modülünde
) -> PresenterSession:
    """Oturumun ad/saat/açıklama alanlarını güncelle.

    Yalnızca PLANNING durumundaki oturum değiştirilebilir. Canlıdayken
    saatini değiştirmek anti-sniping, teklif zaman takibini ve genel
    kullanıcı deneyimini bozar.

    Sadece sahibi düzenleyebilir; başkasına ait oturum 403 döner.
    Yalnızca None olmayan alanlar uygulanır (kısmi güncelleme).
    """
    session = await get_my_session(db, session_id, user)

    if session.status != PresenterSessionStatus.PLANNING:
        raise ConflictError(
            "Yalnızca planlama aşamasındaki oturum düzenlenebilir"
        )

    if payload.name is not None:
        session.name = payload.name
    if payload.scheduled_at is not None:
        session.scheduled_at = payload.scheduled_at
    if payload.description is not None:
        session.description = payload.description

    await db.commit()
    await db.refresh(session)
    return session


# ============================================================================
# Lot ekleme
# ============================================================================


async def add_lot(
    db: AsyncSession,
    session_id: uuid.UUID,
    user: User,
    payload: PresenterLotCreate,
) -> Auction:
    """Var olan oturuma yeni bir saat lot'u ekle.

    Yan etkiler:
      * Watch ACTIVE statüsünde oluşur (ekspertiz atlanır)
      * Auction SCHEDULED — starts_at uzak gelecek (presenter manuel
        canlıya alır)
      * presenter_session_id = session.id
    """
    session = await get_my_session(db, session_id, user)
    if session.status not in (
        PresenterSessionStatus.PLANNING,
        PresenterSessionStatus.LIVE,
    ):
        raise ConflictError(
            f"{session.status.value} durumundaki oturuma lot eklenemez"
        )

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
        status=WatchStatus.ACTIVE,
        ai_processing_status=AIProcessingStatus.NONE,
    )
    for idx, url in enumerate(payload.image_urls):
        watch.images.append(
            WatchImage(url=str(url), sort_order=idx, is_primary=(idx == 0))
        )
    db.add(watch)

    # Lot için "placeholder" zaman penceresi — presenter manuel canlıya alır.
    # starts_at/ends_at session.scheduled_at'ten türetilir.
    auction = Auction(
        watch_id=watch_id,
        starting_price=payload.starting_price,
        reserve_price=payload.reserve_price,
        buy_it_now_price=payload.buy_it_now_price,
        min_bid_increment=payload.min_bid_increment,
        current_price=payload.starting_price,
        starts_at=session.scheduled_at,
        ends_at=session.scheduled_at + LOT_DEFAULT_DURATION,
        status=AuctionStatus.SCHEDULED,
        presenter_session_id=session.id,
    )
    db.add(auction)

    await db.commit()
    await db.refresh(auction)
    return auction


# ============================================================================
# Oturum canlı akışı
# ============================================================================


async def start_session(
    db: AsyncSession, session_id: uuid.UUID, user: User
) -> PresenterSession:
    """Oturumu canlıya al — PLANNING → LIVE.

    İçindeki ilk SCHEDULED lot anında LIVE'a geçer. Sıradaki lot'lar
    SCHEDULED'da kalır, presenter advance ile sırayla açar.
    """
    session = await get_my_session(db, session_id, user)
    if session.status != PresenterSessionStatus.PLANNING:
        raise ConflictError(
            f"{session.status.value} durumundaki oturum canlıya alınamaz"
        )
    if not session.lots:
        raise ConflictError("Oturuma en az 1 saat eklemeden canlıya geçilemez")

    session.status = PresenterSessionStatus.LIVE
    # İlk lot LIVE'a
    first_lot = sorted(session.lots, key=lambda a: a.created_at)[0]
    first_lot.status = AuctionStatus.LIVE
    first_lot.starts_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(session)
    return session


async def get_current_lot(session: PresenterSession) -> Auction | None:
    """Oturumda şu anda LIVE olan lot — yoksa None."""
    for lot in sorted(session.lots, key=lambda a: a.created_at):
        if lot.status == AuctionStatus.LIVE:
            return lot
    return None


async def _next_pending_lot(session: PresenterSession) -> Auction | None:
    """Henüz açılmamış (SCHEDULED) sıradaki lot — yoksa None (oturum bitti)."""
    for lot in sorted(session.lots, key=lambda a: a.created_at):
        if lot.status == AuctionStatus.SCHEDULED:
            return lot
    return None


async def advance_to_next_lot(
    db: AsyncSession, session_id: uuid.UUID, user: User
) -> PresenterSession:
    """Sıradaki saate geç.

    Mevcut LIVE lot ENDED'a çekilir (kazanan varsa escrow oluşturulur,
    yoksa no-sale). Sıradaki SCHEDULED lot LIVE'a alınır. Sıradaki lot yoksa
    oturum ENDED durumuna geçer.
    """
    session = await get_my_session(db, session_id, user)
    if session.status != PresenterSessionStatus.LIVE:
        raise ConflictError(
            f"{session.status.value} durumunda 'Sıradaki Saat' kullanılamaz"
        )

    current = await get_current_lot(session)
    if current is not None:
        await _close_lot(db, current)

    upcoming = await _next_pending_lot(session)
    if upcoming is None:
        session.status = PresenterSessionStatus.ENDED
    else:
        upcoming.status = AuctionStatus.LIVE
        upcoming.starts_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(session)
    return session


async def _close_lot(db: AsyncSession, lot: Auction) -> None:
    """LIVE lot'u kapat: en yüksek teklif varsa escrow, yoksa no-sale.

    Reserve fiyatı varsa ve winning amount < reserve ise satış olmaz
    (Watch ACTIVE kalır, oturumdan dışarı bırakılır).
    """
    winning_bid = (
        await db.execute(
            select(Bid)
            .where(Bid.auction_id == lot.id)
            .order_by(Bid.amount.desc(), Bid.placed_at.asc())
            .limit(1)
        )
    ).scalar_one_or_none()

    lot.status = AuctionStatus.ENDED

    if winning_bid is None:
        return

    below_reserve = (
        lot.reserve_price is not None
        and winning_bid.amount < lot.reserve_price
    )
    if below_reserve:
        return

    lot.winning_bid_id = winning_bid.id
    lot.watch.status = WatchStatus.SOLD
    fee, _ = compute_tiered_commission(winning_bid.amount)
    escrow = EscrowTransaction(
        auction_id=lot.id,
        buyer_id=winning_bid.bidder_id,
        seller_id=lot.watch.seller_id,
        amount=winning_bid.amount,
        platform_fee=fee,
    )
    db.add(escrow)


async def finalize_current_lot(
    db: AsyncSession, session_id: uuid.UUID, user: User
) -> Auction:
    """SATTIM mevcut LIVE lot için — escrow açılır, lot biter.

    advance_to_next_lot ile fark: bu sadece mevcut lot'u kapatır, sıradaki
    lot'u LIVE'a almaz. Presenter "biraz konuşacağım" istediğinde kullanır.
    Lot LIVE → ENDED, escrow var (kazanan varsa).
    """
    session = await get_my_session(db, session_id, user)
    current = await get_current_lot(session)
    if current is None:
        raise ConflictError("Şu an LIVE bir saat yok")

    winning_bid = (
        await db.execute(
            select(Bid)
            .where(Bid.auction_id == current.id)
            .order_by(Bid.amount.desc(), Bid.placed_at.asc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if winning_bid is None:
        raise ConflictError("Teklif yok — satış kesinleştirilemez")

    await _close_lot(db, current)
    await db.commit()
    await db.refresh(current)
    return current


async def extend_current_lot(
    db: AsyncSession,
    session_id: uuid.UUID,
    user: User,
    seconds: int = DEFAULT_EXTEND_SECONDS,
) -> Auction:
    """+30 sn — mevcut lot'un extended_until'ini bumplar."""
    if seconds <= 0 or seconds > 600:
        raise ConflictError("Eklenebilir süre 1-600 saniye arası olmalı")

    session = await get_my_session(db, session_id, user)
    current = await get_current_lot(session)
    if current is None:
        raise ConflictError("Şu an LIVE bir saat yok")

    now = datetime.now(timezone.utc)
    base = current.extended_until or now
    current.extended_until = base + timedelta(seconds=seconds)
    await db.commit()
    await db.refresh(current)
    return current


async def end_session(
    db: AsyncSession, session_id: uuid.UUID, user: User
) -> PresenterSession:
    """Oturumu manuel kapat. Mevcut LIVE lot varsa ENDED'a çekilir
    (escrow + kazanan), beklemedeki SCHEDULED lot'lar olduğu gibi
    kalır ama session ENDED işaretlenir."""
    session = await get_my_session(db, session_id, user)
    if session.status != PresenterSessionStatus.LIVE:
        raise ConflictError(
            f"{session.status.value} durumundaki oturum manuel kapatılamaz"
        )

    current = await get_current_lot(session)
    if current is not None:
        await _close_lot(db, current)

    session.status = PresenterSessionStatus.ENDED
    await db.commit()
    await db.refresh(session)
    return session


# ============================================================================
# Public — sıradan kullanıcı için oturum sorguları
# ============================================================================


async def list_public_sessions(
    db: AsyncSession, limit: int = 30, offset: int = 0
) -> list[PresenterSession]:
    """Public /auctions için aktif (planning/live) oturumlar.

    is_hidden=True olanlar filtrelenir. PLANNING + LIVE olanları gösterir;
    ENDED ve CANCELLED gizlenir.
    """
    stmt = (
        select(PresenterSession)
        .where(
            PresenterSession.is_hidden == False,  # noqa: E712
            PresenterSession.status.in_(
                (
                    PresenterSessionStatus.PLANNING,
                    PresenterSessionStatus.LIVE,
                )
            ),
        )
        .options(
            selectinload(PresenterSession.lots)
            .selectinload(Auction.watch)
            .selectinload(Watch.images),
            selectinload(PresenterSession.presenter),
        )
        .order_by(PresenterSession.scheduled_at.asc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def get_public_session(
    db: AsyncSession, session_id: uuid.UUID
) -> PresenterSession:
    """Public detay sayfası için oturum. is_hidden 404 döner."""
    stmt = (
        select(PresenterSession)
        .where(PresenterSession.id == session_id)
        .options(
            selectinload(PresenterSession.lots)
            .selectinload(Auction.watch)
            .selectinload(Watch.images),
            selectinload(PresenterSession.presenter),
        )
    )
    session = (await db.execute(stmt)).scalar_one_or_none()
    if session is None or session.is_hidden:
        raise NotFoundError("Oturum bulunamadı")
    return session


# ============================================================================
# Admin — presenter oturumlarına override
# ============================================================================


async def admin_list_sessions(
    db: AsyncSession,
    tab: str = "active",
    limit: int = 50,
    offset: int = 0,
) -> list[PresenterSession]:
    """Admin paneli — sekmeli oturum listesi (presenter kim olursa olsun).

    tab değerleri:
      * "active"  → PLANNING + LIVE, is_hidden=False (en yeni planlanmış üstte)
      * "past"    → ENDED + CANCELLED, is_hidden=False (en yeni bitmiş üstte)
      * "hidden"  → tüm statüler, is_hidden=True
    """
    base = select(PresenterSession).options(
        selectinload(PresenterSession.lots)
        .selectinload(Auction.watch)
        .selectinload(Watch.images),
        selectinload(PresenterSession.presenter),
    )
    if tab == "active":
        stmt = (
            base.where(
                PresenterSession.is_hidden == False,  # noqa: E712
                PresenterSession.status.in_(
                    (
                        PresenterSessionStatus.PLANNING,
                        PresenterSessionStatus.LIVE,
                    )
                ),
            )
            .order_by(PresenterSession.scheduled_at.desc())
        )
    elif tab == "past":
        stmt = (
            base.where(
                PresenterSession.is_hidden == False,  # noqa: E712
                PresenterSession.status.in_(
                    (
                        PresenterSessionStatus.ENDED,
                        PresenterSessionStatus.CANCELLED,
                    )
                ),
            )
            .order_by(PresenterSession.scheduled_at.desc())
        )
    elif tab == "hidden":
        stmt = base.where(PresenterSession.is_hidden == True).order_by(  # noqa: E712
            PresenterSession.scheduled_at.desc()
        )
    else:
        raise ValueError(f"Geçersiz sekme değeri: {tab}")

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def admin_set_session_hidden(
    db: AsyncSession, session_id: uuid.UUID, hidden: bool
) -> PresenterSession:
    """Admin override — oturumu public sayfadan gizle/geri getir.

    is_hidden=True → public /auctions sayfasında "Canlı Sunucu Müzayedeleri"
    bölümünde gözükmez, doğrudan link bile 404 döner. Lot'lar bireysel
    olarak değiştirilmez; oturum container'ı saklanır.
    """
    stmt = (
        select(PresenterSession)
        .where(PresenterSession.id == session_id)
        .options(
            selectinload(PresenterSession.lots)
            .selectinload(Auction.watch)
            .selectinload(Watch.images),
            selectinload(PresenterSession.presenter),
        )
    )
    session = (await db.execute(stmt)).scalar_one_or_none()
    if session is None:
        raise NotFoundError("Oturum bulunamadı")
    session.is_hidden = hidden
    await db.commit()
    await db.refresh(session)
    return session


async def admin_cancel_session(
    db: AsyncSession, session_id: uuid.UUID
) -> PresenterSession:
    """Admin override — oturumu iptal et.

    PLANNING veya LIVE durumdaki oturumlar için. Mevcut LIVE bir lot
    varsa kapatılır (escrow oluşturulmaz, no-sale). ENDED/CANCELLED
    oturumlar için işlem yok (idempotent değil, 409 döner).
    """
    stmt = (
        select(PresenterSession)
        .where(PresenterSession.id == session_id)
        .options(
            selectinload(PresenterSession.lots)
            .selectinload(Auction.watch)
            .selectinload(Watch.images),
            selectinload(PresenterSession.presenter),
        )
    )
    session = (await db.execute(stmt)).scalar_one_or_none()
    if session is None:
        raise NotFoundError("Oturum bulunamadı")
    if session.status not in (
        PresenterSessionStatus.PLANNING,
        PresenterSessionStatus.LIVE,
    ):
        raise ConflictError(
            f"{session.status.value} durumundaki oturum iptal edilemez"
        )

    # Mevcut LIVE lot varsa ENDED'a çek (no-sale; admin iptali, satış yok)
    for lot in session.lots:
        if lot.status == AuctionStatus.LIVE:
            lot.status = AuctionStatus.ENDED
        elif lot.status == AuctionStatus.SCHEDULED:
            lot.status = AuctionStatus.CANCELLED

    session.status = PresenterSessionStatus.CANCELLED
    await db.commit()
    await db.refresh(session)
    return session
