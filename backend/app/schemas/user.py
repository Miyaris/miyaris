import re
import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import UserRole

_DIGITS_RE = re.compile(r"^\d+$")
_NAME_RE = re.compile(r"^[A-Za-zÇĞİÖŞÜçğıöşü\s'-]+$")


class UserBase(BaseModel):
    """Shared profile fields. Note: full_name kayıtta first+last'tan derive
    edilir — bu yüzden UserCreate'de yer almaz."""

    email: EmailStr
    phone: str | None = Field(default=None, max_length=20)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=72)
    # NVİ doğrulaması için ayrı Ad / Soyad / Doğum Yılı
    first_name: str = Field(
        min_length=2,
        max_length=80,
        description="Ad — NVİ kayıtlarındaki yazımıyla aynı olmalı",
    )
    last_name: str = Field(
        min_length=2,
        max_length=80,
        description="Soyad — NVİ kayıtlarındaki yazımıyla aynı olmalı",
    )
    birth_year: int = Field(
        ge=1900,
        description="Doğum yılı — NVİ TCKimlikNoDogrula için zorunlu",
    )
    # KYC: yasal düzenlemeler gereği TC kimlik zorunlu, MERSİS kurumsal için
    tc_kimlik_no: str = Field(
        min_length=11,
        max_length=11,
        description="11 haneli T.C. Kimlik Numarası — yasal zorunluluk",
    )
    mersis_no: str | None = Field(
        default=None,
        max_length=16,
        description="16 haneli MERSİS Numarası — kurumsal satıcılar için opsiyonel",
    )

    @field_validator("first_name", "last_name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        v = v.strip()
        if not _NAME_RE.fullmatch(v):
            raise ValueError(
                "Ad/Soyad yalnızca harf, boşluk, kesme işareti veya tire içerebilir"
            )
        return v

    @field_validator("birth_year")
    @classmethod
    def _validate_year(cls, v: int) -> int:
        current = date.today().year
        if v > current:
            raise ValueError("Doğum yılı gelecekte olamaz")
        if v < current - 120:
            raise ValueError("Doğum yılı çok eski")
        return v

    @field_validator("tc_kimlik_no")
    @classmethod
    def _validate_tc(cls, v: str) -> str:
        v = v.strip()
        if not _DIGITS_RE.fullmatch(v):
            raise ValueError("TC kimlik numarası yalnızca rakamlardan oluşmalı")
        if len(v) != 11:
            raise ValueError("TC kimlik numarası 11 haneli olmalı")
        if v[0] == "0":
            raise ValueError("TC kimlik numarası 0 ile başlayamaz")
        return v

    @field_validator("mersis_no")
    @classmethod
    def _validate_mersis(cls, v: str | None) -> str | None:
        if v is None or v.strip() == "":
            return None
        v = v.strip()
        if not _DIGITS_RE.fullmatch(v):
            raise ValueError("MERSİS numarası yalnızca rakamlardan oluşmalı")
        if len(v) != 16:
            raise ValueError("MERSİS numarası 16 haneli olmalı")
        return v


class UserPublic(UserBase):
    """Sahibine geri döner. NVI alanları kendi profili — admin/seller view'da
    ayrı şema kullanılır (henüz yok)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: UserRole
    full_name: str
    first_name: str | None = None
    last_name: str | None = None
    birth_year: int | None = None
    kyc_verified: bool
    # E-posta doğrulama durumu — kayıt anında False, /auth/verify-email başarılı
    # olduğunda True. Frontend gate'leme için bu alanı kullanabilir.
    is_verified: bool = False
    # Canlı müzayede sunucu paneli (`/presenter/*`) yetkisi — admin
    # tarafından manuel toggle. Frontend layout guard'ı bu alanı okur.
    is_presenter: bool = False
    tc_kimlik_no: str | None = None
    mersis_no: str | None = None
    created_at: datetime
