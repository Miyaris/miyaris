"""Servisler arası endpoint'ler için DTO'lar — yalnızca AI worker / BBB ajanları
gibi iç servislerin gördüğü payload'lar."""

import uuid
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.watch import WatchCondition


class ServiceWatchData(BaseModel):
    """AI worker'a gönderilen sade saat verisi — kullanıcı PII'ı yok."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    brand: str
    model: str
    reference_number: str
    year: int | None
    condition: WatchCondition
    box_papers: bool
    description: str


class ServiceClaimResponse(BaseModel):
    watch_id: uuid.UUID
    claimed: bool
    detail: str | None = None


class ServiceValuationCreate(BaseModel):
    estimated_value_min: Decimal = Field(gt=0, decimal_places=2)
    estimated_value_max: Decimal = Field(gt=0, decimal_places=2)
    confidence_score: float = Field(ge=0, le=1)
    sources: dict[str, Any] = Field(default_factory=dict)
    agent_version: str = Field(min_length=1, max_length=40)
    raw_output: dict[str, Any] = Field(default_factory=dict)


class ServiceSEOUpdate(BaseModel):
    seo_description: str = Field(min_length=20, max_length=4000)


class ServiceCompleteRequest(BaseModel):
    success: bool
    error_message: str | None = Field(default=None, max_length=2000)
