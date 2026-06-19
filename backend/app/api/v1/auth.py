from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import (
    EmailVerifyResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RefreshRequest,
    ResendVerificationRequest,
    ResendVerificationResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    TokenResponse,
)
from app.schemas.user import UserCreate, UserPublic
from app.core.middleware import limiter
from app.services import auth_service
from app.services.refresh_token_service import (
    issue_token_pair,
    revoke_refresh_by_jwt,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request: Request,
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Yeni kullanıcı oluştur. Default rol: BUYER.

    Kayıt başarılı olur olmaz Resend üzerinden 24 saat geçerli, JWT tabanlı
    doğrulama linkiyle "E-posta Adresinizi Doğrulayın" maili gönderilir.
    Gönderim hatası kaydı engellemez (log'a yazar).
    """
    return await auth_service.register_user(db, payload)


@router.get("/verify-email", response_model=EmailVerifyResponse)
async def verify_email(
    token: str = Query(..., description="Kayıt mailindeki JWT doğrulama belirteci"),
    db: AsyncSession = Depends(get_db),
):
    """E-posta doğrulama linkini işle.

    - GET kullanımı bilinçli: kullanıcı tarayıcıdan tıkladığında doğrudan
      çağrılabilsin (formsuz). Frontend'den de fetch'le çağrılabilir.
    - Token geçerliyse `is_verified=True` yapılır + Resend "Hoş Geldiniz"
      maili tetiklenir.
    - Idempotent: zaten doğrulanmışsa welcome mail TEKRAR atılmaz.
    """
    user = await auth_service.verify_email_token(db, token)
    return EmailVerifyResponse(
        email=user.email,
        is_verified=user.is_verified,
        message="E-posta adresiniz başarıyla doğrulandı.",
    )


@router.post("/resend-verification", response_model=ResendVerificationResponse)
@limiter.limit("5/minute")
async def resend_verification(
    request: Request,
    payload: ResendVerificationRequest,
    db: AsyncSession = Depends(get_db),
):
    """Doğrulama linki tekrar gönder.

    Enumeration leak'ini önlemek için her zaman aynı 200 cevabı döner — kayıtlı
    olmayan veya zaten doğrulanmış adresler için işlem sessizce no-op olur.
    """
    await auth_service.resend_verification_email(db, payload.email)
    return ResendVerificationResponse()


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Şifre sıfırlama linki gönder.

    Enumeration leak'ini önlemek için her zaman aynı 200 cevabı döner —
    kayıtlı olmayan ya da pasif e-postalar sessizce no-op olur.
    """
    await auth_service.request_password_reset(db, payload.email)
    return ForgotPasswordResponse()


@router.post("/reset-password", response_model=ResetPasswordResponse)
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Sıfırlama mailindeki token + yeni şifre → şifre güncelleme.

    Token geçersiz veya süresi dolmuşsa 401 (`AuthError`) döner. Başarılı
    olursa kullanıcı `is_verified=True` işaretlenir ve yeni şifreyle login
    yapabilir.
    """
    user = await auth_service.reset_password(db, payload.token, payload.new_password)
    return ResetPasswordResponse(email=user.email)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """E-posta + şifre ile giriş; access (15dk) + refresh (30g, rotation'lı)
    token çifti döner. Refresh jti DB'ye persist edilir → /refresh çağrısında
    eski revoke + yeni issue, reuse algılanırsa tüm session'lar iptal."""
    user = await auth_service.authenticate(db, payload.email, payload.password)
    return await issue_token_pair(db, user.id, request)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
async def refresh(
    request: Request,
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Refresh token ile yeni access+refresh çifti al (rotation).

    Eski refresh revoke edilir. Eğer aynı refresh ikinci kez kullanılırsa
    (token reuse), kullanıcının TÜM aktif refresh'leri iptal edilir ve 401
    + "tekrar giriş yap" mesajı döner. Compromise senaryosuna karşı
    defense-in-depth."""
    return await auth_service.refresh_access_token(
        db, payload.refresh_token, request
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Refresh token'ı revoke et. 'Best effort' — JWT geçersiz olsa bile
    204 döner (client cookie'yi yine de siler). Frontend bu endpoint'i
    çağırdıktan sonra cookie'leri temizler.
    """
    await revoke_refresh_by_jwt(db, payload.refresh_token)
    return None


@router.get("/me", response_model=UserPublic)
async def me(user: User = Depends(get_current_user)):
    """Mevcut kullanıcı profili."""
    return user
