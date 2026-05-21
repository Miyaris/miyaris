from fastapi import HTTPException, status


class APIError(HTTPException):
    """Tüm uygulama hataları için ortak base."""


class AuthError(APIError):
    def __init__(self, detail: str = "Kimlik doğrulama hatası"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


class ForbiddenError(APIError):
    def __init__(self, detail: str = "Yetkisiz işlem"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class NotFoundError(APIError):
    def __init__(self, detail: str = "Bulunamadı"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class ConflictError(APIError):
    def __init__(self, detail: str = "Çakışan işlem"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class EmailNotVerifiedError(APIError):
    """Login denemesinde e-posta doğrulanmamışsa fırlatılır.

    403 Forbidden ile özel `code` taşır; frontend bu kod'u görünce kullanıcıyı
    "E-postanı doğrula" mesajıyla bilgilendirir + resend linki gösterir.
    """

    def __init__(
        self,
        detail: str = (
            "E-posta adresiniz henüz doğrulanmadı. "
            "Lütfen kayıt sırasında gönderilen doğrulama linkine tıklayın."
        ),
    ):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "email_not_verified", "message": detail},
        )
