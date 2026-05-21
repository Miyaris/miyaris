from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import (
    EmailVerifyResponse,
    LoginRequest,
    RefreshRequest,
    ResendVerificationRequest,
    ResendVerificationResponse,
    TokenResponse,
)
from app.schemas.user import UserCreate, UserPublic
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Yeni kullanıcı oluştur. Default rol: BUYER.

    Kayıt başarılı olur olmaz Resend üzerinden 24 saat geçerli, JWT tabanlı
    doğrulama linkiyle "E-posta Adresinizi Doğrulayın" maili gönderilir.
    Gönderim hatası kaydı engellemez (log'a yazar).
    """
    return await auth_service.register_user(db, payload)


@router.get("/verify-email", response_model=EmailVerifyResponse)
async def verify_email(
    token: str = Query(..., description="Kayıt mailindeki JWT doğrulama token'ı"),
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
async def resend_verification(
    payload: ResendVerificationRequest, db: AsyncSession = Depends(get_db)
):
    """Doğrulama linki tekrar gönder.

    Enumeration leak'ini önlemek için her zaman aynı 200 cevabı döner — kayıtlı
    olmayan veya zaten doğrulanmış adresler için işlem sessizce no-op olur.
    """
    await auth_service.resend_verification_email(db, payload.email)
    return ResendVerificationResponse()


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """E-posta + şifre ile giriş; access + refresh token döner."""
    user = await auth_service.authenticate(db, payload.email, payload.password)
    return auth_service.issue_tokens(user.id)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh token ile yeni access token al."""
    return await auth_service.refresh_access_token(db, payload.refresh_token)


@router.get("/me", response_model=UserPublic)
async def me(user: User = Depends(get_current_user)):
    """Mevcut kullanıcı profili."""
    return user
