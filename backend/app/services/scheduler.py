"""Açık artırma yaşam döngüsü zamanlayıcısı.

FastAPI lifespan içinde başlatılan async background task. Her tick'te:
  - SCHEDULED → LIVE  (start zamanı geldiyse)
  - LIVE → ENDED      (bitiş zamanı geçtiyse; kazananı belirle, escrow oluştur)

MVP: tek-instance varsayımı. Multi-replica'ya geçince Redis lock veya tek
ayrılmış worker (örn. "scheduler" container'ı) gerekir — `RUN_SCHEDULER` env
flag'i ile o aşamada ayrılırız.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.auction import Auction, AuctionStatus
from app.models.bid import Bid
from app.models.escrow import EscrowTransaction
from app.models.watch import Watch, WatchStatus
from app.services import email_service
from app.utils.commission import compute_tiered_commission
from app.websockets.manager import manager

logger = logging.getLogger(__name__)

TICK_SECONDS = 30


async def _process_tick() -> tuple[
    list[tuple[str, dict[str, Any]]],
    list[Any],
]:
    """Tek tick: state geçişlerini DB'ye yaz, broadcast + email iş listesi döndür.

    Broadcast'i ve mail gönderimini commit'ten sonra yapıyoruz ki client'lar
    yalnızca kalıcılaşan state'i görsün ve mail içeriği gerçekten oluşan
    sonucu yansıtsın.

    `pending_emails`: çağrılmaya hazır awaitable'lar (coroutine objeleri).
    Loop, her birini fire-and-forget olarak başlatır.
    """
    pending_broadcasts: list[tuple[str, dict[str, Any]]] = []
    pending_emails: list[Any] = []

    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)

        # 1) SCHEDULED → LIVE
        scheduled = (
            await db.execute(
                select(Auction).where(
                    Auction.status == AuctionStatus.SCHEDULED,
                    Auction.starts_at <= now,
                )
            )
        ).scalars().all()

        for auction in scheduled:
            auction.status = AuctionStatus.LIVE
            logger.info("Auction %s started", auction.id)
            pending_broadcasts.append(
                (
                    str(auction.id),
                    {
                        "type": "auction.started",
                        "data": {"status": "live"},
                    },
                )
            )

        # 2) LIVE → ENDED (effective_end geçtiyse)
        # selectinload zinciri: auction.watch.seller'a kadar — async path'te
        # implicit lazy load `MissingGreenlet`e neden olur, email gönderimi
        # için satıcı kullanıcısı önden çekilmeli.
        live = (
            await db.execute(
                select(Auction)
                .options(
                    selectinload(Auction.watch).selectinload(Watch.seller)
                )
                .where(Auction.status == AuctionStatus.LIVE)
            )
        ).scalars().all()

        for auction in live:
            effective_end = auction.extended_until or auction.ends_at
            if effective_end > now:
                continue

            # Kazanan teklif — en yüksek tutar. `bidder` eager load —
            # winner email içeriği için ad/e-postaya ihtiyaç var.
            winning_bid = (
                await db.execute(
                    select(Bid)
                    .options(selectinload(Bid.bidder))
                    .where(Bid.auction_id == auction.id)
                    .order_by(Bid.amount.desc(), Bid.placed_at.asc())
                    .limit(1)
                )
            ).scalar_one_or_none()

            auction.status = AuctionStatus.ENDED

            sold = False
            final_price: Decimal | None = None

            if winning_bid is not None:
                # Reserve fiyatı kontrolü
                if (
                    auction.reserve_price is not None
                    and winning_bid.amount < auction.reserve_price
                ):
                    logger.info(
                        "Auction %s ended below reserve, no sale", auction.id
                    )
                    # Reserve altında — alıcı yok, satıcıya "yeniden listele"
                    # bilgisi gönderelim.
                    pending_emails.append(
                        email_service.send_auction_unsold_email(
                            user=auction.watch.seller,
                            watch_brand=auction.watch.brand,
                            watch_model=auction.watch.model,
                            auction_id=str(auction.id),
                        )
                    )
                else:
                    auction.winning_bid_id = winning_bid.id
                    final_price = winning_bid.amount
                    sold = True

                    # Saatin durumunu SOLD'a çek
                    auction.watch.status = WatchStatus.SOLD

                    # Escrow oluştur — tiered komisyon
                    fee, _ = compute_tiered_commission(winning_bid.amount)
                    escrow = EscrowTransaction(
                        auction_id=auction.id,
                        buyer_id=winning_bid.bidder_id,
                        seller_id=auction.watch.seller_id,
                        amount=winning_bid.amount,
                        platform_fee=fee,
                    )
                    db.add(escrow)
                    logger.info(
                        "Auction %s sold for %s", auction.id, winning_bid.amount
                    )

                    # Hem kazanan alıcıya hem satıcıya bildirim.
                    # `Bid.bidder` ve `Watch.seller` zaten lazy="joined" ile
                    # yüklü — ekstra sorgu yok.
                    amount_str = f"{winning_bid.amount:,.0f}".replace(",", ".")
                    pending_emails.append(
                        email_service.send_auction_won_email(
                            user=winning_bid.bidder,
                            watch_brand=auction.watch.brand,
                            watch_model=auction.watch.model,
                            amount=amount_str,
                            auction_id=str(auction.id),
                        )
                    )
                    pending_emails.append(
                        email_service.send_auction_sold_email(
                            user=auction.watch.seller,
                            watch_brand=auction.watch.brand,
                            watch_model=auction.watch.model,
                            amount=amount_str,
                            auction_id=str(auction.id),
                        )
                    )
            else:
                logger.info("Auction %s ended with no bids", auction.id)
                # Teklif yok — satıcıya yeniden listeleme bilgisi.
                pending_emails.append(
                    email_service.send_auction_unsold_email(
                        user=auction.watch.seller,
                        watch_brand=auction.watch.brand,
                        watch_model=auction.watch.model,
                        auction_id=str(auction.id),
                    )
                )

            pending_broadcasts.append(
                (
                    str(auction.id),
                    {
                        "type": "auction.ended",
                        "data": {
                            "sold": sold,
                            "final_price": (
                                str(final_price) if final_price is not None else None
                            ),
                            "winning_bid_id": (
                                str(winning_bid.id)
                                if sold and winning_bid is not None
                                else None
                            ),
                        },
                    },
                )
            )

        await db.commit()

    return pending_broadcasts, pending_emails


async def scheduler_loop() -> None:
    """Lifespan boyunca çalışan döngü. Hatalar yutulur ki tek bir tick
    crash'i loop'u öldürmesin."""
    logger.info("Auction scheduler started (tick=%ds)", TICK_SECONDS)
    while True:
        try:
            broadcasts, emails = await _process_tick()
            for room, message in broadcasts:
                await manager.broadcast(room, message)
            # Bildirim e-postaları — fire-and-forget; tek mailin patlaması
            # diğerlerini ve loop'u etkilemesin (email_service zaten
            # exception'ı log'layıp yutuyor).
            for coro in emails:
                asyncio.create_task(coro)
        except asyncio.CancelledError:
            logger.info("Auction scheduler stopping")
            raise
        except Exception:
            logger.exception("Scheduler tick failed")
        await asyncio.sleep(TICK_SECONDS)
