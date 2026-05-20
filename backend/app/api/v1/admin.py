"""Admin/Expert moderasyon endpoint'leri.

Erişim: yalnızca rol = ADMIN veya EXPERT olan kullanıcılar (router-level).
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.escrow import EscrowStatus, EscrowTransaction
from app.schemas.admin import (
    AdminSellerInfo,
    AdminWatchDetail,
    AdminWatchListItem,
    CertificateCreate,
    CertificateOut,
    RejectRequest,
)
from app.schemas.escrow import EscrowDetail, EscrowListItem
from app.schemas.watch import AIValuationOut
from app.services import escrow_service, moderation_service
from app.utils.pagination import PaginationParams, pagination_dep

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_role(UserRole.ADMIN, UserRole.EXPERT))],
)


def _to_list_item(watch) -> AdminWatchListItem:
    primary = next((i.url for i in watch.images if i.is_primary), None) or (
        watch.images[0].url if watch.images else None
    )
    return AdminWatchListItem(
        id=watch.id,
        brand=watch.brand,
        model=watch.model,
        reference_number=watch.reference_number,
        year=watch.year,
        condition=watch.condition,
        status=watch.status,
        ai_processing_status=watch.ai_processing_status,
        seller_name=watch.seller.full_name,
        seller_email=watch.seller.email,
        primary_image_url=primary,
        has_valuation=bool(watch.valuations),
        created_at=watch.created_at,
    )


def _to_detail(watch) -> AdminWatchDetail:
    latest = (
        max(watch.valuations, key=lambda v: v.created_at)
        if watch.valuations
        else None
    )
    return AdminWatchDetail(
        id=watch.id,
        brand=watch.brand,
        model=watch.model,
        reference_number=watch.reference_number,
        year=watch.year,
        serial_number=watch.serial_number,
        box_papers=watch.box_papers,
        condition=watch.condition,
        description=watch.description,
        seo_description=watch.seo_description,
        slug=watch.slug,
        status=watch.status,
        ai_processing_status=watch.ai_processing_status,
        ai_processing_error=watch.ai_processing_error,
        images=watch.images,
        delivery_code=watch.delivery_code,
        created_at=watch.created_at,
        seller=AdminSellerInfo.model_validate(watch.seller),
        latest_valuation=AIValuationOut.model_validate(latest) if latest else None,
        has_certificate=watch.certificate is not None,
    )


@router.get("/watches/pending", response_model=list[AdminWatchListItem])
async def list_pending(
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_dep),
):
    watches = await moderation_service.list_pending(
        db, limit=pagination.limit, offset=pagination.offset
    )
    return [_to_list_item(w) for w in watches]


@router.get("/watches/{watch_id}", response_model=AdminWatchDetail)
async def get_watch(watch_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    watch = await moderation_service.get_detail(db, watch_id)
    return _to_detail(watch)


@router.post(
    "/watches/{watch_id}/certificate",
    response_model=CertificateOut,
    status_code=status.HTTP_201_CREATED,
)
async def issue_certificate(
    watch_id: uuid.UUID,
    payload: CertificateCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Fiziksel inceleme sonucu sertifika çıkar.

    AUTHENTIC/SERVICE_PARTS verdict → saat ACTIVE.
    NOT_AUTHENTIC/INCONCLUSIVE     → saat REJECTED.
    """
    _, cert = await moderation_service.issue_certificate(db, watch_id, user, payload)
    return CertificateOut.model_validate(cert)


