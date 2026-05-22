import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import jwt

from app.core.config import get_settings

settings = get_settings()

# bcrypt'in sert 72-byte limiti var (UTF-8'de Türkçe karakterler 2-3 byte). passlib
# 1.7.x + bcrypt 4.x kombinasyonu 'no __about__' uyarısı + ValueError fırlatıyor;
# bunu bypass etmek için doğrudan bcrypt API'sini kullanıyoruz ve girişi defansif
# olarak 72 byte'a kesiyoruz.
_BCRYPT_MAX_BYTES = 72


def _to_bcrypt_bytes(password: str) -> bytes:
    encoded = password.encode("utf-8")
    return encoded[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_to_bcrypt_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_to_bcrypt_bytes(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _create_token(subject: uuid.UUID, expires_delta: timedelta, token_type: str) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    payload: dict[str, Any] = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": token_type,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(subject: uuid.UUID) -> str:
    return _create_token(
        subject,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
    )


def create_refresh_token(subject: uuid.UUID) -> str:
    return _create_token(
        subject,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_type="refresh",
    )


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


# ----- E-posta doğrulama token'ları -----------------------------------------
# Erişim/refresh token'larından bağımsız bir tür: "email_verify". Token içinde
# user_id (sub) ve type alanı taşır, default 24 saat geçerli.

_EMAIL_VERIFY_TOKEN_TYPE = "email_verify"


def create_email_verify_token(user_id: uuid.UUID) -> str:
    """24 saat (default) geçerli, e-posta doğrulama JWT'si üret."""
    expire = datetime.now(timezone.utc) + timedelta(
        hours=settings.EMAIL_VERIFY_EXPIRE_HOURS
    )
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": _EMAIL_VERIFY_TOKEN_TYPE,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_email_verify_token(token: str) -> uuid.UUID:
    """Token'ı parse et + tip doğrula → user_id döner.

    `jose.JWTError` (süresi dolmuş, imza geçersiz vb.) çağıranın yakalaması
    gereken hata. Tip uyuşmuyorsa `ValueError` fırlatır.
    """
    payload = jwt.decode(
        token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )
    if payload.get("type") != _EMAIL_VERIFY_TOKEN_TYPE:
        raise ValueError("Token tipi e-posta doğrulama için uygun değil")
    sub = payload.get("sub")
    if not sub:
        raise ValueError("Token sub alanı boş")
    return uuid.UUID(sub)


# ----- Şifre sıfırlama token'ları -------------------------------------------
# "password_reset" tipinde, default 1 saat geçerli, JWT tabanlı tek kullanımlık
# link tokenı. Tek kullanımlık olması yapısaldan değil pratikten gelir: kullanıcı
# şifresini değiştirdiği anda hashed_password değişir → eski tokenlar hâlâ
# parse edilebilir ama bu noktadan sonra zararsız. (Daha sert "tek kullanım"
# istenirse user.password_reset_jti gibi bir alan tutulabilir; MVP için
# kısa TTL yeterli.)

_PASSWORD_RESET_TOKEN_TYPE = "password_reset"


def create_password_reset_token(user_id: uuid.UUID) -> str:
    """Default 1 saat geçerli, şifre sıfırlama JWT'si üret."""
    expire = datetime.now(timezone.utc) + timedelta(
        hours=settings.PASSWORD_RESET_EXPIRE_HOURS
    )
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": _PASSWORD_RESET_TOKEN_TYPE,
    }
    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def decode_password_reset_token(token: str) -> uuid.UUID:
    """Şifre sıfırlama token'ını parse et + tip doğrula → user_id döner.

    `jose.JWTError` süresi dolmuş veya imza geçersizken; `ValueError` tip
    uyuşmazlığı veya sub eksikse fırlatılır.
    """
    payload = jwt.decode(
        token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )
    if payload.get("type") != _PASSWORD_RESET_TOKEN_TYPE:
        raise ValueError("Token tipi şifre sıfırlama için uygun değil")
    sub = payload.get("sub")
    if not sub:
        raise ValueError("Token sub alanı boş")
    return uuid.UUID(sub)
