from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.auction import Auction
    from app.models.user import User


class Bid(Base):
    """Immutable: bid'ler asla update/delete edilmez (audit trail için kritik)."""

    __tablename__ = "bids"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    auction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auctions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    bidder_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    placed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
        nullable=False,
    )
    is_proxy: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    max_proxy_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))

    auction: Mapped[Auction] = relationship(
        back_populates="bids", foreign_keys=[auction_id]
    )
    bidder: Mapped[User] = relationship(back_populates="bids", lazy="joined")
