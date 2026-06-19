# Miyaris — Demo Çalıştırma Rehberi

Üç servis paralel çalışacak: **backend (FastAPI)**, **frontend (Next.js)**,
**ai-worker (Python)**. Postgres ve Redis Docker'da.

## 0) Ön Koşullar

- Python 3.11+
- Node.js 18+
- Docker + Docker Compose
- macOS / Linux (Windows için WSL2 önerilir)

## 1) Postgres + Redis'i Ayağa Kaldır

```bash
cd ~/Documents/miyaris/infra
docker compose up -d postgres redis
docker compose ps  # postgres healthy görmelisin
```

## 2) Backend (FastAPI)

### 2.1. Bağımlılıklar + .env

```bash
cd ~/Documents/miyaris/backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e .

cp .env.example .env
```

`.env` dosyasını aç ve düzenle — özellikle iki alan:

```ini
JWT_SECRET_KEY=<32+ karakter rastgele bir secret>
SERVICE_API_KEY=<32+ karakter rastgele bir secret>
```

Hızlı yol:
```bash
echo "JWT_SECRET_KEY=$(openssl rand -hex 32)" >> .env
echo "SERVICE_API_KEY=$(openssl rand -hex 32)" >> .env
```

> ⚠️ `SERVICE_API_KEY` değerini bir kenara yaz — ai-worker'a aynısını gireceksin.

### 2.2. İlk migration'ı üret + uygula

```bash
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

> Veritabanını sıfırdan kurarken bu **tek bir migration** olarak çalışır
> (8 tablo + AI processing field'ları hepsi içinde).

### 2.3. Sunucuyu çalıştır

```bash
uvicorn app.main:app --reload
```

Doğru çalıştığında:
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health → `{"status":"ok"}`
- Logda görmen gereken: `Auction scheduler started (tick=30s)`

## 3) Frontend (Next.js)

```bash
cd ~/Documents/miyaris/frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Aç: http://localhost:3000

## 4) AI Worker

```bash
cd ~/Documents/miyaris/ai-worker
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e .

cp .env.example .env
```

`.env`'yi düzenle — `SERVICE_API_KEY` **backend'dekiyle aynı** olmalı:

```ini
MIYARIS_API_URL=http://localhost:8000
SERVICE_API_KEY=<backend'deki değerin aynısı>
POLL_INTERVAL_SECONDS=15
# OLLAMA_BASE_URL boş bırakırsan StubLLM kullanılır (deterministik mock)
```

Çalıştır:

```bash
python -m worker.main
```

Doğru çalıştığında log:
```
INFO worker.main: AI worker started — polling http://localhost:8000 every 15s
INFO worker.llm: Using StubLLM (deterministik mock — production için yeterli değil)
```

## 5) Demo Senaryosu

Üç terminal açık olmalı:
1. Backend (uvicorn)
2. Frontend (npm run dev)
3. AI worker (python -m worker.main)

### 5.1. İki test kullanıcısı oluştur

http://localhost:3000/register

- **Satıcı:** `seller@test.com` / `password123` / Ali Demir
- **Alıcı:** `buyer@test.com` / `password123` / Ayşe Kaya
- **Admin:** `admin@test.com` / `password123` / Kaya (bu sen)

> Üç hesap da otomatik **BUYER** rolüyle oluşur. Admin paneline girebilmek
> için Kaya'nın rolünü manuel `ADMIN`'e yükselteceğiz (5.2).

### 5.2. Admin rolünü yükselt

Backend `.venv` aktifken:

```bash
cd ~/Documents/miyaris/backend
python3 - <<'PY'
import asyncio
from sqlalchemy import update
from app.core.database import AsyncSessionLocal
from app.models.user import User, UserRole

async def promote(email: str, role: UserRole):
    async with AsyncSessionLocal() as db:
        await db.execute(update(User).where(User.email == email).values(role=role))
        await db.commit()
        print(f"✓ {email} → {role.value}")

asyncio.run(promote("admin@test.com", UserRole.ADMIN))
PY
```

