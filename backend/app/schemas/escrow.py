"""Escrow (emanet) DTO'lar."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.escrow import DeliveryMethod, EscrowStatus, PaymentMethod
from app.models.watch import ListingType


class EscrowListItem(BaseModel):
    """Buyer/seller listesi için hafif DTO."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    auction_id: uuid.UUID
    watch_id: uuid.UUID
    watch_brand: str
    watch_model: str
    watch_image_url: str | None = None
    counterparty_name: str
    amount: Decimal
    status: EscrowStatus
    delivery_method: DeliveryMethod | None = None
    payment_method: PaymentMethod | None = None
    created_at: datetime


class EscrowDetail(BaseModel):
    """Tam escrow detayı + iki taraf bilgisi (admin görür; buyer/seller kısıtlı).

    Fiyat alanları: `amount` = standart fiyat (kredi kartı / pre-discount).
    `discount_amount` BANK_TRANSFER seçildiyse %2.5 EFT indirimi tutarı.
    Alıcının fiilen ödediği = `amount - discount_amount`.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    auction_id: uuid.UUID
    watch_id: uuid.UUID
    watch_brand: str
    watch_model: str
    watch_reference: str
    watch_image_url: str | None
    # Frontend timeline copy'sini akışa göre değiştirmek için.
    watch_listing_type: ListingType = ListingType.AUCTION
    buyer_id: uuid.UUID
    buyer_name: str
    seller_id: uuid.UUID
    seller_name: str
    amount: Decimal              # Standart fiyat (pre-discount)
    discount_amount: Decimal     # EFT indirimi tutarı (0 = indirim yok)
    platform_fee: Decimal
    status: EscrowStatus
    delivery_method: DeliveryMethod | None
    payment_method: PaymentMethod | None
    payment_provider_ref: str | None
    funded_at: datetime | None
    released_at: datetime | None
    # Sahtekarlik onleme alanlari
    seller_seal_photo_url: str | None = None
    seller_seal_uploaded_at: datetime | None = None
    buyer_unboxing_video_url: str | None = None
    buyer_unboxing_uploaded_at: datetime | None = None
    seal_intact: bool | None = None
    created_at: datetime
    updated_at: datetime


class SellerSealUpload(BaseModel):
    """Satici muhurlu kutu fotografi URL'i yukler (kargo oncesi).

    Vercel Blob yuklendikten sonra donen public URL bu uca POST edilir.
    """

    photo_url: str = Field(min_length=10, max_length=600)


class BuyerUnboxingUpload(BaseModel):
    """Alici paket acma videosu + muhur durumu beyan eder (teslim sonrasi).

    seal_intact False ise escrow DISPUTED durumuna gecer; iade akisi
    backend tarafindan otomatik baslar.
    """

    video_url: str = Field(min_length=10, max_length=600)
    seal_intact: bool = Field(
        description="True = muhur saglam (akis devam), "
        "False = muhur kirik (iade akisi tetiklenir)"
    )


class FundRequest(BaseModel):
    """Auction kazanan alıcısı ödemeyi tamamlar. Hem teslimat hem ödeme
    yöntemi zorunlu."""

    delivery_method: DeliveryMethod = Field(
        description="SHIPPING (sigortalı kargo) veya STORE_PICKUP (mağazadan teslim)"
    )
    payment_method: PaymentMethod = Field(
        description="CREDIT_CARD veya BANK_TRANSFER (%2.5 EFT indirimi)"
    )
    payment_provider_ref: str | None = Field(default=None, max_length=120)


class BuyNowRequest(BaseModel):
    """Hemen Al akışı — alıcı escrow oluşurken her iki seçimi de yapar."""

    delivery_method: DeliveryMethod
    payment_method: PaymentMethod


class StateAdvanceRequest(BaseModel):
    """Admin/Expert escrow state'ini ilerletir."""

    note: str | None = Field(default=None, max_length=500)
