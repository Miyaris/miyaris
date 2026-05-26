"""Presenter (canlı müzayede sunucusu) DTO'ları.

Presenter yetkili kullanıcı kendi showcase'ini doğrudan oluşturur: aynı
formda hem saatin bilgileri hem müzayede penceresi (custom datetime + süre)
yer alır. Bu akış normal satıcı akışından farklıdır:

  * Sertifika/moderasyon adımı YOK — presenter zaten yetkilendirilmiş kabul
    edilir, ürünü direkt ACTIVE statüsünde listelenir.
  * AI valuation pipeline tetiklenmez (ai_processing_status=NONE).
  * Müzayede saatleri haftalık çark ile sınırlı değildir — kullanıcı kendi
    canlı yayını için spesifik tarih+saat girer.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    field_validator,
    model_validator,
)

from app.models.auction import AuctionStatus
from app.models.watch import WatchCondition


class PresenterShowcaseCreate(BaseModel):
    """Yeni canlı müzayede showcase'i — saat + müzayede bilgileri birleşik.

    Frontend formundan tek POST ile gönderilir; backend tek transaction'da
    önce Watch (ACTIVE statüde), sonra Auction (SCHEDULED) oluşturur.
    """

    # ----- Saat bilgileri ----------------------------------------------------
    brand: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=120)
    reference_number: str = Field(min_length=1, max_length=60)
    year: int = Field(ge=1900)
    condition: WatchCondition
    description: str = Field(min_length=20, max_length=4000)
    serial_number: str | None = Field(default=None, max_length=80)
    box_papers: bool = False
    image_urls: list[HttpUrl] = Field(min_length=1, max_length=12)

    # ----- Müzayede penceresi ------------------------------------------------
    # Presenter takvimden tarih+saat seçer; süre dakikadır.
    starts_at: datetime
    duration_minutes: int = Field(ge=5, le=240, default=30)
    starting_price: Decimal = Field(gt=0, decimal_places=2)
    min_bid_increment: Decimal = Field(
        default=Decimal("50"), gt=0, decimal_places=2
    )
    reserve_price: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    buy_it_now_price: Decimal | None = Field(default=None, gt=0, decimal_places=2)

    @field_validator("brand", "model", "reference_number")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Boş bırakılamaz")
        return v

    @field_validator("year")
    @classmethod
    def _validate_year(cls, v: int) -> int:
        current = datetime.now().year
        if v > current + 1:
            raise ValueError("Yıl gelecekte olamaz")
        return v

    @model_validator(mode="after")
    def _validate_prices(self):
        if (
            self.reserve_price is not None
            and self.reserve_price < self.starting_price
        ):
            raise ValueError("reserve_price >= starting_price olmalı")
        if (
            self.buy_it_now_price is not None
            and self.buy_it_now_price <= self.starting_price
        ):
            raise ValueError("buy_it_now_price > starting_price olmalı")
        return self

    @model_validator(mode="after")
    def _validate_timezone(self):
        # Frontend ISO 8601 + offset göndermeli; tz'siz datetime'ları
        # reddederek silent UTC-assumption hatalarını engelliyoruz.
        if self.starts_at.tzinfo is None:
            raise ValueError(
                "starts_at için saat dilimi belirtilmeli (ISO 8601 + offset)"
            )
        return self


class PresenterShowcaseListItem(BaseModel):
    """Presenter'ın hub sayfasındaki kendi showcase listesi için DTO."""

    model_config = ConfigDict(from_attributes=True)

    auction_id: uuid.UUID
    watch_id: uuid.UUID
    brand: str
    model: str
    reference_number: str
    primary_image_url: str | None = None
    starting_price: Decimal
    current_price: Decimal
    buy_it_now_price: Decimal | None = None
    starts_at: datetime
    ends_at: datetime
    extended_until: datetime | None = None
    status: AuctionStatus
    bid_count: int = 0
