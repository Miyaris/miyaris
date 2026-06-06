"""Kapora (deposit) API DTO'ları."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class DepositStatus(BaseModel):
    """Kullanıcının bir müzayededeki kapora durumu."""

    model_config = ConfigDict(from_attributes=True)

    auction_id: uuid.UUID
    required_deposit_amount: Decimal
    deposit_paid: bool
    deposit_paid_at: datetime | None = None
