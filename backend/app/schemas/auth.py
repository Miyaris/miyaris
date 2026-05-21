from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class EmailVerifyResponse(BaseModel):
    """`/auth/verify-email` GET cevabı — yalın özet."""

    email: EmailStr
    is_verified: bool
    message: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ResendVerificationResponse(BaseModel):
    """Enumeration sızıntısını önlemek için her zaman aynı mesaj."""

    message: str = (
        "Eğer bu adres sistemimizde kayıtlı ve doğrulanmamışsa, "
        "yeni bir doğrulama linki gönderildi."
    )
