from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse
from app.schemas.user import UserCreate, UserPublic
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Yeni kullanıcı oluştur. Default rol: BUYER."""
    return await auth_service.register_user(db, payload)


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
