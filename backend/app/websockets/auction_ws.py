"""Açık artırma WebSocket endpoint'i — public read-only.

Akış:
  1. Client `/ws/auctions/{id}`'e bağlanır
  2. Sunucu hemen `snapshot` mesajı gönderir (mevcut fiyat, kalan süre, son N teklif)
  3. Sonrasında REST üzerinden teklif geldikçe veya scheduler bir açık artırmayı
     kapattıkça broadcast düşer

Client → Server mesajları yok (MVP). İlerideki "is_typing" gibi durum
göstergeleri için protokol genişletilebilir.
"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.bid import Bid
from app.services import auction_service
from app.utils.exceptions import APIError
from app.websockets.manager import manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


@router.websocket("/ws/auctions/{auction_id}")
async def auction_ws(
    websocket: WebSocket,
    auction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    room = str(auction_id)
    await manager.connect(room, websocket)

    try:
        # İlk snapshot
        try:
            auction = await auction_service.get_auction(db, auction_id)
            recent_bids = (
                await db.execute(
                    select(Bid)
                    .where(Bid.auction_id == auction_id)
                    .order_by(Bid.placed_at.desc())
                    .limit(20)
                )
            ).scalars().all()
            await websocket.send_json(
                {
                    "type": "snapshot",
                    "data": {
                        "current_price": str(auction.current_price),
                        "ends_at": auction.ends_at.isoformat(),
                        "extended_until": (
                            auction.extended_until.isoformat()
                            if auction.extended_until
                            else None
                        ),
                        "status": auction.status.value,
                        "bid_count": len(auction.bids),
                        "recent_bids": [
                            {
                                "id": str(b.id),
                                "bidder_name": b.bidder.full_name,
                                "amount": str(b.amount),
                                "placed_at": b.placed_at.isoformat(),
                                "is_proxy": b.is_proxy,
                            }
                            for b in recent_bids
                        ],
                    },
                }
            )
        except APIError:
            # Açık artırma bulunamadıysa hata gönder, bağlantıyı kapat
            await websocket.send_json(
                {"type": "error", "data": {"detail": "Açık artırma bulunamadı"}}
            )
            await websocket.close()
            return

        # Heart-beat / mesaj döngüsü — client mesajlarını yutuyoruz (MVP)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        logger.exception("WS error in room %s", room)
    finally:
        await manager.disconnect(room, websocket)
