import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.auction import Auction, AuctionStatus
from app.models.user import User
from app.schemas.auction import (
    AuctionCreate,
    AuctionListItem,
    AuctionPublic,
    AuctionUpdate,
    MyAuctionParticipation,
)
from app.schemas.bid import BidCreate, BidPublic
from app.schemas.escrow import BuyNowRequest
from app.services import auction_service, bid_service
from app.utils.pagination import PaginationParams, pagination_dep
from app.websockets.manager import manager

router = APIRouter(prefix="/auctions", tags=["auctions"])


def _to_public(auction: Auction, bid_count: int) -> AuctionPublic:
    """Auction ORM nesnesini AuctionPublic DTO'ya çevirir (bid_count manuel)."""
    return AuctionPublic.model_validate(
        {
            "id": auction.id,
            "watch": auction.watch,
            "starting_price": auction.starting_price,
            "reserve_price": auction.reserve_price,
            "buy_it_now_price": auction.buy_it_now_price,
            "min_bid_increment": auction.min_bid_increment,
            "current_price": auction.current_price,
            "starts_at": auction.starts_at,
            "ends_at": auction.ends_at,
            "extended_until": auction.extended_until,
            "status": auction.status,
            "bid_count": bid_count,
        }
    )


@router.post("", response_model=AuctionPublic, status_code=status.HTTP_201_CREATED)
async def create_auction(
    payload: AuctionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Saat sahibi yeni açık artırma oluşturur (saatin ACTIVE statüsünde olması şart)."""
    auction = await auction_service.create_auction(db, user, payload)
    return _to_public(auction, bid_count=0)


@router.get("", response_model=list[AuctionListItem])
async def list_auctions(
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_dep),
    status_filter: AuctionStatus | None = None,
    brand: str | None = None,
):
    """Açık artırma listesi (public). Status ve marka filtresi opsiyonel."""
    auctions = await auction_service.list_auctions(
        db,
        status=status_filter,
        brand=brand,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    items: list[AuctionListItem] = []
    for a in auctions:
        primary_img = next(
            (img.url for img in a.watch.images if img.is_primary), None
        )
        if not primary_img and a.watch.images:
            primary_img = a.watch.images[0].url
        items.append(
            AuctionListItem(
                id=a.id,
                watch_id=a.watch.id,
                brand=a.watch.brand,
                model=a.watch.model,
                current_price=a.current_price,
                buy_it_now_price=a.buy_it_now_price,
                ends_at=a.ends_at,
                status=a.status,
                primary_image_url=primary_img,
            )
        )
    return items


@router.get("/me/bids", response_model=list[MyAuctionParticipation])
async def my_bids(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_dep),
):
    """Kullanıcının teklif verdiği açık artırmaların özeti — leading durumuyla."""
    items = await auction_service.list_my_participations(
        db, user, limit=pagination.limit, offset=pagination.offset
    )
    return [MyAuctionParticipation(**i) for i in items]


@router.get("/{auction_id}", response_model=AuctionPublic)
async def get_auction(auction_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    auction = await auction_service.get_auction(db, auction_id)
    bid_count = await auction_service.count_bids(db, auction_id)
    return _to_public(auction, bid_count)


@router.patch("/{auction_id}", response_model=AuctionPublic)
async def update_auction(
    auction_id: uuid.UUID,
    payload: AuctionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sadece SCHEDULED statüsündeki açık artırma güncellenebilir."""
    auction = await auction_service.update_auction(db, auction_id, user, payload)
    bid_count = await auction_service.count_bids(db, auction_id)
    return _to_public(auction, bid_count)


@router.post("/{auction_id}/cancel", response_model=AuctionPublic)
async def cancel_auction(
    auction_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    auction = await auction_service.cancel_auction(db, auction_id, user)
    bid_count = await auction_service.count_bids(db, auction_id)
    return _to_public(auction, bid_count)


@router.post("/{auction_id}/buy-now", response_model=AuctionPublic)
async def buy_it_now(
    auction_id: uuid.UUID,
    payload: BuyNowRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """'Hemen Al' — açık artırma bitişini beklemeden anında satın al.

    Alıcı body'de teslimat ve ödeme yöntemini gönderir. BANK_TRANSFER seçilirse
    EFT indirimi (%2.5) otomatik uygulanır.
    """
    auction, _escrow = await auction_service.buy_now(
        db,
        auction_id,
        user,
        delivery_method=payload.delivery_method,
        payment_method=payload.payment_method,
    )
    bid_count = await auction_service.count_bids(db, auction_id)

    # WS broadcast — diğer dinleyiciler "auction.ended" mesajını alır
    await manager.broadcast(
        str(auction_id),
        {
            "type": "auction.ended",
            "data": {
                "sold": True,
                "final_price": str(auction.buy_it_now_price),
                "winning_bid_id": None,
                "via_buy_now": True,
            },
        },
    )

    return _to_public(auction, bid_count)


@router.post(
    "/{auction_id}/bids",
    response_model=BidPublic,
    status_code=status.HTTP_201_CREATED,
)
async def place_bid(
    auction_id: uuid.UUID,
    payload: BidCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Teklif ver. Başarı sonrası WebSocket'e canlı yayın düşer."""
    bid = await bid_service.place_bid(db, auction_id, user, payload)

    # bid_service auction.current_price ve extended_until'ı güncelledi.
    # Yeni state'i odadaki tüm dinleyicilere yay.
    auction = await auction_service.get_auction(db, auction_id)
    bid_count = await auction_service.count_bids(db, auction_id)

    await manager.broadcast(
        str(auction_id),
        {
            "type": "bid.placed",
            "data": {
                "bid": {
                    "id": str(bid.id),
                    "bidder_name": user.full_name,
                    "amount": str(bid.amount),
                    "placed_at": bid.placed_at.isoformat(),
                    "is_proxy": bid.is_proxy,
                },
                "auction": {
                    "current_price": str(auction.current_price),
                    "extended_until": (
                        auction.extended_until.isoformat()
                        if auction.extended_until
                        else None
                    ),
                    "bid_count": bid_count,
                    "status": auction.status.value,
                },
            },
        },
    )

    return BidPublic(
        id=bid.id,
        auction_id=bid.auction_id,
        bidder_id=bid.bidder_id,
        bidder_name=user.full_name,
        amount=bid.amount,
        placed_at=bid.placed_at,
        is_proxy=bid.is_proxy,
    )


@router.get("/{auction_id}/bids", response_model=list[BidPublic])
async def list_bids(auction_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    bids = await bid_service.list_bids_for_auction(db, auction_id)
    return [
        BidPublic(
            id=b.id,
            auction_id=b.auction_id,
            bidder_id=b.bidder_id,
            bidder_name=b.bidder.full_name,
            amount=b.amount,
            placed_at=b.placed_at,
            is_proxy=b.is_proxy,
        )
        for b in bids
    ]
