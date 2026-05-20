# syntax=docker/dockerfile:1.6
# ============================================================================
# Miyaris AI Worker — Production Dockerfile
# Background worker; net I/O ağırlıklı (Chrono24/DDGS/eBay scraping).
# Render.com "Background Worker" servisi için hazır.
# ============================================================================

FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libffi-dev \
        && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --upgrade pip setuptools wheel \
 && pip install \
        "httpx>=0.27.0" \
        "pydantic>=2.7.0" \
        "pydantic-settings>=2.3.0" \
        "duckduckgo-search>=6.0.0" \
        "beautifulsoup4>=4.12.0"


FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv

RUN useradd --create-home --shell /bin/bash worker
WORKDIR /app

COPY --chown=worker:worker . /app

USER worker

# Worker port dinlemez; uzun ömürlü process.
CMD ["python", "-m", "worker.main"]
