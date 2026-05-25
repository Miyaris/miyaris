"""Admin/Expert moderasyon paneli için DTO'lar."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl

from app.models.auction import AuctionStatus
from app.models.certificate import AuthenticityVerdict
from app.models.user import UserRole
from app.models.watch import AIProcessingStatus, WatchCondition, WatchStatus
from app.schemas.watch import AIValuationOut, WatchImageOut


class AdminSellerInfo(BaseModel):
    """Admin'in moderasyon kararını verirken görmesi gereken satıcı bilgisi."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    kyc_verified: bool


class AdminWatchListItem(BaseModel):
    """Onay kuyruğundaki saatler için hafif liste DTO'su."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    brand: str
    model: str
    reference_number: str
    year: int | None
    condition: WatchCondition
    status: WatchStatus
    ai_processing_status: AIProcessingStatus
    seller_name: str
    seller_email: str
    primary_image_url: str | None
    has_valuation: bool
    created_at: datetime


class AdminWatchDetail(BaseModel):
    """Saat detayı + satıcı + AI valuation. Moderasyon kararı için."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    brand: str
    model: str
    reference_number: str
    year: int | None
    serial_number: str | None
    box_papers: bool
    condition: WatchCondition
    description: str
    seo_description: str | None
    slug: str
    status: WatchStatus
    ai_processing_status: AIProcessingStatus
    ai_processing_error: str | None
    images: list[WatchImageOut]
    created_at: datetime
    seller: AdminSellerInfo
    latest_valuation: AIValuationOut | None
    has_certificate: bool
    delivery_code: str | None = None


class CertificateCreate(BaseModel):
    """Uzmanın fiziksel inceleme sonucunu kaydı. AUTHENTIC/SERVICE_PARTS →
    saat ACTIVE; NOT_AUTHENTIC/INCONCLUSIVE → REJECTED."""

    verdict: AuthenticityVerdict
    notes: str = Field(min_length=10, max_length=4000)
    pdf_url: HttpUrl


class CertificateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    watch_id: uuid.UUID
    expert_id: uuid.UUID
    verdict: AuthenticityVerdict
    notes: str
    pdf_url: str
    issued_at: datetime


class RejectRequest(BaseModel):
    """Sertifikasız doğrudan red — örn. saat fiziksel gelmemiş, duplicate ilan."""

    reason: str = Field(min_length=10, max_length=1000)


# ----- Kullanıcı yönetimi -----------------------------------------------------


class AdminUserListItem(BaseModel):
    """Admin panelindeki kullanıcı tablosu için kompakt DTO."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: EmailStr
    role: UserRole
    is_verified: bool
    is_active: bool
    kyc_verified: bool
    created_at: datetime


class AdminUserListResponse(BaseModel):
    """Sayfalanmış kullanıcı listesi — items + toplam sayım."""

    items: list[AdminUserListItem]
    total: int
    limit: int
    offset: int


class AdminKycSetRequest(BaseModel):
    """Admin override: kullanıcının KYC bayrağını manuel set'le.

    NVI_VERIFICATION_ENABLED=false iken kayıt olmuş kullanıcıları (kyc_verified=False)
    $3000+ teklif verebilmesi için elle onaylamak amacıyla kullanılır.
    Tersi de mümkün — KYC'yi geri çekmek için False geçilebilir.
    """

    kyc_verified: bool


# ----- Müzayede yönetimi ------------------------------------------------------


class AdminAuctionListItem(BaseModel):
    """Admin paneli için müzayede tablosu satırı.

    Saat + satıcı + zaman penceresi + mevcut fiyat. "Bu Hafta'ya Çek"
    veya "İptal" aksiyonları için yeterli bilgi.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    watch_id: uuid.UUID
    brand: str
    model: str
    reference_number: str
    primary_image_url: str | None
    seller_name: str
    seller_email: str
    current_price: Decimal
    starting_price: Decimal
    starts_at: datetime
    ends_at: datetime
    status: AuctionStatus
    bid_count: int = 0
