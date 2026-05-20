import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.auction import AuctionStatus
from app.schemas.watch import WatchPublic


class AuctionCreate(BaseModel):
    """Satıcının açık artırma onay payload'u.

    Tarihler kullanıcı tarafından seçilmez — sistem otomatik olarak bir sonraki
    haftanın Pazartesi 00:00 → Pazar 23:59 (Europe/Istanbul) penceresine atar.
    """

    watch_id: uuid.UUID
    starting_price: Decimal = Field(gt=0, decimal_places=2)
    reserve_price: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    buy_it_now_price: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    min_bid_increment: Decimal = Field(default=Decimal("50"), gt=0, decimal_places=2)

    @model_validator(mode="after")
    def _validate(self):
        if self.reserve_price is not None and self.reserve_price < self.starting_price:
            raise ValueError("reserve_price >= starting_price olmalı")
        if (
            self.buy_it_now_price is not None
            and self.buy_it_now_price <= self.starting_price
        ):
            raise ValueError("buy_it_now_price > starting_price olmalı")
        return self


class AuctionUpdate(BaseModel):
    reserve_price: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    buy_it_now_price: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    min_bid_increment: Decimal | None = Field(default=None, gt=0, decimal_places=2)


class AuctionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    watch: WatchPublic
    starting_price: Decimal
    reserve_price: Decimal | None
    buy_it_now_price: Decimal | None
    min_bid_increment: Decimal
    current_price: Decimal
    starts_at: datetime
    ends_at: datetime
    extended_until: datetime | None
    status: AuctionStatus
    bid_count: int = 0


class AuctionListItem(BaseModel):
    """Liste sayfası için hafif DTO — full WatchPublic gönderilmez."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    watch_id: uuid.UUID
    brand: str
    model: str
    current_price: Decimal
    buy_it_now_price: Decimal | None = None
    ends_at: datetime
    status: AuctionStatus
    primary_image_url: str | None = None


class MyAuctionParticipation(BaseModel):
    """Alıcının teklif verdiği açık artırmaların özeti — kazanıyor mu/kaybetti mi
    görsün diye `my_highest_bid` ve `is_leading` alanları."""

    model_config = ConfigDict(from_attributes=True)

    auction_id: uuid.UUID
    watch_id: uuid.UUID
    brand: str
    model: str
    primary_image_url: str | None = None
    my_highest_bid: Decimal
    current_price: Decimal
    is_leading: bool
    status: AuctionStatus
    ends_at: datetime
    extended_until: datetime | None = None
    bid_count: int
