from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _normalize_database_url(url: str) -> str:
    """Render / Heroku / GCP gibi platformlar PostgreSQL bağlantısını
    sürücüsüz format'ta verir (`postgres://...` veya `postgresql://...`).
    SQLAlchemy default'u psycopg2'dir; biz tüm stack'i asyncpg ile çalıştığımız
    için URL'in `postgresql+asyncpg://` ile başladığından emin oluruz.

    Defansif temizlik:
      - Whitespace strip (env yapıştırırken kayan boşluklar)
      - Tek/çift tırnak strip (kabuk escape'inden artakalan)
      - `postgres://` → `postgresql+asyncpg://` (Heroku legacy)
      - `postgresql://` → `postgresql+asyncpg://`
      - asyncpg, `sslmode=require` query parametresini desteklemez; SQLAlchemy
        2.0 onu otomatik tercüme ediyor, ama `sslmode=disable` gibi varyantlar
        problem çıkarabilir. Burada özel bir dönüşüm yapmıyoruz; sorun olursa
        ileride `?ssl=true` parametresine çeviririz.
    """
    if not url:
        return url
    url = url.strip().strip("'\"")
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    APP_NAME: str = "miyaris"
    DEBUG: bool = False

    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://miyaris:miyaris@localhost:5432/miyaris_db"
    )

    @field_validator("DATABASE_URL")
    @classmethod
    def _ensure_asyncpg_driver(cls, v: str) -> str:
        return _normalize_database_url(v)

    # ---- JWT İmza ----
    # RS256'ya geçtik. Eski HS256 token'ların grace period boyunca (deploy
    # gününden itibaren 7 gün) doğrulanmaya devam etmesi için JWT_SECRET_KEY
    # opsiyonel tutuluyor — yoksa HS256 fallback devre dışı. Grace period
    # sonrası bu env tamamen silinebilir.
    #
    # Production'da RSA anahtarları Render dashboard → Environment → secret
    # olarak set'lenir (sync:false). PEM tek satıra alınırken `\n`'lar
    # literal olarak girilebilir; security.py yükleme anında çevirir.
    JWT_SECRET_KEY: str = ""  # Legacy HS256; boşsa fallback yok
    JWT_PRIVATE_KEY_PEM: str = ""  # RS256 imza için (prod'da zorunlu)
    JWT_PUBLIC_KEY_PEM: str = ""  # RS256 doğrulama için (prod'da zorunlu)
    JWT_ALGORITHM: str = "RS256"
    # Access token süresi: 30 dk. Frontend'in sessiz refresh akışı devreye
    # girene kadar (Faz 5) kullanıcıyı 30 dk'dan sık logout yapmamak için
    # bilinçli olarak 30. RS256 + jti tabanlı refresh ile zaten güçlü
    # iptal mekanizması var; sızıntı penceresi 30 dk yönetilebilir.
    # Frontend refresh hazır olunca 15 dk'ya çekilebilir.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    # Refresh süresi: 30 gün. Rotation aktif → her kullanımda yeni jti,
    # eski revoke, 30 gün absolute upper bound.
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ---- HS256 Geriye-Uyum Grace Period ----
    # Deploy günü RS256'ya geçişten sonra mevcut kullanıcıların eski
    # HS256 token'larıyla logout edilmesini engelleyen yumuşak geçiş.
    # True ise: yeni token'lar RS256 ile imzalanır, ama doğrulama
    # önce RS256 dener — başarısız olursa HS256 fallback ile dener.
    # Grace period (7 gün) bittikten sonra False'a çek + JWT_SECRET_KEY
    # env'ini sil.
    JWT_LEGACY_HS256_VERIFY: bool = True

    # ---- Rate Limiting ----
    # Production'da True. Lokal dev'de False bırakırsan integration test'ler
    # 429 yemez. Limitler kod tarafında sabit: login/register/forgot 5/min.
    RATE_LIMIT_ENABLED: bool = True

    # ---- Production hardening flag ----
    # True iken: CORS regex sıkı, CSRF zorunlu, HS256 fallback uyarı log'lar,
    # security headers preload-ready HSTS. False (dev): permissive defaults.
    # Render'da APP_ENV=production set'le.
    APP_ENV: str = "development"

    # Servisler arası auth (örn: BBB finans ajanları → Miyaris API).
    # Kullanıcı JWT'sinden bağımsız, paylaşılan statik anahtar.
    # X-Service-Key header ile gönderilir. Boş bırakılırsa servis
    # endpoint'leri hiçbir çağrıyı kabul etmez.
    SERVICE_API_KEY: str = ""

    # NVİ (KPSPublic) TC kimlik doğrulama servisi.
    #   Default: False — dev makinesinde ve CI'da kayıt akışı NVİ erişim/
    #   eşleşme gerektirmesin (NVI servisi MERNİS gecikmelerinden ötürü
    #   doğru bilgiyle bile zaman zaman 'no match' döndürüyor).
    #   Production deployment'larında .env'de `NVI_VERIFICATION_ENABLED=true`
    #   set edilmeli. Kapalıyken kayıt kabul edilir ama `kyc_verified=False`
    #   olarak işaretlenir → admin manuel onay verir.
    NVI_VERIFICATION_ENABLED: bool = False
    NVI_TIMEOUT_SECONDS: float = 10.0

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # ---- E-posta (Resend) ----
    # Resend transactional e-mail service. RESEND_API_KEY production'da Render
    # env'den gelir; boş bırakılırsa email_service "skipped" mod'una geçer
    # (geliştirme makinesinde kayıt akışını bloklamadan kullanılabilir).
    RESEND_API_KEY: str = ""
    # Gönderici adresi — Resend dashboard'da doğrulanmış domain'le aynı olmalı.
    # Default: production domain'i. Lokal/dev: noreply@miyaris.com hâlâ çalışır
    # ama mail aslında Resend dashboard'unda görünür yalnızca.
    EMAIL_FROM: str = "Miyaris <noreply@miyaris.com>"
    # Frontend ana adresi — doğrulama linkinde kullanılır (link kullanıcının
    # tarayıcısında açılır → /verify-email?token=... → frontend backend'i çağırır
    # veya doğrudan backend endpoint'ine yönlendirir).
    FRONTEND_URL: str = "http://localhost:3000"
    # Doğrulama token'ı geçerlilik süresi (saat). 24 saat default.
    EMAIL_VERIFY_EXPIRE_HOURS: int = 24
    # Şifre sıfırlama token'ı geçerlilik süresi (saat). 1 saat default —
    # hassas operasyon olduğu için kasıtlı olarak kısa.
    PASSWORD_RESET_EXPIRE_HOURS: int = 1

    # ---- Seed admin'ler ----
    # Virgülle ayrılmış e-posta listesi. Container her açıldığında, bu
    # listede bulunan ve veritabanında zaten kayıtlı olan kullanıcıların
    # rolü otomatik olarak `admin` olarak güncellenir (idempotent).
    # Kayıtlı olmayan e-postalar sessizce atlanır — önce normal kayıt akışı
    # ile hesabı açıp e-postayı doğrulamak gerekir; sonraki container restart'ta
    # promote edilir.
    # Format: "admin1@miyaris.com,admin2@miyaris.com"
    # Production'da Render dashboard → Environment → ADMIN_EMAILS olarak set'le.
    ADMIN_EMAILS: str = ""

    @property
    def admin_email_list(self) -> list[str]:
        """ADMIN_EMAILS env'ini normalize edilmiş liste olarak döndürür.

        - Virgülle ayrılır
        - Boşluklar trim'lenir
        - Küçük harfe normalize edilir (DB email kolonu unique index'li,
          domain karşılaştırması case-insensitive olmalı)
        - Boş entry'ler filtrelenir
        """
        if not self.ADMIN_EMAILS:
            return []
        return [
            email.strip().lower()
            for email in self.ADMIN_EMAILS.split(",")
            if email.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
