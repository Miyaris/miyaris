"""JWT + parola güvenlik katmanı.

İmza algoritması RS256 (asimetrik). Private key sadece API instance'larında
bulunur; public key herhangi bir downstream servis veya doğrulama job'ı
tarafından paylaşılabilir → key compromise'ında imza yeteneğini kaybeden
sadece API olur, doğrulayanlar etkilenmez.

Geriye uyumluluk: Mevcut HS256 token'ların grace period boyunca (deploy
gününden +7 gün) doğrulanmaya devam etmesi için `JWT_LEGACY_HS256_VERIFY`
True iken decode önce RS256 dener, başarısız olursa HS256 fallback'e gider.
Grace period sonu: flag False + JWT_SECRET_KEY env'ini sil.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ============================================================================
# Parola hashleme — bcrypt 4.x doğrudan API
# ============================================================================
# bcrypt'in sert 72-byte limiti var (UTF-8'de Türkçe karakterler 2-3 byte).
# passlib 1.7.x + bcrypt 4.x kombinasyonu 'no __about__' uyarısı + ValueError
# fırlatıyor; bunu bypass etmek için doğrudan bcrypt API'sini kullanıyoruz ve
# girişi defansif olarak 72 byte'a kesiyoruz.
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


# Sabit-zamanlı login için kukla hash — import anında bir kez üretilir.
# Kullanıcı bulunamadığında bunun üzerine bcrypt çalıştırıp gerçek doğrulamayla
# aynı maliyeti harcarız; böylece "e-posta var mı yok mu" yanıt süresi farkından
# (timing enumeration) anlaşılamaz.
_DUMMY_BCRYPT_HASH = bcrypt.hashpw(
    b"miyaris-timing-equalizer", bcrypt.gensalt()
).decode("utf-8")


def dummy_verify_password() -> None:
    """Kullanıcı yokken çağrılır — verify_password ile eşdeğer bcrypt maliyeti
    harcar. Dönüş değeri kullanılmaz; tek amacı zamanı eşitlemek."""
    try:
        bcrypt.checkpw(b"x", _DUMMY_BCRYPT_HASH.encode("utf-8"))
    except (ValueError, TypeError):
        pass


# ============================================================================
# Anahtar yönetimi — RS256 PEM parse + cache
# ============================================================================
# Render env değişkeni PEM'i ya gerçek newline ile ya da literal `\n` ile
# tutabilir; her ikisini de normalize ediyoruz. Anahtar yoksa _normalize_pem
# boş string döner → encode anında düşmüş bir env'i fail-fast yakalarız.


def _normalize_pem(pem: str) -> str:
    """PEM string'inde literal `\\n`'leri gerçek newline'a çevir.

    Render dashboard'da multiline secret bazen tek satıra çöker, içindeki
    newline'lar literal `\\n` olarak görünür. cryptography & jose gerçek
    newline bekler. Strip + tırnak temizliği de yapıyoruz (env paste artığı).
    """
    if not pem:
        return ""
    cleaned = pem.strip().strip("'\"")
    if "\\n" in cleaned and "\n" not in cleaned:
        cleaned = cleaned.replace("\\n", "\n")
    return cleaned


_PRIVATE_KEY_CACHE: str | None = None
_PUBLIC_KEY_CACHE: str | None = None


def _get_private_key() -> str:
    global _PRIVATE_KEY_CACHE
    if _PRIVATE_KEY_CACHE is None:
        _PRIVATE_KEY_CACHE = _normalize_pem(settings.JWT_PRIVATE_KEY_PEM)
    return _PRIVATE_KEY_CACHE


def _get_public_key() -> str:
    global _PUBLIC_KEY_CACHE
    if _PUBLIC_KEY_CACHE is None:
        _PUBLIC_KEY_CACHE = _normalize_pem(settings.JWT_PUBLIC_KEY_PEM)
    return _PUBLIC_KEY_CACHE


def _sign(payload: dict[str, Any]) -> str:
    """RS256 ile imzala. Anahtar yoksa ve HS256 fallback için legacy secret
    varsa eski HS256 mantığına düş (lokal dev / migration döneminde
    sıfır-config).

    Production'da private key olmadan başlatma fail-fast olur — main.py
    boot'ta `assert_signing_ready()` çağırıyoruz.
    """
    private_key = _get_private_key()
    if private_key:
        return jwt.encode(payload, private_key, algorithm="RS256")
    if settings.JWT_SECRET_KEY:
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")
    raise RuntimeError(
        "JWT_PRIVATE_KEY_PEM tanımlı değil ve JWT_SECRET_KEY de yok — "
        "imza üretilemez. .env veya Render env değişkenlerini kontrol et."
    )


def _verify(token: str) -> dict[str, Any]:
    """Token'ı RS256 ile doğrula; başarısız olursa grace period boyunca
    HS256 fallback dene. jose.JWTError fırlatır (expired, invalid signature).
    """
    public_key = _get_public_key()
    if public_key:
        try:
            return jwt.decode(token, public_key, algorithms=["RS256"])
        except JWTError:
            if not (settings.JWT_LEGACY_HS256_VERIFY and settings.JWT_SECRET_KEY):
                raise
            logger.debug("RS256 decode failed, trying HS256 legacy fallback")
    if settings.JWT_LEGACY_HS256_VERIFY and settings.JWT_SECRET_KEY:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
    raise JWTError("Belirteç doğrulanamadı: imza geçersiz veya algoritma desteklenmiyor")


def assert_signing_ready() -> None:
    """Boot anında çağır → imza yapılamaz state'de production'ı başlatma.

    Sadece prod (APP_ENV=production) için zorunlu. Dev'de HS256 fallback
    yeterli, sessiz geç.
    """
    if settings.APP_ENV != "production":
        return
    if not _get_private_key():
        raise RuntimeError(
            "Production boot başarısız: JWT_PRIVATE_KEY_PEM env eksik. "
            "RS256 imza yapılamaz. Render dashboard'da set'le."
        )
    if not _get_public_key():
        raise RuntimeError(
            "Production boot başarısız: JWT_PUBLIC_KEY_PEM env eksik. "
            "Belirteç doğrulanamaz."
        )


# ============================================================================
# Access / Refresh token'ları
# ============================================================================
# Access: kısa ömürlü (15dk default), bearer veya HttpOnly cookie ile
# taşınır, her isteğin auth context'ini sağlar.
#
# Refresh: 30 gün, rotation aktif → `jti` claim ile DB'de takip edilir.
# Her kullanımda eski revoke + yeni issue. Reuse algılanırsa kullanıcının
# tüm session'ları invalidate edilir.


def _create_token(
    subject: uuid.UUID,
    expires_delta: timedelta,
    token_type: str,
    *,
    jti: str | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "exp": now + expires_delta,
        "iat": now,
        "type": token_type,
    }
    if jti:
        payload["jti"] = jti
    return _sign(payload)


def create_access_token(subject: uuid.UUID) -> str:
    """15dk geçerli access token üret. jti yok — access token'lar
    revocable değil; kısa ömrüne güveniyoruz."""
    return _create_token(
        subject,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
    )


def create_refresh_token(subject: uuid.UUID, jti: str) -> str:
    """30 gün geçerli refresh token üret. jti zorunlu — DB'de
    refresh_tokens tablosundaki kayıtla eşleşir, revoke / rotate
    mekanizmasını besler."""
    return _create_token(
        subject,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_type="refresh",
        jti=jti,
    )


def decode_token(token: str) -> dict[str, Any]:
    """Genel decode — dependencies/get_current_user buradan token tipini
    kontrol eder."""
    return _verify(token)


# ============================================================================
# E-posta doğrulama token'ları (type='email_verify')
# ============================================================================
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
    return _sign(payload)


def decode_email_verify_token(token: str) -> uuid.UUID:
    """Token'ı parse et + tip doğrula → user_id döner.

    `jose.JWTError` (süresi dolmuş, imza geçersiz vb.) çağıranın yakalaması
    gereken hata. Tip uyuşmuyorsa `ValueError` fırlatır.
    """
    payload = _verify(token)
    if payload.get("type") != _EMAIL_VERIFY_TOKEN_TYPE:
        raise ValueError("Belirteç türü e-posta doğrulama için uygun değil")
    sub = payload.get("sub")
    if not sub:
        raise ValueError("Belirteçte kullanıcı kimliği eksik")
    return uuid.UUID(sub)


# ============================================================================
# Şifre sıfırlama token'ları (type='password_reset')
# ============================================================================
# Default 1 saat geçerli, JWT tabanlı tek kullanımlık link tokenı. Tek
# kullanımlık olması yapısaldan değil pratikten gelir: kullanıcı şifresini
# değiştirdiği anda hashed_password değişir → eski tokenlar hâlâ parse
# edilebilir ama bu noktadan sonra zararsız. (Daha sert "tek kullanım"
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
    return _sign(payload)


def decode_password_reset_token(token: str) -> uuid.UUID:
    """Şifre sıfırlama token'ını parse et + tip doğrula → user_id döner.

    `jose.JWTError` süresi dolmuş veya imza geçersizken; `ValueError` tip
    uyuşmazlığı veya sub eksikse fırlatılır.
    """
    payload = _verify(token)
    if payload.get("type") != _PASSWORD_RESET_TOKEN_TYPE:
        raise ValueError("Belirteç türü şifre sıfırlama için uygun değil")
    sub = payload.get("sub")
    if not sub:
        raise ValueError("Belirteçte kullanıcı kimliği eksik")
    return uuid.UUID(sub)
