import secrets
import uuid

from fastapi import Depends, Header, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole
from app.utils.exceptions import APIError

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class _AuthError(APIError):
    def __init__(self, detail: str = "Geçersiz kimlik bilgisi"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_token(token)
    except JWTError:
        raise _AuthError()

    if payload.get("type") != "access":
        raise _AuthError("Yanlış token tipi")

    user_id = payload.get("sub")
    if not user_id:
        raise _AuthError()

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise _AuthError("Hesap bulunamadı veya pasif")
    return user


def require_role(*allowed_roles: UserRole):
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise APIError(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu işlem için yetkiniz yok",
            )
        return user

    return role_checker


async def require_service_token(
    x_service_key: str | None = Header(default=None, alias="X-Service-Key"),
) -> None:
    """Servisler arası kimlik doğrulama (BBB finans ajanları → Miyaris API).

    Kullanıcı JWT'sinden bağımsız; sabit, paylaşılan bir anahtarla yetkilendirir.
    Sadece scraper / değerleme ajan endpoint'lerinde kullanılır — kullanıcı
    çağıran endpoint'lerde ASLA yer almamalı.
    """
    settings = get_settings()
    if not settings.SERVICE_API_KEY:
        # Sır tanımlı değilse servis kanalı kapalı.
        raise APIError(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Servis kanalı yapılandırılmamış",
        )
    if not x_service_key or not secrets.compare_digest(
        x_service_key, settings.SERVICE_API_KEY
    ):
        raise APIError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz servis anahtarı",
        )
