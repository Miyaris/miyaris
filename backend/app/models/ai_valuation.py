from __future__ import annotations

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.watch import Watch


class AIValuation(Base, TimestampMixin):
    """Aynı saat için zaman içinde versiyonlu değerlemeler.

    Agent her çalıştığında yeni bir kayıt oluşturur — geçmiş silinmez.
    """

    __tablename__ = "ai_valuations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    watch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("watches.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    estimated_value_min: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    estimated_value_max: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    sources: Mapped[dict] = mapped_column(JSONB, default=dict)
    agent_version: Mapped[str] = mapped_column(String(40), nullable=False)
    raw_output: Mapped[dict] = mapped_column(JSONB, default=dict)

    watch: Mapped[Watch] = relationship(back_populates="valuations")
