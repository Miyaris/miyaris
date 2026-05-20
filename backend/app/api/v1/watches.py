import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.escrow import EscrowDetail
from app.schemas.watch import (
    AIValuationOut,
    DirectBuyRequest,
    WatchCreate,
    WatchOwnerDetail,
    WatchPublic,
    WatchUpdate,
)
from app.services import escrow_service, watch_service
from app.utils.pagination import PaginationParams, pagination_dep

router = APIRouter(prefix="/watches", tags=["watches"])


@router.post("", response_model=WatchPublic, status_code=status.HTTP_201_CREATED)
async def create_watch(
    payload: WatchCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Yeni saat ilanı oluştur. Status: PENDING_REVIEW (admin onayı bekliyor)."""
    return await watch_service.create_watch(db, user, payload)


@router.get("/marketplace", response_model=list[WatchPublic])
async def marketplace_direct_sales(
    brand: str | None = None,
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_dep),
):
    """Vitrin — ACTIVE durumda DIRECT_SALE saatler. Public, auth gerekmez."""
    return await watch_service.list_marketplace_direct_sales(
        db, brand=brand, limit=pagination.limit, offset=pagination.offset
    )


@router.get("/me", response_model=list[WatchPublic])
async def my_watches(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_dep),
):
    """Giriş yapan kullanıcının kendi saatleri (özet, AI valuation yok)."""
    return await watch_service.list_my_watches(
        db, user, pagination.limit, pagination.offset
    )


@router.get("/me/{watch_id}", response_model=WatchOwnerDetail)
async def my_watch_detail(
    watch_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sahibi için saat detayı — AI valuation, processing error vb. zenginleştirilmiş."""
    watch, latest = await watch_service.get_my_watch_detail(db, watch_id, user)
    return WatchOwnerDetail(
        **{
            "id": watch.id,
            "seller_id": watch.seller_id,
            "brand": watch.brand,
            "model": watch.model,
            "reference_number": watch.reference_number,
            "year": watch.year,
            "serial_number": watch.serial_number,
            "box_papers": watch.box_papers,
            "condition": watch.condition,
            "description": watch.description,
            "slug": watch.slug,
            "status": watch.status,
            "ai_processing_status": watch.ai_processing_status,
            "ai_processing_error": watch.ai_processing_error,
            "seo_description": watch.seo_description,
            "images": watch.images,
            "created_at": watch.created_at,
            "delivery_code": watch.delivery_code,
            "latest_valuation": (
                AIValuationOut.model_validate(latest) if latest else None
            ),
        }
    )


@router.get("/by-slug/{slug}", response_model=WatchPublic)
async def get_watch_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    """Slug ile saat detayı (public) — Miyaris Mağaza listing'leri için."""
    return await watch_service.get_watch_by_slug(db, slug)


@router.post(
    "/{watch_id}/buy",
    response_model=EscrowDetail,
    status_code=status.HTTP_201_CREATED,
)
async def buy_direct_sale(
    watch_id: uuid.UUID,
    payload: DirectBuyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Miyaris Mağaza — DIRECT_SALE saat için satın alma akışı.

    Watch ACTIVE → AWAITING_EXPERTISE, yeni PENDING_PAYMENT escrow oluşturur.
    """
    _, escrow = await watch_service.buy_direct_sale(
        db,
        watch_id,
        user,
        delivery_method=payload.delivery_method,
        payment_method=payload.payment_method,
    )
    # Tek query ile zenginleştirilmiş escrow + karşı taraf — watch alanları
    # (brand/model/reference/image) eager-load edilir.
    escrow_full, buyer, seller = await escrow_service.get_for_party(
        db, escrow.id, user
    )
    return _serialize_escrow_detail(escrow_full, buyer, seller)


def _serialize_escrow_detail(escrow, buyer, seller) -> dict:
    """EscrowDetail response payload — watch alanları eager-load'tan beslenir."""
    watch = escrow.auction.watch if escrow.auction else None
    primary_image = None
    if watch and watch.images:
        primary = next((i for i in watch.images if i.is_primary), None)
        primary_image = (primary or watch.images[0]).url
    return {
        "id": escrow.id,
        "auction_id": escrow.auction_id,
        "watch_id": watch.id if watch else None,
        "watch_brand": watch.brand if watch else "",
        "watch_model": watch.model if watch else "",
        "watch_reference": watch.reference_number if watch else "",
        "watch_image_url": primary_image,
        "watch_listing_type": watch.listing_type if watch else None,
        "buyer_id": escrow.buyer_id,
        "buyer_name": buyer.full_name,
        "seller_id": escrow.seller_id,
        "seller_name": seller.full_name,
        "amount": str(escrow.amount),
        "discount_amount": str(escrow.discount_amount),
        "platform_fee": str(escrow.platform_fee),
        "status": escrow.status,
        "delivery_method": escrow.delivery_method,
        "payment_method": escrow.payment_method,
        "payment_provider_ref": escrow.payment_provider_ref,
        "funded_at": escrow.funded_at,
        "released_at": escrow.released_at,
        "created_at": escrow.created_at,
        "updated_at": escrow.updated_at,
    }


@router.get("/{watch_id}", response_model=WatchPublic)
async def get_watch(watch_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Saat detayı (public)."""
    return await watch_service.get_watch(db, watch_id)


@router.patch("/{watch_id}", response_model=WatchPublic)
async def update_watch(
    watch_id: uuid.UUID,
    payload: WatchUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Saat güncelle (sadece sahibi, sadece DRAFT/PENDING_REVIEW statüsünde)."""
    return await watch_service.update_watch(db, watch_id, user, payload)
