import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from app.models.escrow import DeliveryMethod, PaymentMethod
from app.models.watch import (
    AIProcessingStatus,
    ListingType,
    WatchCondition,
    WatchStatus,
)
from app.utils.commission import compute_tiered_commission


class WatchImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    sort_order: int
    is_primary: bool


class WatchBase(BaseModel):
    brand: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=120)
    reference_number: str = Field(min_length=1, max_length=60)
    # Year ZORUNLU — AI değerlemesinin birincil kriteri
    year: int = Field(
        ge=1900,
        le=2100,
        description="Üretim yılı — değerleme için zorunlu",
    )
    serial_number: str | None = Field(default=None, max_length=80)
    box_papers: bool = False
    condition: WatchCondition
    description: str = Field(min_length=10)


class WatchCreate(WatchBase):
    image_urls: list[HttpUrl] = Field(default_factory=list, max_length=20)
    # Yeni: ilan tipi (DIRECT_SALE veya AUCTION) — workflow buna göre yönlenir.
    listing_type: ListingType = Field(default=ListingType.AUCTION)
    # DIRECT_SALE için zorunlu (satıcının asking price'ı). AUCTION'da kullanılmaz
    # (fiyat Auction tablosunda yönetilir); ama widget için ortak tutuluyor.
    asking_price: Decimal | None = Field(default=None, gt=0, decimal_places=2)


class WatchUpdate(BaseModel):
    brand: str | None = Field(default=None, min_length=1, max_length=80)
    model: str | None = Field(default=None, min_length=1, max_length=120)
    year: int | None = Field(default=None, ge=1900, le=2100)
    serial_number: str | None = None
    box_papers: bool | None = None
    condition: WatchCondition | None = None
    description: str | None = None


class WatchPublic(WatchBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    seller_id: uuid.UUID
    slug: str
    status: WatchStatus
    listing_type: ListingType = ListingType.AUCTION
    asking_price: Decimal | None = None
    ai_processing_status: AIProcessingStatus
    seo_description: str | None = None
    images: list[WatchImageOut] = Field(default_factory=list)
    created_at: datetime


class CommissionBreakdown(BaseModel):
    """Tiered komisyon hesabı — frontend widget ile aynı sonuç."""

    amount: Decimal
    commission_amount: Decimal
    net_payout: Decimal

    @classmethod
    def for_amount(cls, amount: Decimal) -> "CommissionBreakdown":
        commission, net = compute_tiered_commission(amount)
        return cls(
            amount=amount.quantize(Decimal("0.01")),
            commission_amount=commission,
            net_payout=net,
        )


class AIValuationOut(BaseModel):
    """AI ajanın ürettiği piyasa değerlemesi — sahibe gösterilen detay."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    estimated_value_min: Decimal
    estimated_value_max: Decimal
    confidence_score: float
    sources: dict[str, Any] = Field(default_factory=dict)
    agent_version: str
    raw_output: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class DirectBuyRequest(BaseModel):
    """Miyaris Mağaza — DIRECT_SALE saat için tek tık satın alma payload'u.

    Alıcı teslimat ve ödeme yöntemini seçer; escrow buy_direct_sale akışında
    bu seçimlerle oluşur.
    """

    delivery_method: DeliveryMethod
    payment_method: PaymentMethod


class WatchOwnerDetail(WatchPublic):
    """Sahip için zenginleştirilmiş saat detayı.

    Public WatchPublic + (a) AI processing hata mesajı, (b) en son AI valuation,
    (c) partner-mağaza fiziksel teslimat kodu. Açık artırma sayfasındaki public
    DTO'da yok — burası `/api/v1/watches/me/{id}` endpoint'inin response'u.
    """

    ai_processing_error: str | None = None
    latest_valuation: AIValuationOut | None = None
    delivery_code: str | None = None
