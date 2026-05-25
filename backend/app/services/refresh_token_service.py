"""Refresh token rotation + reuse detection.

`issue_token_pair(user_id, request)` → access + refresh JWT döner; refresh
DB'ye persist edilir (jti, expires_at, user_agent, ip).

`rotate_refresh(presented_jwt, request)`:
    1. JWT decode + tip kontrolü (type=refresh)
    2. DB'den jti ile lookup
    3. Kayıt yoksa → "Token geçersiz" (saldırgan random jti uydurmuş olabilir)
    4. Kayıt varsa AMA revoked_at NOT NULL ise → REUSE DETECTED
       → kullanıcının TÜM aktif refresh'lerini iptal et + hata fırlat
       (compromise senaryosu: hem saldırgan hem kurban aynı eski token'ı
       elinde tutuyor, biri kullandı → ikinci kullanım yakalanır)
    5. Kayıt expires_at geçtiyse → reject
    6. Geçerliyse: revoke + yeni jti üret + access+refresh döndür

`revoke_refresh_by_jti(jti)`: logout
`revoke_all_user_refreshes(user_id)`: compromise sonrası kullanıcı oturumlarını
    toptan kes (security event sonrası "all devices logout")
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Request
from jose import JWTError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.refresh_token import RefreshToken
from app.schemas.auth import TokenResponse

logger = logging.getLogger(__name__)

# Reuse race-condition grace window. Bir refresh token revoke edildikten
# sonra bu süre içinde tekrar sunulursa, bunu "compromise" değil "iki sekme
# eş zamanlı /refresh çağırdı" / "mobil retry" gibi MASUM race kabul ediyoruz
# → kullanıcının tüm session'ları SİLİNMEZ, sadece 401 (geç kaldın) döner.
# Bu pencere sonrası reuse → gerçek compromise sinyali, tüm session iptal.
# Industry standard: Auth0 ~5s, Okta ~30s. 10 saniye iyi denge.
REUSE_RACE_GRACE_SECONDS = 10


class InvalidRefreshTokenError(Exception):
    """Refresh token decode/lookup başarısız (genel)."""


class RefreshTokenReuseError(Exception):
    """Aynı refresh token grace window DIŞINDA ikinci kez kullanıldı —
    compromise sinyali. Kullanıcının tüm session'ları zaten iptal edildi;
    client tarafında 'Tekrar giriş yap' uyarısı verilmeli."""


def _extract_request_context(request: Request | None) -> tuple[str | None, str | None]:
    """Audit için UA + IP çıkar. Reverse proxy arkasında X-Forwarded-For
    header'ını da denedik (Render Cloudflare benzeri proxy kullanıyor)."""
    if request is None:
        return None, None
    ua = request.headers.get("user-agent")
    if ua and len(ua) > 500:
        ua = ua[:500]
    # X-Forwarded-For varsa ilkini al (orijinal client IP)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else None
    return ua, ip


async def issue_token_pair(
    db: AsyncSession,
    user_id: uuid.UUID,
    request: Request | None = None,
) -> TokenResponse:
    """Login sonrası ilk token çifti — DB'de yeni refresh kaydı açar."""
    settings = get_settings()
    jti = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    ua, ip = _extract_request_context(request)
    db.add(
        RefreshToken(
            jti=jti,
            user_id=user_id,
            expires_at=expires_at,
            user_agent=ua,
            ip_address=ip,
        )
    )
    await db.commit()

    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id, jti),
    )


