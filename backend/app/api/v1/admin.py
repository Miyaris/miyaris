"""Admin/Expert moderasyon endpoint'leri.

Erişim: yalnızca rol = ADMIN veya EXPERT olan kullanıcılar (router-level).
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.escrow import EscrowStatus, EscrowTransaction
from app.schemas.admin import (
    AdminAuctionListItem,
    AdminKycSetRequest,
    AdminPresenterSetRequest,
    AdminSellerInfo,
    AdminUserListItem,
    AdminUserListResponse,
    AdminWatchDetail,
    AdminWatchListItem,
    CertificateCreate,
    CertificateOut,
    RejectRequest,
)
from app.schemas.escrow import EscrowDetail, EscrowListItem
from app.schemas.watch import AIValuationOut
from app.services import auction_service, escrow_service, moderation_service
from app.utils.exceptions import NotFoundError
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


@router.get("/watches/decided", response_model=list[AdminWatchListItem])
async def list_decided(
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_dep),
):
    """Geçmiş moderasyon — karar verilmiş saatler (ACTIVE/REJECTED).

    Sıralama: en son karar verilen üstte. Admin'in karar değişikliği için
    `POST /watches/{id}/revert` ile PENDING_REVIEW'a geri çekilebilir.
    """
    watches = await moderation_service.list_decided(
        db, limit=pagination.limit, offset=pagination.offset
    )
    return [_to_list_item(w) for w in watches]


@router.get("/watches/{watch_id}", response_model=AdminWatchDetail)
async def get_watch(watch_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    watch = await moderation_service.get_detail(db, watch_id)
    return _to_detail(watch)


@router.post("/watches/{watch_id}/revert", response_model=AdminWatchDetail)
async def revert_decision(
    watch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Karar geri al — saati ekspertiz kuyruğuna geri döndür.

    Sertifika silinir, satıcı banı (varsa) kaldırılır, statü PENDING_REVIEW.
    Sadece ACTIVE veya REJECTED saatler revert edilebilir; SOLD bloklanır.
    """
    await moderation_service.revert_to_pending(db, watch_id, user)
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


# ----- Kullanıcı yönetimi (ADMIN only — uzmanlar göremez) --------------------
# Router-level guard ADMIN+EXPERT'i geçiriyor; bu endpoint'in kendi guard'ı
# `require_role(UserRole.ADMIN)` ile kapsamı daraltıyor. EXPERT bu sayfaya
# 403 alır.


