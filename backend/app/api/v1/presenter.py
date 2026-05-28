"""Presenter (canlı müzayede sunucusu) endpoint'leri.

Tüm endpoint'ler `get_current_presenter` dependency'si ile router seviyesinde
korunur — `is_presenter=False` olan kullanıcı 403 alır. Aksiyon endpoint'leri
ek ownership kontrolü yapar (auction.watch.seller_id == user.id), böylece
bir presenter başka birinin showcase'ine müdahale edemez.

Endpoint'ler:
  * POST /showcases            — yeni showcase (saat + müzayede tek transaction)
  * GET  /showcases            — kendi showcase listesi (hub için)
  * POST /showcases/{id}/extend — +30sn (extended_until bumplar)
  * POST /showcases/{id}/sell   — SATTIM! anında bitir + escrow
"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_presenter
from app.models.user import User
from app.schemas.presenter import (
    PresenterShowcaseCreate,
    PresenterShowcaseListItem,
)
from app.services import auction_service, presenter_service
from app.utils.pagination import PaginationParams, pagination_dep
from app.websockets.manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/presenter",
    tags=["presenter"],
    dependencies=[Depends(get_current_presenter)],
)


class ExtendRequest(BaseModel):
    seconds: int = Field(default=30, ge=1, le=600)


def _to_list_item(auction) -> PresenterShowcaseListItem:
    images = auction.watch.images
    primary = next((i.url for i in images if i.is_primary), None) or (
        images[0].url if images else None
    )
    return PresenterShowcaseListItem(
        auction_id=auction.id,
        watch_id=auction.watch.id,
        brand=auction.watch.brand,
        model=auction.watch.model,
        reference_number=auction.watch.reference_number,
        primary_image_url=primary,
        starting_price=auction.starting_price,
        current_price=auction.current_price,
        buy_it_now_price=auction.buy_it_now_price,
        starts_at=auction.starts_at,
        ends_at=auction.ends_at,
        extended_until=auction.extended_until,
        status=auction.status,
        bid_count=(
            len(auction.bids) if hasattr(auction, "bids") and auction.bids else 0
        ),
    )


@router.post(
    "/showcases",
    response_model=PresenterShowcaseListItem,
    status_code=status.HTTP_201_CREATED,
)
async def create_showcase(
    payload: PresenterShowcaseCreate,
    user: User = Depends(get_current_presenter),
    db: AsyncSession = Depends(get_db),
):
    """Yeni canlı müzayede showcase'i — ürün + müzayede penceresi birlikte."""
    auction = await presenter_service.create_showcase(db, user, payload)
    # Yeni oluşturulan auction'ı list item DTO'suna çevirmek için images'ı
    # yeniden eager-load et (commit'ten sonra refresh edildi, ama list_item
    # zinciri images'ı bekliyor).
    auction = await auction_service.get_auction(db, auction.id)
    return _to_list_item(auction)


@router.get("/showcases", response_model=list[PresenterShowcaseListItem])
async def list_showcases(
    user: User = Depends(get_current_presenter),
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_dep),
):
    """Bu presenter'ın açtığı tüm yayınlar — hub sayfası besler."""
    auctions = await presenter_service.list_my_showcases(
        db, user, limit=pagination.limit, offset=pagination.offset
    )
    return [_to_list_item(a) for a in auctions]


@router.get(
    "/showcases/{auction_id}", response_model=PresenterShowcaseListItem
)
async def get_showcase(
    auction_id: uuid.UUID,
    user: User = Depends(get_current_presenter),
    db: AsyncSession = Depends(get_db),
):
    """Tek yayın detayı — ownership doğrulanır.

    Live sunucu ekranı (`/presenter/live/{id}`) bu endpoint'i kullanır.
    Sahibi olmayan presenter erişirse 403; var olmayan id için 404.
    """
    auction = await presenter_service.get_my_showcase(db, auction_id, user)
    return _to_list_item(auction)


@router.post(
    "/showcases/{auction_id}/extend",
    response_model=PresenterShowcaseListItem,
)
async def extend_showcase(
    auction_id: uuid.UUID,
    payload: ExtendRequest = ExtendRequest(),
    user: User = Depends(get_current_presenter),
    db: AsyncSession = Depends(get_db),
):
    """Süre ekle (+saniye). LIVE müzayedeler için; ownership zorunlu."""
    auction = await presenter_service.extend_auction(
        db, auction_id, user, seconds=payload.seconds
    )

    # WS broadcast — dinleyenler yeni extended_until'i alır
    await manager.broadcast(
        str(auction_id),
        {
            "type": "bid.placed",  # Mevcut auction.* event'ini kullan
            "data": {
                "auction": {
                    "current_price": str(auction.current_price),
                    "extended_until": (
                        auction.extended_until.isoformat()
                        if auction.extended_until
                        else None
                    ),
                    "bid_count": len(auction.bids) if auction.bids else 0,
                    "status": auction.status.value,
                },
            },
        },
    )

    # Reload with images for DTO
    auction = await auction_service.get_auction(db, auction_id)
    return _to_list_item(auction)


@router.post(
    "/showcases/{auction_id}/sell",
    response_model=PresenterShowcaseListItem,
)
async def finalize_showcase(
    auction_id: uuid.UUID,
    user: User = Depends(get_current_presenter),
    db: AsyncSession = Depends(get_db),
):
    """SATTIM! — müzayedeyi anında bitir + en yüksek teklifle escrow."""
    auction, escrow = await presenter_service.finalize_sale(db, auction_id, user)

    # WS broadcast — alıcılar/izleyiciler "auction.ended" mesajı alır
    await manager.broadcast(
        str(auction_id),
        {
            "type": "auction.ended",
            "data": {
                "sold": escrow is not None,
                "final_price": (
                    str(auction.current_price) if escrow is not None else None
                ),
                "winning_bid_id": (
                    str(auction.winning_bid_id) if auction.winning_bid_id else None
                ),
                "via_presenter": True,
            },
        },
    )

    auction = await auction_service.get_auction(db, auction_id)
    return _to_list_item(auction)
