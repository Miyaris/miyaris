# Miyaris

Türkiye'nin sertifikalı lüks saat açık artırma platformu. Üç servis: FastAPI
backend, Next.js frontend, Python AI worker. Postgres + Redis altyapı.

## Servisler

| Klasör | Stack | Sorumluluk |
|---|---|---|
| `backend/` | FastAPI + SQLAlchemy + asyncpg | REST + WebSocket + scheduler |
| `frontend/` | Next.js 14 + Tailwind | Sunucu rendering, httpOnly cookie auth |
| `ai-worker/` | Python (httpx + pydantic) | Valuation + SEO yazısı, dış servis |
| `infra/` | docker-compose | Postgres, Redis |

## Hızlı Başlangıç

```bash
# 1. Postgres + Redis
cd infra && docker compose up -d postgres redis

# 2. Backend
cd ../backend && python3.11 -m venv .venv && source .venv/bin/activate
pip install -e .
cp .env.example .env  # JWT_SECRET_KEY ve SERVICE_API_KEY üret
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
uvicorn app.main:app --reload &

# 3. Frontend
cd ../frontend && cp .env.local.example .env.local && npm install
npm run dev &

# 4. AI worker (opsiyonel ama ilanlarda AI çıktısı için gerekli)
cd ../ai-worker && python3.11 -m venv .venv && source .venv/bin/activate
pip install -e .
cp .env.example .env  # SERVICE_API_KEY backend ile aynı olmalı
python -m worker.main
```

API: http://localhost:8000/docs · Frontend: http://localhost:3000

Uçtan uca senaryo için `DEMO.md`'a bak.

## Üç Ayak

- **Fiziksel Otorite:** Saatler anlaşmalı mağaza ekspertizinden geçer; ilan tipine göre satıştan önce (AUCTION) veya satıştan sonra (DIRECT_SALE).
- **Finansal Güvenlik:** Ödeme, işlem tamamlanana kadar Güvenli Kasa'da bloke edilir (state machine).
- **Otonom AI:** Valuation Agent + SEO Writer ajanları yeni ilanlar için canlı piyasa değerlemesi (çoklu kaynak + marka prestij fallback) ve Türkçe ilan metni üretir.

## İki Vitrin

| Vitrin | URL | Akış |
|---|---|---|
| **Müzayedeler** | `/auctions` | Saat → Ön Ekspertiz → Pazartesi başlayan haftalık açık artırma → kazanan + Güvenli Kasa |
| **Miyaris Mağaza** | `/shop` | Saat sabit fiyatla anında listelenir → Alıcı "Hemen Al" → Güvenli Kasa → Satış Sonrası Ekspertiz |

Satıcı her iki yöntemi de `/sell-watch` üzerinden seçer.

## Kademeli Komisyon

| Dilim (USD) | Oran |
|---|---|
| 0 – 5.000 | %4.0 |
| 5.001 – 15.000 | %2.5 |
| 15.001 + | %1.5 |

Hem müzayede hem mağaza satışlarında uygulanır. `/sell-watch` formunda "Hak Ediş Widget'ı" canlı hesaplar.

## NVİ Doğrulama

Production'da `NVI_VERIFICATION_ENABLED=true` set'leyin. Dev'de default `false` — kayıtlar kabul edilir ama `kyc_verified=False` kalır (admin manuel onaylayabilir).