@router.get(
    "/users",
    response_model=AdminUserListResponse,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
async def list_users(
    page: PaginationParams = Depends(pagination_dep),
    db: AsyncSession = Depends(get_db),
):
    """Tüm kullanıcıları en yeni → eski sırasıyla sayfalı dön.

    Front-end tablosu için kompakt veri seti: id, isim, e-posta, rol,
    doğrulama/aktif/KYC durumları ve kayıt tarihi.

    `total` toplam kullanıcı sayısıdır (filtre yok); sayfalama UI'sini
    bunun üzerinden çiziyoruz.
    """
    total_result = await db.execute(select(func.count()).select_from(User))
    total = int(total_result.scalar_one())

    result = await db.execute(
        select(User)
        .order_by(User.created_at.desc())
        .limit(page.limit)
        .offset(page.offset)
    )
    users = result.scalars().all()

    return AdminUserListResponse(
        items=[AdminUserListItem.model_validate(u) for u in users],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.post(
    "/users/{user_id}/set-kyc",
    response_model=AdminUserListItem,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
async def set_user_kyc(
    user_id: uuid.UUID,
    payload: AdminKycSetRequest,
    db: AsyncSession = Depends(get_db),
):
    """Admin override — kullanıcının KYC bayrağını set'le.

    NVI_VERIFICATION_ENABLED=false iken kayıt olmuş kullanıcılar
    `kyc_verified=False` ile oluşur ve $3000+ teklif veremezler. Bu
    endpoint o kullanıcıları manuel onaylamak için kullanılır. Tersine
    çekmek için False geçilebilir.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise NotFoundError("Kullanıcı bulunamadı")
    user.kyc_verified = payload.kyc_verified
    await db.commit()
    await db.refresh(user)
    return AdminUserListItem.model_validate(user)


@router.post(
    "/users/{user_id}/set-presenter",
    response_model=AdminUserListItem,
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)
async def set_user_presenter(
    user_id: uuid.UUID,
    payload: AdminPresenterSetRequest,
    db: AsyncSession = Depends(get_db),
):
    """Admin override — kullanıcıya canlı müzayede sunucusu (Presenter) yetkisi
    verir veya geri çeker.

    Presenter yetkili hesaplar `/presenter/*` rotalarına erişebilir; teklif
    yönetimi ve canlı yayın paneli onlara açıktır. Yetki rol'den bağımsız —
    aynı admin paneli üzerinden buyer/expert/seller/admin herhangi bir hesaba
    verilebilir.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise NotFoundError("Kullanıcı bulunamadı")
    user.is_presenter = payload.is_presenter
    await db.commit()
    await db.refresh(user)
    return AdminUserListItem.model_validate(user)


# ----- Müzayede yönetimi (ADMIN + EXPERT) -----------------------------------


def _auction_list_item(auction) -> AdminAuctionListItem:
    watch = auction.watch
    primary = next((i.url for i in watch.images if i.is_primary), None) or (
        watch.images[0].url if watch.images else None
    )
    return AdminAuctionListItem(
        id=auction.id,
        watch_id=watch.id,
        brand=watch.brand,
        model=watch.model,
        reference_number=watch.reference_number,
        primary_image_url=primary,
        seller_name=watch.seller.full_name,
        seller_email=watch.seller.email,
        current_price=auction.current_price,
        starting_price=auction.starting_price,
        starts_at=auction.starts_at,
        ends_at=auction.ends_at,
        status=auction.status,
        is_hidden=auction.is_hidden,
        bid_count=len(auction.bids) if auction.bids else 0,
    )


@router.get("/auctions", response_model=list[AdminAuctionListItem])
async def list_admin_auctions(
    tab: str = "active",
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_dep),
):
    """Sekmeli müzayede listesi.

    Query param `tab`:
      * active (default) — SCHEDULED + LIVE, gizli olmayanlar
      * past             — ENDED + COMPLETED + CANCELLED, gizli olmayanlar
      * hidden           — admin tarafından sayfadan kaldırılmış olanlar
    """
    if tab not in ("active", "past", "hidden"):
        from app.utils.exceptions import APIError
        from fastapi import status as http_status
        raise APIError(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz tab — active/past/hidden olmalı",
        )
    auctions = await auction_service.list_admin_auctions(
        db, tab=tab, limit=pagination.limit, offset=pagination.offset
    )
    return [_auction_list_item(a) for a in auctions]


@router.post("/auctions/{auction_id}/hide", response_model=AdminAuctionListItem)
async def hide_auction(
    auction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Müzayedeyi sayfadan gizle (soft-hide). Public listelerden kaybolur,
    teklif geçmişi/escrow korunur. Admin paneli 'Gizli' sekmesinden geri
    getirilebilir."""
    auction = await auction_service.admin_set_hidden(db, auction_id, True)
    return _auction_list_item(auction)


@router.post(
    "/auctions/{auction_id}/unhide", response_model=AdminAuctionListItem
)
async def unhide_auction(
    auction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Gizlenmiş müzayedeyi public listelere geri getir."""
    auction = await auction_service.admin_set_hidden(db, auction_id, False)
    return _auction_list_item(auction)


@router.post(
    "/auctions/{auction_id}/move-to-current-week",
    response_model=AdminAuctionListItem,
)
async def move_auction_to_current_week(
    auction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Geç katılım — müzayedeyi bu haftanın penceresine çek.

    starts_at geçmişte olursa status anında LIVE'a çekilir, kullanıcı
    UI'de bekleme yaşamaz.
    """
    await auction_service.admin_move_to_current_week(db, auction_id)
    # Liste DTO için tekrar selectinload'lu fetch — bids/seller eager
    auctions = await auction_service.list_admin_scheduled(db, limit=200, offset=0)
    target = next((a for a in auctions if a.id == auction_id), None)
    if target is None:
        # Müzayede artık scheduled/live değil (eg. eş zamanlı state değişimi)
        # — yine de güncel detayı dön
        target = await auction_service.get_auction(db, auction_id)
    return _auction_list_item(target)


@router.post("/auctions/{auction_id}/cancel", response_model=AdminAuctionListItem)
async def admin_cancel_auction(
    auction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Admin iptal — satıcı sahiplik kontrolü atlanır, LIVE müzayede de
    iptal edilebilir. ENDED/COMPLETED bloklanır."""
    auction = await auction_service.admin_cancel(db, auction_id)
    return _auction_list_item(auction)
