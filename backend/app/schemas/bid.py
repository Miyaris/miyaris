import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class BidCreate(BaseModel):
    amount: Decimal = Field(gt=0, decimal_places=2)
    is_proxy: bool = False
    max_proxy_amount: Decimal | None = Field(default=None, gt=0, decimal_places=2)


class BidPublic(BaseModel):
    """Public bid DTO — gerçek bidder kimliği sızdırılmaz.

    `bidder_alias` SHA-256 hash'in ilk 6 karakteridir; aynı kullanıcı her
    teklifte aynı etiketi alır ("Üye #A1B2C3"), farklı kullanıcılar farklı
    etiket alır. UUID veya isim API'a çıkmaz.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    auction_id: uuid.UUID
    bidder_alias: str
    amount: Decimal
    placed_at: datetime
    is_proxy: bool
