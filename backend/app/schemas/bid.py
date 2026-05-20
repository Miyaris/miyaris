import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class BidCreate(BaseModel):
    amount: Decimal = Field(gt=0, decimal_places=2)
    is_proxy: bool = False
    max_proxy_amount: Decimal | None = Field(default=None, gt=0, decimal_places=2)


class BidPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    auction_id: uuid.UUID
    bidder_id: uuid.UUID
    bidder_name: str | None = None
    amount: Decimal
    placed_at: datetime
    is_proxy: bool
