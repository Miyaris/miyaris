import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auction import Auction, AuctionStatus
from app.models.bid import Bid
from app.models.user import User
from app.models.watch import Watch
from app.schemas.bid import BidCreate
from app.utils.exceptions import ConflictError, ForbiddenError, NotFoundError

# Anti-sniping: son 5 dk'da gelen teklif bitiş süresini 5 dk uzatır
ANTI_SNIPING_WINDOW = timedelta(minutes=5)
# Bu tutarın üstündeki teklifler için KYC zorunlu (USD)
KYC_REQUIRED_AMOUNT = Decimal("3000")


async def place_bid(
    db: AsyncSession,
    auction_id: uuid.UUID,
    bidder: User,
    payload: BidCreate,
) -> Bid:
    auction = (
        await db.execute(
            select(Auction)
            .where(Auction.id == auction_id)
            .options(selectinload(Auction.watch))
        )
    ).scalar_one_or_none()
    if not auction:
        raise NotFoundError("Açık artırma bulunamadı")

    now = datetime.now(timezone.utc)

    # Otomatik LIVE'a geç (eğer zamanı geldiyse ama scheduler henüz dokunmadıysa)
    if auction.status == AuctionStatus.SCHEDULED and auction.starts_at <= now:
        auction.status = AuctionStatus.LIVE

    if auction.status != AuctionStatus.LIVE:
        raise ConflictError("Açık artırma şu anda teklif almıyor")

    end_time = auction.extended_until or auction.ends_at
    if now > end_time:
        raise ConflictError("Açık artırma süresi doldu")

    if auction.watch.seller_id == bidder.id:
        raise ForbiddenError("Kendi saatinize teklif veremezsiniz")

    min_required = auction.current_price + auction.min_bid_increment
    if payload.amount < min_required:
        raise ConflictError(f"Minimum teklif: ${min_required}")

    if payload.amount >= KYC_REQUIRED_AMOUNT and not bidder.kyc_verified:
        raise ForbiddenError(
            f"${KYC_REQUIRED_AMOUNT} üstü teklifler için KYC doğrulaması gerekli"
        )

    if payload.is_proxy and (
        payload.max_proxy_amount is None or payload.max_proxy_amount < payload.amount
    ):
        raise ConflictError(
            "Proxy bid için max_proxy_amount belirtilmeli ve amount'tan büyük olmalı"
        )

    bid = Bid(
        auction_id=auction.id,
        bidder_id=bidder.id,
        amount=payload.amount,
        is_proxy=payload.is_proxy,
        max_proxy_amount=payload.max_proxy_amount,
    )
    db.add(bid)
    auction.current_price = payload.amount

    # Anti-sniping
    if end_time - now < ANTI_SNIPING_WINDOW:
        auction.extended_until = now + ANTI_SNIPING_WINDOW

    await db.commit()
    await db.refresh(bid)
    return bid


async def list_bids_for_auction(
    db: AsyncSession, auction_id: uuid.UUID, limit: int = 50
) -> list[Bid]:
    result = await db.execute(
        select(Bid)
        .where(Bid.auction_id == auction_id)
        .order_by(Bid.placed_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
