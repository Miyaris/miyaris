from pydantic import BaseModel, EmailStr, Field


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


# ----- Şifre sıfırlama --------------------------------------------------------


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    """Enumeration sızıntısını önlemek için her zaman aynı mesaj döner."""

    message: str = (
        "Eğer bu e-posta sistemimizde kayıtlıysa, kısa süre içinde "
        "şifre sıfırlama linki gönderilecektir."
    )


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="Şifre sıfırlama maili içindeki JWT")
    # UserCreate ile aynı politika: min 8 karakter. Frontend ayrıca confirm
    # eşleşmesini kendi kontrol ediyor.
    new_password: str = Field(..., min_length=8, max_length=128)


class ResetPasswordResponse(BaseModel):
    email: EmailStr
    message: str = "Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz."