@router.post("/watches/{watch_id}/reject", response_model=AdminWatchDetail)
async def reject_watch(
    watch_id: uuid.UUID,
    payload: RejectRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Sertifikasız doğrudan red (saat gelmedi, duplicate ilan vb.)."""
    await moderation_service.reject_watch(db, watch_id, user, payload)
    watch = await moderation_service.get_detail(db, watch_id)
    return _to_detail(watch)


# === Escrow yönetimi ===

def _escrow_list_item(
    escrow: EscrowTransaction, buyer: User, seller: User
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
        counterparty_name=f"{buyer.full_name} → {seller.full_name}",
        amount=escrow.amount,
        status=escrow.status,
        delivery_method=escrow.delivery_method,
        payment_method=escrow.payment_method,
        created_at=escrow.created_at,
    )


def _escrow_detail(
    escrow: EscrowTransaction, buyer: User, seller: User
) -> EscrowDetail:
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


@router.get("/escrow", response_model=list[EscrowListItem])
async def list_active_escrow(
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_dep),
):
    """Aktif escrow akışları (RELEASED/REFUNDED hariç)."""
    rows = await escrow_service.list_admin_active(
        db, limit=pagination.limit, offset=pagination.offset
    )
    return [_escrow_list_item(e, b, s) for e, b, s in rows]


@router.get("/escrow/{escrow_id}", response_model=EscrowDetail)
async def admin_escrow_detail(
    escrow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    escrow, buyer, seller = await escrow_service.get_admin(db, escrow_id)
    return _escrow_detail(escrow, buyer, seller)


# State geçiş action'ları — her biri spesifik expected_from gerektirir.
# URL pattern'leri operasyonel anlamı taşıyor (mark-received vs advance):

@router.post("/escrow/{escrow_id}/mark-received", response_model=EscrowDetail)
async def mark_received(escrow_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Saat fiziksel olarak Miyaris ofisine ulaştı: FUNDED → AWAITING_AUTHENTICATION."""
    await escrow_service.advance(db, escrow_id, EscrowStatus.FUNDED)
    escrow, buyer, seller = await escrow_service.get_admin(db, escrow_id)
    return _escrow_detail(escrow, buyer, seller)


@router.post("/escrow/{escrow_id}/authenticate", response_model=EscrowDetail)
async def authenticate(escrow_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Uzman doğrulamayı tamamladı: AWAITING_AUTHENTICATION → AUTHENTICATED."""
    await escrow_service.advance(
        db, escrow_id, EscrowStatus.AWAITING_AUTHENTICATION
    )
    escrow, buyer, seller = await escrow_service.get_admin(db, escrow_id)
    return _escrow_detail(escrow, buyer, seller)


@router.post("/escrow/{escrow_id}/mark-shipped", response_model=EscrowDetail)
async def mark_shipped(escrow_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Kargo alıcıya gönderildi: AUTHENTICATED → SHIPPED_TO_BUYER."""
    await escrow_service.advance(db, escrow_id, EscrowStatus.AUTHENTICATED)
    escrow, buyer, seller = await escrow_service.get_admin(db, escrow_id)
    return _escrow_detail(escrow, buyer, seller)


@router.post("/escrow/{escrow_id}/mark-delivered", response_model=EscrowDetail)
async def mark_delivered(escrow_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Kargo teslim edildi: SHIPPED_TO_BUYER → DELIVERED."""
    await escrow_service.advance(db, escrow_id, EscrowStatus.SHIPPED_TO_BUYER)
    escrow, buyer, seller = await escrow_service.get_admin(db, escrow_id)
    return _escrow_detail(escrow, buyer, seller)


@router.post("/escrow/{escrow_id}/release", response_model=EscrowDetail)
async def release_funds(escrow_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Para satıcıya release: DELIVERED → RELEASED. Akışın sonu."""
    await escrow_service.advance(db, escrow_id, EscrowStatus.DELIVERED)
    escrow, buyer, seller = await escrow_service.get_admin(db, escrow_id)
    return _escrow_detail(escrow, buyer, seller)


@router.post("/escrow/{escrow_id}/refund", response_model=EscrowDetail)
async def refund(escrow_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Terminal red — para alıcıya iade. RELEASED escrow için yapılamaz."""
    await escrow_service.refund(db, escrow_id)
    escrow, buyer, seller = await escrow_service.get_admin(db, escrow_id)
    return _escrow_detail(escrow, buyer, seller)
