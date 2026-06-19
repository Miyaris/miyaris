import asyncio
import logging
import uuid

from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_email_verify_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.config import get_settings
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.user import UserCreate
from app.services.email_service import (
    send_admin_new_registration_email,
    send_password_reset_email,
    send_verification_email,
)

logger = logging.getLogger(__name__)
from app.services.nvi_service import verify_tc_with_nvi
from app.utils.exceptions import (
    APIError,
    AuthError,
    ConflictError,
    EmailNotVerifiedError,
)


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

    # NVİ KPSPublic doğrulaması — fail-closed.
    #
    #   1. NVİ True döndü                → kayıt OK, kyc_verified=True
    #   2. NVİ False döndü (bilgi yanlış) → kayıt REDDEDİLİR (400)
    #   3. NVİ servis hatası (APIError)  → kayıt REDDEDİLİR (503), kullanıcıdan
    #                                       "tekrar dene" istenir
    #
    # Fail-closed seçildi çünkü NVİ bozulunca "fail-open" kayıt geçirmek
    # yanlış bilgilerle sahte hesap açılmasına neden oluyordu. Şu an NVI
    # bozulduğunda hiç kimse kayıt olamaz, ama yanlış bilgiyle de hesap
    # açılamaz. Servis düzelene kadar bekle.
    settings = get_settings()
    nvi_ok = False
    if settings.NVI_VERIFICATION_ENABLED:
        # APIError doğrudan endpoint'e propagate — fail-closed
        nvi_ok = await verify_tc_with_nvi(
            tc_kimlik_no=payload.tc_kimlik_no,
            first_name=payload.first_name,
            last_name=payload.last_name,
            birth_year=payload.birth_year,
        )

    # NVI False döndü → bilgi yanlış → reddet
    if settings.NVI_VERIFICATION_ENABLED and not nvi_ok:
        raise APIError(
            status_code=400,
            detail=(
                "Kimlik bilgileriniz NVİ devlet sistemiyle eşleşmiyor. "
                "Bilgileri kontrol edip tekrar deneyin."
            ),
        )

    # Kayıt tamam — kyc_verified flag'i NVI doğrulamasından gelir
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
        # Sadece NVİ doğrulaması başarılı olduysa True; aksi halde admin
        # elle onay verecek (False kalır, $3000 üstü teklif kilitli kalır).
        kyc_verified=nvi_ok,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # E-posta doğrulama mail'i — 24 saat geçerli JWT'li link Resend'le gider.
    # Gönderim hatası kullanıcı kaydını GERİ ALMAZ; email_service zaten kendi
    # içinde swallow ediyor (log'a yazar). Kullanıcı tekrar tetiklemek isterse
    # ileride /auth/resend-verification endpoint'i eklenebilir.
    verify_token = create_email_verify_token(user.id)
    await send_verification_email(user, verify_token)

    # Admin'lere bilgilendirme maili — fire-and-forget. Hata olursa kayıt
    # bozulmaz (email_service swallow ediyor). ADMIN_EMAILS env boşsa atlanır.
    try:
        asyncio.create_task(send_admin_new_registration_email(user))
    except Exception:  # noqa: BLE001
        logger.exception("Admin yeni kayıt bildirimi schedule edilemedi")

    return user


async def authenticate(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        raise AuthError("E-posta veya şifre hatalı")
    if not user.is_active:
        raise AuthError("Hesap pasif durumda")
    # E-posta doğrulama zorunlu — kayıt anında gönderilen linke tıklanmadıkça
    # giriş engellenir. Frontend bu hatayı (403 + code=email_not_verified)
    # yakalayıp kullanıcıyı uygun ekrana yönlendirir.
    if not user.is_verified:
        raise EmailNotVerifiedError()
    return user


def issue_tokens(user_id: uuid.UUID) -> TokenResponse:
    """DEPRECATED — DB-persisted refresh rotation için
    `refresh_token_service.issue_token_pair` kullan. Bu helper sadece
    geriye uyumluluk (ör. legacy testler) için tutulur; ürettiği refresh
    DB'de değildir → /refresh endpoint'i reject eder.
    """
    jti = str(uuid.uuid4())
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id, jti),
    )


