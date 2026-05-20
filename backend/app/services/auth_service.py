import uuid

from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.config import get_settings
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.user import UserCreate
from app.services.nvi_service import verify_tc_with_nvi
from app.utils.exceptions import APIError, AuthError, ConflictError


async def register_user(db: AsyncSession, payload: UserCreate) -> User:
    """Yeni kullanıcı kaydı.

    Akış:
      1. E-posta tekilliği
      2. TC kimlik tekilliği
      3. MERSİS tekilliği (varsa)
      4. NVİ KPSPublic'e TCKimlikNoDogrula — False → 400, kayıt reddedilir
      5. User satırı oluştur (kyc_verified = NVİ sonucundan True)
    """
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise ConflictError("Bu e-posta zaten kayıtlı")

    # TC kimlik tekilliği
    tc_existing = await db.execute(
        select(User).where(User.tc_kimlik_no == payload.tc_kimlik_no)
    )
    if tc_existing.scalar_one_or_none():
        raise ConflictError("Bu T.C. kimlik numarası zaten kayıtlı")

    # MERSİS tekilliği (varsa)
    if payload.mersis_no:
        mersis_existing = await db.execute(
            select(User).where(User.mersis_no == payload.mersis_no)
        )
        if mersis_existing.scalar_one_or_none():
            raise ConflictError("Bu MERSİS numarası zaten kayıtlı")

    # NVİ KPSPublic doğrulaması — devlet sisteminde kimlik bilgileri eşleşmiyorsa
    # kayıt reddedilir. NVI_VERIFICATION_ENABLED=False ise atlanır (dev modu).
    settings = get_settings()
    nvi_ok = await verify_tc_with_nvi(
        tc_kimlik_no=payload.tc_kimlik_no,
        first_name=payload.first_name,
        last_name=payload.last_name,
        birth_year=payload.birth_year,
    )
    if not nvi_ok:
        # 400 Bad Request — kullanıcının verdiği bilgiler NVİ ile eşleşmiyor
        raise APIError(
            status_code=400,
            detail=(
                "Doğrulama Başarısız: Kimlik bilgileriniz NVİ devlet "
                "sistemiyle eşleşmiyor."
            ),
        )

    # Kayıt tamam — kyc_verified flag'i NVI etkin durumda True
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        full_name=f"{payload.first_name} {payload.last_name}",
        birth_year=payload.birth_year,
        phone=payload.phone,
        tc_kimlik_no=payload.tc_kimlik_no,
        mersis_no=payload.mersis_no,
        kyc_verified=settings.NVI_VERIFICATION_ENABLED,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        raise AuthError("E-posta veya şifre hatalı")
    if not user.is_active:
        raise AuthError("Hesap pasif durumda")
    return user


def issue_tokens(user_id: uuid.UUID) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


async def refresh_access_token(db: AsyncSession, refresh_token: str) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
    except JWTError as e:
        raise AuthError("Geçersiz veya süresi dolmuş refresh token") from e

    if payload.get("type") != "refresh":
        raise AuthError("Yanlış token tipi")

    user_id = payload.get("sub")
    if not user_id:
        raise AuthError("Geçersiz token")

    # Kullanıcı hâlâ aktif mi kontrol et
    user = (
        await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        raise AuthError("Hesap bulunamadı")

    return issue_tokens(user.id)
