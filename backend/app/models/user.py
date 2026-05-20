from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean
from sqlalchemy import Enum as SAEnum
from sqlalchemy import Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.bid import Bid
    from app.models.watch import Watch


class UserRole(str, enum.Enum):
    BUYER = "buyer"
    SELLER = "seller"
    EXPERT = "expert"
    ADMIN = "admin"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    # full_name: kullanıcı görünür "Ad Soyad" — register'da first+last'tan derive
    # edilir; legacy kayıtlar için ayrıca tutulur (back-compat).
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    # NVİ KPSPublic doğrulama için ayrı tutulur (Ad + Soyad ayrı param'lar).
    # Legacy kayıtlarda NULL olabilir; yeni signup'larda Pydantic zorlu.
    first_name: Mapped[str | None] = mapped_column(String(80))
    last_name: Mapped[str | None] = mapped_column(String(80))
    # NVİ TCKimlikNoDogrula DoğumYılı parametresi için.
    birth_year: Mapped[int | None] = mapped_column(Integer)
    phone: Mapped[str | None] = mapped_column(String(20))
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role"),
        default=UserRole.BUYER,
        nullable=False,
    )
    # KYC: T.C. Kimlik No (11 hane) — yasal düzenlemeler gereği zorunlu.
    # Eski kayıtlar için NULL kalabilir (migration backfill veya manuel).
    tc_kimlik_no: Mapped[str | None] = mapped_column(
        String(11), unique=True, index=True
    )
    # MERSİS — kurumsal satıcılar için (16 hane), opsiyonel.
    mersis_no: Mapped[str | None] = mapped_column(String(16), unique=True)
    kyc_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # NOT: ilişkiler `lazy="select"` (default) — User her seferinde
    # otomatik olarak watches/bids yüklemesin. login ve auth dependency'leri
    # User çağırıyor; selectin eager-load login latency'sini artırıyor ve
    # şemada bekleyen bir migration varsa 500 hata olarak patlıyordu.
    watches: Mapped[list[Watch]] = relationship(back_populates="seller")
    bids: Mapped[list[Bid]] = relationship(back_populates="bidder")
