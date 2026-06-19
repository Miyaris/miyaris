"""Presenter (canlı müzayede sunucusu) DTO'ları — oturum modeli.

Yeni mental model:
  * Presenter bir OTURUM açar (PresenterSession): ad, başlangıç saati,
    açıklama.
  * Oturuma bir veya daha çok SAAT LOT'u ekler (Watch + Auction birleşik).
  * Saatler oturum içinde sırayla canlı yayınlanır — bir lot biter, sıradaki
    LIVE'a geçer. Public /auctions sayfası oturumu tek kart olarak gösterir.
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
from app.models.presenter_session import PresenterSessionStatus
from app.models.watch import WatchCondition


# ============================================================================
# Oturum (Session) DTO'ları
# ============================================================================


class PresenterSessionCreate(BaseModel):
    """Yeni oturum oluşturma payload'u.

    Saat eklemesi ayrı endpoint'le yapılır (add-lot).
    """

    name: str = Field(min_length=3, max_length=160)
    scheduled_at: datetime
    description: str | None = Field(default=None, max_length=4000)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Oturum adı boş olamaz")
        return v

    @model_validator(mode="after")
    def _validate_tz(self):
        if self.scheduled_at.tzinfo is None:
            raise ValueError(
                "scheduled_at için saat dilimi belirtilmeli (ISO 8601 + offset)"
            )
        return self


class PresenterSessionUpdate(BaseModel):
    """Mevcut oturumun düzenlenebilir alanları.

    Sadece PLANNING durumundaki oturumlar değiştirilebilir; LIVE oturumun
    saatini değiştirmek anti-sniping ve teklif takibini bozar.
    """

    name: str | None = Field(default=None, min_length=3, max_length=160)
    scheduled_at: datetime | None = None
    description: str | None = Field(default=None, max_length=4000)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("Oturum adı boş olamaz")
        return v

    @model_validator(mode="after")
    def _validate_tz(self):
        if self.scheduled_at is not None and self.scheduled_at.tzinfo is None:
            raise ValueError(
                "scheduled_at için saat dilimi belirtilmeli (ISO 8601 + offset)"
            )
        return self


class PresenterLotCreate(BaseModel):
    """Mevcut bir oturuma saat lot'u ekleme payload'u.

    Watch alanları + auction taban parametreleri tek POST'ta. starts_at/ends_at
    burada YOK — lot'lar oturum içinde canlı sıralanır, ayrı zaman penceresi
    tutmaz. Süre presenter ekranından canlıda yönetilir.
    """

    # Saat bilgileri
    brand: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=120)
    reference_number: str = Field(min_length=1, max_length=60)
    year: int = Field(ge=1900)
    condition: WatchCondition
    description: str = Field(min_length=20, max_length=4000)
    serial_number: str | None = Field(default=None, max_length=80)
    box_papers: bool = False
    image_urls: list[HttpUrl] = Field(min_length=1, max_length=12)
    # Müzayede taban parametreleri
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


class PresenterLotListItem(BaseModel):
    """Oturum içindeki bir saat lot'unun DTO'su."""

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
    status: AuctionStatus
    bid_count: int = 0


class PresenterSessionListItem(BaseModel):
    """Hub'da gözüken oturum kartı için kompakt DTO."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None = None
    scheduled_at: datetime
    status: PresenterSessionStatus
    is_hidden: bool = False
    lot_count: int = 0
    cover_image_url: str | None = None


class PresenterSessionDetail(BaseModel):
    """Tam detay: oturum meta + içerideki lot'lar."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None = None
    scheduled_at: datetime
    status: PresenterSessionStatus
    is_hidden: bool = False
    presenter_name: str
    lots: list[PresenterLotListItem]


# ============================================================================
# Public DTO'ları (sıradan kullanıcı için)
# ============================================================================


class PublicSessionListItem(BaseModel):
    """/auctions grid'inde gözüken oturum kartı."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    scheduled_at: datetime
    status: PresenterSessionStatus
    presenter_name: str
    lot_count: int
    cover_image_url: str | None = None


class PublicSessionDetail(BaseModel):
    """Public oturum detay — kullanıcı kartı tıklayınca açılan sayfa."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None = None
    scheduled_at: datetime
    status: PresenterSessionStatus
    presenter_name: str
    lots: list[PresenterLotListItem]