async def resend_verification_email(db: AsyncSession, email: str) -> None:
    """E-posta doğrulama linkini tekrar gönder.

    Defansif:
      - Kullanıcı yoksa veya zaten doğrulanmışsa enumeration leak'ini önlemek
        için sessizce başarı dön (200 OK). Frontend "mail tekrar gönderildi"
        mesajı gösterir; saldırgan hangi e-postaların kayıtlı olduğunu
        anlayamaz.
      - is_active=False ise de gönderilmez (pasif hesap).
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or user.is_verified or not user.is_active:
        return
    token = create_email_verify_token(user.id)
    await send_verification_email(user, token)


async def verify_email_token(db: AsyncSession, token: str) -> User:
    """E-posta doğrulama akışını tamamla.

    - Token'ı parse et + tip kontrolü (security.decode_email_verify_token)
    - User'ı bul → zaten doğrulanmışsa idempotent: tekrar mail atmaz
    - is_verified=True olarak güncelle, commit
    - Welcome mail tetikle (Resend)
    """
    from app.core.security import decode_email_verify_token  # local import — döngüyü önler

    try:
        user_id = decode_email_verify_token(token)
    except (JWTError, ValueError) as e:
        raise AuthError("Doğrulama linki geçersiz veya süresi dolmuş") from e

    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None:
        raise AuthError("Kullanıcı bulunamadı")

    if user.is_verified:
        # Idempotent — kullanıcı linke ikinci kez tıkladıysa hata vermeden geç,
        # welcome mail tekrar atılmasın.
        return user

    user.is_verified = True
    await db.commit()
    await db.refresh(user)

    # Welcome mail — failure swallow'lu, log'a yazar
    from app.services.email_service import send_welcome_email
    await send_welcome_email(user)

    return user


async def request_password_reset(db: AsyncSession, email: str) -> None:
    """Şifre sıfırlama linkini e-postayla gönder.

    Enumeration leak'ini önlemek için her zaman sessizce başarılı döner:
      - Kullanıcı yoksa hiçbir şey gönderilmez ama frontend "eğer kayıtlıysanız
        mail gönderildi" mesajı gösterir.
      - is_active=False kullanıcılara link gönderilmez.
      - Email doğrulanmamış olsa bile reset linki gönderilir; çünkü kullanıcı
        belki ilk doğrulama mailini kaçırdı ve şimdi giriş yapamıyor — şifresini
        sıfırlama denemesini engellemek gereksiz friction yaratır. (Reset
        akışında is_verified set'lenmez; login akışı yine doğrulama isteyecek.)
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return
    token = create_password_reset_token(user.id)
    await send_password_reset_email(user, token)


async def reset_password(db: AsyncSession, token: str, new_password: str) -> User:
    """Şifre sıfırlama akışını tamamla.

    - Token'ı parse et + tip kontrolü (security.decode_password_reset_token)
    - User'ı bul → hashed_password'ı yeni şifreyle güncelle
    - is_verified=True işaretle: kullanıcı kendi e-postasına gelen linke
      tıklayabildiyse o adresin sahibi demektir, ayrıca tekrar mail beklemesin.
    """
    from app.core.security import decode_password_reset_token  # döngü önleme

    try:
        user_id = decode_password_reset_token(token)
    except (JWTError, ValueError) as e:
        raise AuthError(
            "Sıfırlama linki geçersiz veya süresi dolmuş"
        ) from e

    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        raise AuthError("Hesap bulunamadı veya pasif")

    # Yeni şifre — Pydantic katmanı min uzunluğu zorlamış olmalı, defansif
    # olarak burada tekrar kontrol etmiyoruz (UserCreate.password ile aynı
    # politika frontend formunda da uygulanıyor).
    user.hashed_password = hash_password(new_password)
    # Kullanıcı maile erişebildi → e-posta sahipliği zımnen doğrulanmış oldu.
    if not user.is_verified:
        user.is_verified = True
    await db.commit()
    await db.refresh(user)

    # Güvenlik: şifre sıfırlandığında kullanıcının TÜM aktif refresh
    # token'larını iptal et. Aksi halde hesabı ele geçiren biri şifre
    # sıfırlansa bile mevcut oturumunu 30 güne kadar sürdürebilirdi.
    # Reset = "beni her cihazdan çıkar" anlamına gelir.
    from app.services.refresh_token_service import revoke_all_user_refreshes

    await revoke_all_user_refreshes(db, user.id)
    return user


async def refresh_access_token(
    db: AsyncSession,
    refresh_token: str,
    request=None,  # fastapi.Request — opsiyonel, audit log için
) -> TokenResponse:
    """DB-backed refresh token rotation + reuse detection.

    `refresh_token_service.rotate_refresh`'e delege eder. Reuse algılanırsa
    kullanıcının tüm session'ları zaten iptal edilir; biz burada 401 +
    "tekrar giriş yap" mesajı döneriz.
    """
    from app.services.refresh_token_service import (
        InvalidRefreshTokenError,
        RefreshTokenReuseError,
        rotate_refresh,
    )

    try:
        new_pair = await rotate_refresh(db, refresh_token, request)
    except RefreshTokenReuseError as e:
        # Compromise sinyali — kullanıcıya net mesaj, frontend logout edip
        # login sayfasına yönlendirir.
        raise AuthError(str(e)) from e
    except InvalidRefreshTokenError as e:
        raise AuthError("Geçersiz veya süresi dolmuş yenileme belirteci") from e

    # Kullanıcı hâlâ aktif mi? rotation sonrası kontrol ediyoruz; eğer
    # kullanıcı pasifleştirildiyse refresh'i revoke et + reject.
    payload = decode_token(new_pair.access_token)
    user_id = uuid.UUID(payload["sub"])
    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        # Yeni refresh'i de revoke et (rotation'da yarattığımız jti)
        from app.services.refresh_token_service import revoke_refresh_by_jwt
        await revoke_refresh_by_jwt(db, new_pair.refresh_token)
        raise AuthError("Hesap pasif veya bulunamadı")

    return new_pair