> Bunu sadece dev/demo için yapıyoruz. Production'da rol yönetimi ayrı admin
> sub-app üzerinden olur (Adım 8+).

### 5.3. Satıcı: ilan oluştur (iki vitrin seçimi)

1. Logout → `seller@test.com` ile login
2. Header'da "Saat Sat" → `/sell-watch`
3. Yeni form sırayla:
   - **İlan Tipi:** İki kart — `Açık Artırma` (müzayede, ön ekspertiz şart) ya
     da `Direkt Satış` (sabit fiyat, satış sonrası ekspertiz). Bu senaryoda
     **Açık Artırma**'yı seç.
   - **Saat Bilgileri:** Marka `Rolex`, Model `Submariner Date`, Ref.
     `126610LN`, Yıl `2022`, Kondisyon `Mükemmel`, Kutu & Kağıtlar ✓,
     Açıklama (en az 10 karakter)
   - **Görseller:** En az 1 URL (örn. unsplash.com'dan saat fotoğrafı)
   - **Hak Ediş Widget'ı:** Açık artırmada henüz fiyat yok, sadece kademeli
     komisyon tablosunu (%4 / %2.5 / %1.5) gösterir.
4. "İlanı Yayınla" → `/account/listings/{id}?just_created=1`
5. Statü **Ön Ekspertiz Bekliyor** (`pending_pre_expertise`); banner'da
   `MYR-XXXXXX` formatlı **Ön Ekspertiz Teslimat Kodu** görünür. AI Valuation
   Card'da "AI çalışıyor".

### 5.4. AI ajanları çalışıyor (15-30 saniye bekle)

AI worker terminal'inde:
```
INFO worker.main: Processing watch <uuid> (Rolex Submariner Date)
INFO worker.main: Watch <uuid> valuation: $12000–$16800 USD (confidence 0.72)
INFO worker.main: Watch <uuid> SEO description written (559 chars)
INFO worker.main: Watch <uuid> DONE
```

> Canlı kaynak (DDGS/eBay/Chrono24) yetersizse worker marka prestij tablosuna
> düşer — örneğin Rolex baseline $14k × kondisyon çarpanı. Düz $15k değil;
> markaya göre farklı bantlar.

Frontend'de listing detay sayfasını yenile:
- AI Valuation Card artık değer aralığını + reasoning'i gösteriyor
- "AI Tarafından Yazılan Metin" bölümü Türkçe prose ile dolu
- AI status: `AI tamamlandı` (yeşil nokta)

### 5.5. Admin: ön ekspertiz onayı + sertifika

1. Logout → `admin@test.com` ile login
2. Header'da "Moderasyon" linki görünür → tıkla
3. `/admin/moderation` — kuyrukta Ön Ekspertiz Bekliyor + Ekspertiz Bekliyor
   tüm saatler tek listede
4. "İncele →" → moderation detay sayfası (satıcı bilgisi, AI valuation,
   fotoğraflar, açıklama, anlaşmalı mağaza teslimat kodu)
5. **Sertifika Çıkar** kartı:
   - Karar: **Orijinal** seç
   - Notlar: "Hareket numarası ile ref eşleşiyor. Servis izi yok. Kasa keskin."
   - PDF URL: test URL (örn. `https://example.com/cert.pdf`)
6. "Sertifikayı Kaydet — Orijinal" → sayfa yenilenir
7. Saat artık `ACTIVE` durumunda (yeşil olive rozeti); ilan müzayede planına
   alınmaya hazır.

### 5.6. Satıcı: açık artırmaya çıkar

1. Logout → `seller@test.com` ile login
2. `/account/listings` → Rolex'e tıkla
3. ACTIVE rozeti görünür → **"Açık Artırma Planla"** butonu
4. Form: AI önerisini kullan → tarihler:
   - Başlangıç: **3 dakika sonra**
   - Bitiş: **5 dakika sonra**
5. **"Açık Artırmayı Yayınla"** → `/auctions/{id}` sayfasına yönlenirsin

> Demo için kısa süreler — gerçek kullanımda 7 gün önerilir.

### 5.7. Alıcı: canlı teklif ver

1. Logout → `buyer@test.com` ile login
2. `/auctions` → Rolex listede (canlı rozetli olmalı)
3. Detay sayfasına gir → countdown geri sayımı, "AI Tarafından Yazılan Metin"
4. "Mevcut Fiyat: $10,000 USD", min teklif $10,100
5. Teklif ver → fiyat anında güncellenir, "Teklif Geçmişi"nde en üste düşer
6. **İki tarayıcı aç** (biri normal, biri incognito) — birinde tekrar buyer
   olarak teklif ver, diğerinde fiyatın saniye saniye değiştiğini gör (WebSocket)

### 5.8. Açık artırma kapanır → escrow oluşur

`ends_at` geçtikten sonra (max 30 saniye gecikmeyle) scheduler:
- Saatin durumunu `ENDED`'a çeker
- Kazanan teklifi belirler
- `escrow_transactions` tablosuna kayıt yaratır (status: PENDING_PAYMENT)
- WebSocket'e `auction.ended` broadcast eder
- Frontend'de "Sona erdi" mesajı görünür

### 5.9. Alıcı: ödeme yap (escrow akışı başlar)

1. Buyer hâlâ login → header **"Siparişlerim"** linki
2. `/account/orders` → Rolex Submariner kartı, **"Ödeme Bekleniyor"** rozeti
3. Karta tıkla → detay sayfası, **EscrowTimeline** sol kolonda (müzayede
   varyantı: "Müzayedeyi Kazandınız — Güvenli Kasa'ya ödeme yapın")
4. Sağda büyük **"$X Öde (Demo)"** butonu — teslimat yöntemi (Sigortalı
   Kargo / Mağazadan Teslim) ve ödeme yöntemi (Kredi Kartı / Banka
   Transferi) seçilir
5. Banka Transferi seçilirse fatura özetinde anında **%2.5 EFT indirimi**
   gösterilir; kademeli komisyon post-discount tutardan hesaplanır
6. Tıkla → "Ödeme Alındı" durumuna geçer, timeline 2. adıma ilerler

> Demo modunda `payment_provider_ref="demo-mock"` set edilir. Production'da
> burası iyzico callback URL'iyle gerçek ödeme akışına bağlanacak.

### 5.10. Admin: fiziksel akışı ilerlet

1. Logout → `admin@test.com` ile login
2. Header'da artık **"Moderasyon"** ve **"Escrow"** iki link var
3. **Escrow** linkine tıkla → `/admin/escrow` aktif akışlar listesi
4. Rolex satırı (durum: "Ödendi") → **"Yönet →"**
5. Sağ kolon: **"Sıradaki Adım"** kartı
   - "Saat Miyaris'e Ulaştı" → tıkla
   - State: "Doğrulamada" → tıkla "Doğrulamayı Tamamla"
   - "Doğrulandı" → "Alıcıya Gönder"
   - "Kargoda" → "Teslim Onayı"
   - "Teslim Edildi" → **"Parayı Satıcıya Aktar"**
6. Her adımda timeline ilerler, sayfa yenilenir
7. Son adımdan sonra escrow status: **RELEASED**, akış tamamlandı

### 5.11. Satıcı: parayı aldığını gör

1. Logout → `seller@test.com` ile login
2. Header → **"Hesabım"** (full name) — şimdilik henüz `/account/sales` linki yok
3. Direkt URL: http://localhost:3000/account/sales
4. Rolex kartı, durum: **Tamamlandı**
5. Detay → "Size Aktarılacak: $X" (kademeli komisyon düşülmüş; $10k için
   $325, $20k için $525 gibi marjinal oranla)

> NOT: `/account/sales` linkini header'a eklemedim çünkü her kullanıcı
> hem alıcı hem satıcı olabiliyor. Kullanıcılar URL ile ulaşıyor — production'da
> account dashboard içinde tek bir "Hesabım" sayfasından bütün modlara
> yönlendirme yapılır (Adım 9+).

DB'de tüm akışı doğrula:
```bash
docker compose exec postgres psql -U miyaris -d miyaris_db -c \
  "SELECT id, status, amount, platform_fee, funded_at, released_at FROM escrow_transactions;"
```

`status: released`, `funded_at` ve `released_at` dolu olmalı.

## 5b) Alternatif Senaryo — Miyaris Mağaza (Direkt Satış)

Müzayede yerine sabit fiyatla satış. Ekspertiz **satıştan SONRA** yapılır.

### 5b.1. Satıcı: direkt satış ilanı

1. `seller@test.com` ile login → "Saat Sat" → `/sell-watch`
2. **İlan Tipi:** `Direkt Satış` seç (brass tonlu kart)
3. Bilgileri doldur (Marka `Omega`, Model `Speedmaster`, Ref `310.30.42.50.01.001`,
   Yıl `2021`, Mint kondisyon, görsel URL)
4. **Fiyatlandırma:** İstenen Fiyat `8500` (USD)
5. **Hak Ediş Widget'ı** canlı hesaplar:
   - Komisyon: $5k×%4 + $3.5k×%2.5 = $287.50
   - Net hak ediş: $8,212.50
   - Ortalama oran: %3.38
6. "İlanı Yayınla" → ilan **`ACTIVE`** statüsünde anında Miyaris Mağaza
   vitrinine düşer (ön ekspertiz beklemez)

### 5b.2. Mağaza vitrininden satın al

1. Logout → `buyer@test.com` ile login
2. Header → "Miyaris Mağaza" → `/shop`
3. Omega Speedmaster kartı, "Hemen Al" rozetiyle. Tıkla
4. `/watches/{slug}` detay sayfası, fiyat $8,500
5. **"Hemen Satın Al"** → açılır panelde Sigortalı Kargo + Banka Transferi
   seçimi → EFT indirimi $212.50 görünür → "Siparişi Onayla"
6. `/account/orders/{id}` — escrow `PENDING_PAYMENT`, timeline DIRECT_SALE
   varyantı ("Siparişiniz oluştu — Güvenli Kasa'ya ödeme yapın")

### 5b.3. Satıcı: satış sonrası ekspertiz

1. Logout → `seller@test.com` → `/account/listings/{omega_id}`
2. Saatin statüsü artık **Ekspertiz Bekliyor**
3. Banner: "Satış Sonrası Teslimat Kodu — MYR-XXXXXX. Saatinizi partner
   mağazaya teslim ediniz. Alıcıya kargolanmadan önce uzman onayı alınacak."
4. Satıcı kod ile saati mağazaya götürür (gerçek hayatta)

### 5b.4. Buyer ödeme + admin akışı

1. `buyer@test.com` → siparişi fund'la (kredi kartı veya EFT) → escrow
   `FUNDED`, watch statüsü `AWAITING_EXPERTISE` (zaten öyleydi, idempotent)
2. `admin@test.com` → `/admin/escrow` → Omega Speedmaster → State Actions:
   - "Saat Miyaris'e Ulaştı" → AWAITING_AUTHENTICATION
   - "Doğrulamayı Tamamla" → AUTHENTICATED
   - "Alıcıya Gönder" → SHIPPED_TO_BUYER
   - "Teslim Onayı" → DELIVERED
   - "Parayı Satıcıya Aktar" → RELEASED
3. Son adımda escrow advance hook'u tetiklenir → **Watch.status = SOLD**
   (DIRECT_SALE özel: escrow RELEASED'a ulaştığında otomatik)

### 5b.5. Doğrulama

```bash
docker compose exec postgres psql -U miyaris -d miyaris_db -c "
  SELECT w.brand, w.model, w.listing_type, w.status AS watch_status,
         e.status AS escrow_status, e.amount, e.discount_amount, e.platform_fee
  FROM watches w
  JOIN auctions a ON a.watch_id = w.id
  JOIN escrow_transactions e ON e.auction_id = a.id
  ORDER BY e.created_at DESC;
"
```

Beklenen: AUCTION saat `sold` + RELEASED, DIRECT_SALE saat `sold` + RELEASED.
Her ikisinde de `platform_fee` kademeli komisyon değeri.

## 6) Yararlı URL'ler

| Servis | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Müzayedeler | http://localhost:3000/auctions |
| Miyaris Mağaza | http://localhost:3000/shop |
| Saat Sat (iki vitrin formu) | http://localhost:3000/sell-watch |
| Public Saat Detayı | http://localhost:3000/watches/{slug} |
| Nasıl Çalışır | http://localhost:3000/how-it-works |
| Backend Swagger | http://localhost:8000/docs |
| Backend Redoc | http://localhost:8000/redoc |
| Backend Health | http://localhost:8000/health |
| WebSocket | ws://localhost:8000/ws/auctions/{id} |
| Postgres | localhost:5432 (miyaris / miyaris / miyaris_db) |

## 7) Debug İpuçları

**Backend log'ları:**
- `Auction scheduler started` görmüyorsan: `RUN_SCHEDULER=0` env var olabilir
- 401 hata: `JWT_SECRET_KEY` ile login token uyumsuz — login tekrar
- 503 + "Servis kanalı yapılandırılmamış": `SERVICE_API_KEY` boş
- Kayıt akışında 400 "Doğrulama Başarısız": `NVI_VERIFICATION_ENABLED=true`
  ama girilen bilgi NVİ ile eşleşmiyor. Dev için `.env`'de `false` set'le.

**Worker log'ları:**
- `401 Unauthorized` görüyorsan: ai-worker `.env`'deki `SERVICE_API_KEY`
  backend'dekiyle eşleşmiyor
- "No queued watches" sürekli ise: yeni saat oluşturmadın ya da hepsi
  zaten DONE/FAILED durumunda
- `FALLBACK (marka tabanlı)` log'u: Chrono24/eBay/DDGS kaynakları boş döndü,
  worker marka prestij tablosuna düştü (Rolex $14k, Patek $65k, Tudor $4.2k…).
  Bot blokuna takıldığında bile sistem makul değer üretir.

**Frontend:**
- Browser console'da `WebSocket connection failed`: backend down olabilir
- "Bağlantı hatası" → backend health endpoint'ini kontrol et
- "Saat Sat" linkine bastığında `/login?next=/sell-watch`'a yönlendiyorsan:
  middleware koruması doğru çalışıyor; login olunca form'a düşersin.

**Postgres:**
- Şemayı sıfırdan kurmak: `docker compose down -v && docker compose up -d postgres`
  ardından `alembic upgrade head` tekrar
- Migration zinciri: `da4f64e539a0` → `ea2e373e4fc8` → `746bc919eade` →
  `d333af093dda` → `ee960d9e114d` → `f1a2b3c4d5e6` (head). `alembic upgrade
  head` her aşamada idempotent.

## 8) Servisleri Kapatma

Ctrl+C ile her terminal'i kapat, sonra:

```bash
cd ~/Documents/miyaris/infra
docker compose down       # Container'ları durdur
# docker compose down -v  # Veriyi de sil (DB sıfırla)
```

## 9) Şu Anki Mimari Özet

```
┌─────────────┐         ┌──────────────────┐
│  Browser    │◄───────►│  Next.js (3000)  │
│             │  HTTP   │  • SSR pages     │
│             │  WS     │  • Cookie auth   │
└─────────────┘         │  • Route handlers│
                         └────────┬─────────┘
                                  │ HTTP (server-side)
                                  ▼
┌──────────────────┐    ┌──────────────────┐
│  ai-worker       │───►│  FastAPI (8000)  │◄────┐
│  (Python)        │ HTTP│ • REST + WS     │     │ Postgres
│  • ValuationAg.  │     │ • Scheduler     │─────┤ (5432)
│  • SEOWriter Ag. │     │ • State machine │     │
│  • StubLLM/Ollama│     └──────────────────┘     │ Redis
└──────────────────┘                              │ (6379)
                                                  └─
```

Her servis bağımsız restart edilebilir. AI worker veya scheduler düşse de
API yaşamaya devam eder; frontend SSR sayfaları cookie ile çalışır.
