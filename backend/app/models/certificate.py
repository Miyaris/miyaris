from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.watch import Watch


class AuthenticityVerdict(str, enum.Enum):
    AUTHENTIC = "authentic"
    SERVICE_PARTS = "service_parts"
    NOT_AUTHENTIC = "not_authentic"
    INCONCLUSIVE = "inconclusive"


class AuthenticityCertificate(Base, TimestampMixin):
    __tablename__ = "authenticity_certificates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    watch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("watches.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    expert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    verdict: Mapped[AuthenticityVerdict] = mapped_column(
        SAEnum(AuthenticityVerdict, name="authenticity_verdict"), nullable=False
    )
    notes: Mapped[str] = mapped_column(Text, nullable=False)
    pdf_url: Mapped[str] = mapped_column(String(500), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    watch: Mapped[Watch] = relationship(back_populates="certificate")
