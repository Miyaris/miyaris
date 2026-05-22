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
    send_password_reset_email,
    send_verification_email,
)
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

    # E-posta doğrulama mail'i — 24 saat geçerli JWT'li link Resend'le gider.
    # Gönderim hatası kullanıcı kaydını GERİ ALMAZ; email_service zaten kendi
    # içinde swallow ediyor (log'a yazar). Kullanıcı tekrar tetiklemek isterse
    # ileride /auth/resend-verification endpoint'i eklenebilir.
    verify_token = create_email_verify_token(user.id)
    await send_verification_email(user, verify_token)

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
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
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
    return user


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
