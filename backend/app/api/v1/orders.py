"""Buyer ve seller'ın kendi escrow akışlarını gördüğü endpoint'ler."""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.escrow import EscrowTransaction
from app.models.user import User
from app.schemas.escrow import (
    EscrowDetail,
    EscrowListItem,
    FundRequest,
)
from app.services import escrow_service
from app.utils.pagination import PaginationParams, pagination_dep

router = APIRouter(tags=["orders"])


def _list_item(
    escrow: EscrowTransaction, counterparty: User
) -> EscrowListItem:
    images = escrow.auction.watch.images
    primary = next((i.url for i in images if i.is_primary), None) or (
        images[0].url if images else None
    )
    return EscrowListItem(
        id=escrow.id,
        auction_id=escrow.auction_id,
        watch_id=escrow.auction.watch.id,
        watch_brand=escrow.auction.watch.brand,
        watch_model=escrow.auction.watch.model,
        watch_image_url=primary,
        counterparty_name=counterparty.full_name,
        amount=escrow.amount,
        status=escrow.status,
        delivery_method=escrow.delivery_method,
        payment_method=escrow.payment_method,
        created_at=escrow.created_at,
    )


def _detail(escrow: EscrowTransaction, buyer: User, seller: User) -> EscrowDetail:
    images = escrow.auction.watch.images
    primary = next((i.url for i in images if i.is_primary), None) or (
        images[0].url if images else None
    )
    return EscrowDetail(
        id=escrow.id,
        auction_id=escrow.auction_id,
        watch_id=escrow.auction.watch.id,
        watch_brand=escrow.auction.watch.brand,
        watch_model=escrow.auction.watch.model,
        watch_reference=escrow.auction.watch.reference_number,
        watch_image_url=primary,
        watch_listing_type=escrow.auction.watch.listing_type,
        buyer_id=buyer.id,
        buyer_name=buyer.full_name,
        seller_id=seller.id,
        seller_name=seller.full_name,
        amount=escrow.amount,
        discount_amount=escrow.discount_amount,
        platform_fee=escrow.platform_fee,
        status=escrow.status,
        delivery_method=escrow.delivery_method,
        payment_method=escrow.payment_method,
        payment_provider_ref=escrow.payment_provider_ref,
        funded_at=escrow.funded_at,
        released_at=escrow.released_at,
        created_at=escrow.created_at,
        updated_at=escrow.updated_at,
    )


@router.get("/orders/me", response_model=list[EscrowListItem])
async def my_orders(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_dep),
):
    """Alıcının siparişleri (buyer = me)."""
    rows = await escrow_service.list_for_buyer(
        db, user, limit=pagination.limit, offset=pagination.offset
    )
    return [_list_item(e, seller) for e, seller in rows]


@router.get("/sales/me", response_model=list[EscrowListItem])
async def my_sales(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_dep),
):
    """Satıcının satışları (seller = me)."""
    rows = await escrow_service.list_for_seller(
        db, user, limit=pagination.limit, offset=pagination.offset
    )
    return [_list_item(e, buyer) for e, buyer in rows]


@router.get("/orders/{escrow_id}", response_model=EscrowDetail)
async def order_detail(
    escrow_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Buyer veya seller — kendi escrow detayı."""
    escrow, buyer, seller = await escrow_service.get_for_party(db, escrow_id, user)
    return _detail(escrow, buyer, seller)


@router.post("/orders/{escrow_id}/fund", response_model=EscrowDetail)
async def fund_escrow(
    escrow_id: uuid.UUID,
    payload: FundRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Buyer ödemeyi tamamladı — escrow FUNDED'a geçer."""
    await escrow_service.fund(db, escrow_id, user, payload)
    escrow, buyer, seller = await escrow_service.get_for_party(db, escrow_id, user)
    return _detail(escrow, buyer, seller)
