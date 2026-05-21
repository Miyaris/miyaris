# syntax=docker/dockerfile:1.6
# ============================================================================
# Miyaris Backend — Production Dockerfile
# Hafif (python:3.11-slim), root-olmayan kullanıcı, çoklu-aşama build.
# Render.com Web Service ya da herhangi bir container platformunda çalışır.
# ============================================================================

# ---------- BUILD AŞAMASI: bağımlılıkları derle ----------
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# bcrypt / cryptography / asyncpg native bağımlılıkları için geçici build
# araçları — runtime image'a sızmaz.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libffi-dev \
        libpq-dev \
        && rm -rf /var/lib/apt/lists/*

# pyproject ile bağımlılıkları sanal env'e kur.
COPY pyproject.toml ./
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --upgrade pip setuptools wheel \
 && pip install \
        "fastapi>=0.115.0" \
        "uvicorn[standard]>=0.30.0" \
        "sqlalchemy[asyncio]>=2.0.30" \
        "asyncpg>=0.29.0" \
        "psycopg2-binary>=2.9.9" \
        "alembic>=1.13.0" \
        "pydantic>=2.7.0" \
        "pydantic-settings>=2.3.0" \
        "bcrypt>=4.0,<5.0" \
        "python-jose[cryptography]>=3.3.0" \
        "python-multipart>=0.0.9" \
        "email-validator>=2.2.0" \
        "python-slugify>=8.0.4" \
        "httpx>=0.27.0"

# ---------- RUNTIME AŞAMASI: minimal image ----------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    PORT=8000

# Runtime'da yalnızca libpq + ca-certificates gerek.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        ca-certificates \
        && rm -rf /var/lib/apt/lists/*

# Build aşamasından sanal env'i kopyala
COPY --from=builder /opt/venv /opt/venv

# Root olmayan kullanıcı
RUN useradd --create-home --shell /bin/bash app
WORKDIR /app

# Uygulama kodu
COPY --chown=app:app . /app

USER app

EXPOSE 8000

# Render kendi healthcheck'i için /health'ı kullanır (render.yaml'da set).
# Lokal docker run sırasında da işe yarar.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os,sys,urllib.request; \
sys.exit(0 if urllib.request.urlopen(f'http://localhost:{os.getenv(\"PORT\",\"8000\")}/health', timeout=3).status==200 else 1)" || exit 1

# Container açılış scripti: scripts/startup.sh
# Adımlar (her birinde net log basar):
#   1. cd /app — WORKDIR garanti
#   2. DATABASE_URL env kontrolü
#   3. wait_for_db.py — DB DNS + connection bekleyişi
#   4. alembic upgrade head — migration'lar
#   5. uvicorn — production modunda FastAPI
#
# `--proxy-headers + --forwarded-allow-ips='*'` Render reverse proxy arkasında
# client IP/scheme header'larını doğru okur.
# `sh` ile invoke ediyoruz; executable bit gerekmiyor, böylece git'in
# permission bit'ini kaybettiği case'lerde de çalışır.
CMD ["sh", "/app/scripts/startup.sh"]