async def rotate_refresh(
    db: AsyncSession,
    presented_jwt: str,
    request: Request | None = None,
) -> TokenResponse:
    """Eski refresh'i revoke + yeni issue. Reuse algılanırsa user'ın
    tüm session'larını iptal eder."""
    try:
        payload = decode_token(presented_jwt)
    except JWTError as e:
        raise InvalidRefreshTokenError("JWT decode başarısız") from e

    if payload.get("type") != "refresh":
        raise InvalidRefreshTokenError("Token tipi 'refresh' değil")

    jti = payload.get("jti")
    sub = payload.get("sub")
    if not jti or not sub:
        raise InvalidRefreshTokenError("Token'da jti veya sub eksik")
    try:
        user_id = uuid.UUID(sub)
    except (ValueError, TypeError) as e:
        raise InvalidRefreshTokenError("sub geçersiz UUID") from e

    # DB lookup — jti unique
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.jti == jti)
    )
    record = result.scalar_one_or_none()

    if record is None:
        # JWT imzası geçerli ama DB'de yok — ya revoke edilmiş ve temizlenmiş,
        # ya da saldırganın imzalama anahtarına erişimi var (felaket). Her
        # iki durumda da kullanıcı sessions'larını iptal et — defansif.
        logger.warning(
            "Refresh token DB'de bulunamadı: jti=%s user=%s — tüm session'lar iptal",
            jti, user_id,
        )
        await _revoke_all_user_refreshes(db, user_id)
        raise InvalidRefreshTokenError("Refresh token kayıtlı değil")

    if record.user_id != user_id:
        # JWT içindeki sub ile DB row'undaki user_id uyuşmuyor — token forge
        logger.error(
            "Refresh token user mismatch: jti=%s jwt_sub=%s db_user=%s",
            jti, user_id, record.user_id,
        )
        raise InvalidRefreshTokenError("Token sahibi uyuşmuyor")

    if record.revoked_at is not None:
        # Bu token revoke edilmiş. İki olasılık var:
        #
        # (a) RACE CONDITION (~saniyeler): Kullanıcı iki sekme açtı, ikisi
        #     aynı anda /refresh çağırdı. İkincisi geldiğinde ilki bitirmiş
        #     ve revoke etmiş oluyor. Bu MASUM bir davranış → kullanıcıyı
        #     cezalandırmıyoruz, sadece 401 (geç kaldın) dönüyoruz. Yeni
        #     rotation zaten ilki tarafından üretildi, kullanıcı session'ını
        #     KAYBETMEZ — istemci yeni access token'ı zaten almış oluyor.
        #
        # (b) GERÇEK REUSE (saniyeler sonrası): Saldırgan eski sniff'i
        #     tekrar oynatıyor. Bu compromise sinyali → tüm session iptal,
        #     kullanıcı bir daha login olur, saldırgan giremez.
        revoked_age = datetime.now(timezone.utc) - record.revoked_at.replace(
            tzinfo=record.revoked_at.tzinfo or timezone.utc
        )
        if revoked_age.total_seconds() <= REUSE_RACE_GRACE_SECONDS:
            logger.info(
                "Refresh token race-condition (revoked %ds ago) — soft 401, "
                "session korunuyor: jti=%s user=%s",
                int(revoked_age.total_seconds()), jti, user_id,
            )
            raise InvalidRefreshTokenError(
                "Refresh token zaten yenilenmiş (race condition) — yeni "
                "token'ı kullanın"
            )

        logger.warning(
            "REFRESH TOKEN REUSE: jti=%s user=%s revoked %ds ago — tüm "
            "session'lar iptal",
            jti, user_id, int(revoked_age.total_seconds()),
        )
        await _revoke_all_user_refreshes(db, user_id)
        raise RefreshTokenReuseError(
            "Refresh token zaten kullanılmış — güvenlik nedeniyle tüm "
            "oturumlar sonlandırıldı. Lütfen tekrar giriş yapın."
        )

    # Expire kontrolü (JWT exp claim'i jose'da otomatik kontrol ediliyor
    # ama DB row'unu da kontrol et — saat bozulmasına karşı). SQLite testte
    # timezone-naive döndürebilir; defansif UTC olarak normalize et.
    now = datetime.now(timezone.utc)
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        raise InvalidRefreshTokenError("Refresh token süresi dolmuş")

    # === Rotation ===
    settings = get_settings()
    new_jti = str(uuid.uuid4())
    new_expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    ua, ip = _extract_request_context(request)

    # 1) Eski row'u revoke + replacement işaretle
    record.revoked_at = now
    record.replaced_by_jti = new_jti
    # 2) Yeni row aç
    db.add(
        RefreshToken(
            jti=new_jti,
            user_id=user_id,
            expires_at=new_expires_at,
            user_agent=ua,
            ip_address=ip,
        )
    )
    await db.commit()

    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id, new_jti),
    )


async def revoke_refresh_by_jwt(db: AsyncSession, presented_jwt: str) -> None:
    """Logout — token'ı parse et, DB'de bul, revoke et.

    Hata sessizce yutulur: logout 'best effort'; başarısız olsa bile cookie
    silinir, kullanıcı çıkmış sayılır.
    """
    try:
        payload = decode_token(presented_jwt)
    except JWTError:
        return
    if payload.get("type") != "refresh":
        return
    jti = payload.get("jti")
    if not jti:
        return
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.jti == jti)
        .where(RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()


async def _revoke_all_user_refreshes(
    db: AsyncSession, user_id: uuid.UUID
) -> None:
    """Compromise sonrası kullanıcının tüm aktif refresh'lerini iptal et."""
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id)
        .where(RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()


async def revoke_all_user_refreshes(
    db: AsyncSession, user_id: uuid.UUID
) -> None:
    """Public API — admin 'tüm oturumları kapat' butonu için."""
    await _revoke_all_user_refreshes(db, user_id)
