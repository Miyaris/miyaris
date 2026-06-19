# Miyaris — Lansman Yol Haritası

Bugüne kadar **teknoloji MVP'si** kuruldu: kayıt + KYC (NVİ), haftalık müzayede, presenter canlı oturum, Hemen Al, anti-sniping, Güvenli Kasa state machine, admin paneli. Eksik olan: yasal, ödeme, kargo, ekspertiz operasyonu ve pazarlama.

Aşağıdaki 6 faz, ürünü ciddi bir iş haline getirmek için sıralı + paralel bir plan. Toplam: ~6 ay realist, 4 ay agresif tempo.

---

## FAZ 0 — Bugün (TAMAMLANDI)

- ✅ Backend: FastAPI + SQLAlchemy + PostgreSQL, Alembic migration zinciri, RS256 JWT, refresh rotation, rate limit
- ✅ Frontend: Next.js 14 App Router, Vercel Blob, gerçek WS canlı müzayede
- ✅ NVİ KPSPublic entegrasyonu (T.C. doğrulama)
- ✅ Resend e-posta (kayıt, doğrulama, outbid bildirimi, admin notif)
- ✅ Presenter oturum sistemi (sıralı canlı satış, Instagram canlı yayını eşliğinde)
- ✅ Güvenli Kasa state machine (mock — gerçek banka entegrasyonu yok)
- ✅ Admin moderasyon, kullanıcı yönetimi, oturum yönetimi
- ⏸️ **Mock olan:** gerçek ödeme, gerçek kargo, gerçek ekspertiz

---

## FAZ 1 — Yasal & Tüzel Kuruluş (3-6 hafta)

**Hedef:** Ödeme almak, sözleşme imzalamak ve KVKK ihlali yapmamak için resmi bir tüzel kişiliğin olsun.

### 1.1 Şirket kuruluşu
- **Şahıs şirketi** mı **LTD** mi? Mali müşavire danış. Kural: ciro >300K TL/yıl beklentin varsa LTD daha avantajlı. İlk yıl şahıs, sonra LTD geçişi popüler.
- MERSİS kaydı → vergi numarası → ticaret odası kaydı
- Bütçe: **5-15K TL** (mali müşavir + harç)
- Süre: 2-3 hafta

### 1.2 E-ticaret yasal zorunlulukları
- **ETBİS kaydı** — Ticaret Bakanlığı, internetten satış yapan tüm sitelerin yasal zorunluluğu. Yapılmazsa para cezası.
- **Mesafeli Satış Sözleşmesi** — her sipariş öncesi alıcıya gösterilmek zorunda. Şu an yok.
- **KVKK Aydınlatma Metni** — kayıt sayfasında onay alınmalı. NVİ verisi işlediğin için **VERBİS sicili zorunlu**.
- **Çerez Politikası** — JavaScript tarafından çerez set edildiği için banner şart.
- **Kullanım Şartları + Gizlilik Politikası**

### 1.3 Müzayede statüsü kontrolü
- Türkiye'de **müzayede şartnameli faaliyet** belirli durumlarda noter onayı gerektirir. Tüketici hakem heyeti tartışmaları yaşamamak için **avukat danışmanlığı şart**.
- **C2C platform mu, alım-satım yapan tüccar mı?** Bu seçim vergi sicilini değiştirir. Şu an platform aracılığıyla satış yaptırıyorsun, "aracı hizmet sağlayıcı" statüsünde olmalısın.
- Bütçe: **3-7K TL avukat** (tek seferlik sözleşme paketi)

### 1.4 Faturalandırma
- e-Fatura / e-Arşiv mükellefi olmak gerekecek (ciro eşiği aşılınca)
- Komisyondan kestiğin tutarın faturasını şirket adına kesmek zorundasın
- Muhasebe yazılımı (Logo, Mikro, ya da bulutta Paraşüt) — aylık 200-500 TL

### Faz 1 sonu: yasal olarak para alıp veriyor olabileceğin bir altyapı var.

---

## FAZ 2 — Ödeme + Banka + Kargo (4-6 hafta, paralel)

**Hedef:** Gerçek ödeme akışı, gerçek para transferi, sigortalı kargo.

### 2.1 Sanal POS (sanal kredi kartı kabul)
- **iyzico** — en kolay başvuru, **%2.9 + 0.49 TL** komisyon. 7-14 gün onay.
- **PayTR** — benzer.
- **Garanti / İş Bankası kendi POS'u** — komisyon %1.5-2 daha düşük ama kurumsal başvuru gerekiyor, 4-8 hafta.
- 3D Secure ZORUNLU (yasal): tüm işlemler.
- Backend'de mevcut `EscrowTransaction.payment_provider_ref` alanı bunu tutmak için zaten hazır.

### 2.2 Banka hesabı + havuz hesabı
- Şirket adına ticari hesap aç
- **Para emanette** kalacağı için ayrı havuz hesabı önerilir (vekâleten emanet hesabı)
- EFT komisyon anlaşması (bireysel müşterilerden gelecek)
- IBAN doğrulama servisi entegrasyonu (TROY uyumluluk)

### 2.3 Kargo entegrasyonu
- **Aras Kargo** veya **Yurtiçi Kargo** kurumsal anlaşma
- API entegrasyonu: barkod oluşturma, takip, fiyat hesaplama
- **Sigortalı kargo zorunlu** — taşıma sigortası (kargo değeri üzerinden %0.5-1)
- Backend'de `delivery_code` zaten oluşturuluyor; API'ye geçmek 1 sprint

### 2.4 Sahte koruması (chargeback yönetimi)
- Sanal POS sağlayıcı her chargeback için cezalandırır (~250 TL)
- Korumalar:
  - 3DS zorunlu
  - KYC (zaten var, NVİ ile)
  - Yüksek tutarlı işlem için manuel onay
  - Kara liste / fraud sinyalleri

### Faz 2 sonu: Gerçek para işlemi yapabilecek altyapıdasın.

---

## FAZ 3 — Ekspertiz Operasyonu (4-6 hafta)

**Hedef:** Satılan saatlerin "sertifikalı" olduğunu somut hale getir.

### 3.1 Partner mağaza ağı
- **Hedef: 2-3 anlaşmalı mağaza** (İstanbul Nişantaşı, Levent, Ataşehir; Ankara Çankaya; İzmir Alsancak)
- Aday firmalar: Saat & Saat, Atasay, Çağdaş Saat (büyük zincirler iş birliğine sıcak değil — bağımsız butikler dene)
- Sözleşme: ekspertiz başına sabit ücret (örn. 500-1000 TL) veya komisyondan pay (%5-10)
- Eksperin yetkinliği: WOSTEP, WatchCSA, AHCI sertifikalı tercih edilir

### 3.2 Fiziksel akış
1. Satıcı saati anlaşmalı mağazaya kargolar (delivery_code ile)
2. Eksper saati alır, durum tespiti yapar, fotoğraf çeker
3. Backend'de moderation queue'ya düşer (zaten var)
4. Eksper karar verir: AUTHENTIC / SERVICE_PARTS / NOT_AUTHENTIC / INCONCLUSIVE
5. Eğer AUTHENTIC → müzayedeye girer
6. Satıştan sonra eksper saati alıcıya kargolar (Güvenli Kasa serbest bırakılır)

### 3.3 Ekspertiz standartı
- 30 maddelik checklist (kasa, kadran, kelebek, hareket, seri no, kutu, evrak)
- Her madde için fotoğraflı doğrulama
- Standart sertifika PDF formatı (bunun template'i zaten outputs/ klasörde hazırlandı)

### 3.4 Sahte tespit edilirse
- Saat geri kargolanır, satıcı kalıcı banlanır (`FAKE verdict` zaten var)
- Tüketici hakem heyeti / icra riski: avukatla netleştir

### Faz 3 sonu: Saatlerin sertifikalı olduğunu somut gösterebilirsin.

---

## FAZ 4 — Teknik Sertleştirme (3-4 hafta, FAZ 2-3 ile paralel)

**Hedef:** Production-grade güvenilirlik.

### 4.1 Monitoring
- **Sentry** — backend + frontend exception tracking (free tier 5K event/ay yeter ilk başta)
- **Better Stack** veya **Uptime Robot** — health check + uptime
- **Render dashboard** — CPU/memory/DB metrics
- Slack veya e-posta'ya alert webhook'u

### 4.2 Backup & Disaster Recovery
- Render PostgreSQL **point-in-time recovery** (Pro tier $15/ay ekstra)
- Vercel Blob — fotoğraflar zaten replikası var
- JWT key pair: 1Password'de + Apple Keychain'de (zaten yapıyorsun)
- **Restore drill** yap — backup'tan dev DB'ye geri yükleme provası, ayda 1

### 4.3 Test coverage
- Backend: **PyTest** — şu an çok az test var. Hedef: %70 coverage (özellikle escrow state machine, bid validations, presenter session flow)
- Frontend: **Playwright** E2E (login → bid → satın al kritik akış)
- CI'da: GitHub Actions ile her PR'da test çalışsın

### 4.4 Performans
- Sayfa hızı: Vercel Speed Insights aktif
- Backend cache: Redis (Render add-on $10/ay) — auction listesi, watch detayı
- Image CDN: Vercel Blob zaten serve ediyor, ek optimizasyon `next/image`

### 4.5 Yük testi
- **Locust** ile 100 eşzamanlı user simulation
- Müzayede son saniye 50 bid/saniye senaryosunu test et
- WebSocket bağlantı sınırlarını gör

### 4.6 Güvenlik
- **OWASP ZAP** veya **Burp Suite** ile pentest
- Dependabot otomatik dependency update
- HSTS, CSP gibi güvenlik header'larını sertleştir (ileride)
- Penetration test bütçesi: 15-30K TL (5. ay civarı)

### Faz 4 sonu: Production olarak satılabilir bir altyapı.

---

## FAZ 5 — Beta Lansman (3-4 hafta)

**Hedef:** Gerçek müşterilerden geri bildirim al, kritik bug'ları çık.

### 5.1 Davetli kullanıcı
- **20-50 kişi** — saat koleksiyoneri arkadaşların, Instagram'da takipçin, saat forumu üyeleri
- Davet kodu sistemi (basit: register sayfasında `INVITE_CODE` env'i kontrol)
- WhatsApp/Telegram beta group → günlük iletişim

### 5.2 Pilot ürünler
- **5-10 gerçek saat** — kendi koleksiyonun + anlaşmalı mağaza katkıları
- 1 haftalık küçük müzayede + 2-3 direkt satış
- Reserve fiyatı düşük tut (test amaçlı, satılırsa kâr, satılmazsa öğrenme)

### 5.3 Geri bildirim toplama
- Hotjar veya basit feedback form'u
- Beta sonu **1 saatlik kullanıcı görüşmeleri** (5-10 kişiyle)
- Ön yüz UX iyileştirmeleri
- Edge case bug'ları (özellikle ödeme + kargo gerçek senaryoda)

### 5.4 NPS skoru ölç
- Net Promoter Score: "0-10 arası, arkadaşına önerir misin?"
- < 30: ürün hazır değil, beta uzat
- 30-50: launch'a geç ama yakından takip et
- > 50: agresif büyümeye hazır

### Faz 5 sonu: %95 stabil, kullanıcı validate etmiş bir ürün.

---

## FAZ 6 — Açık Lansman & Büyüme (sürekli)

**Hedef:** Aylık 50+ satış, brand awareness, sürdürülebilir gelir.

### 6.1 PR & basın
- **Webrazzi, Donanım Haber, T24** ekonomi sayfaları — start-up haberi
- Saat dergileri: **Saat & Saat dergisi, Time Spent** (varsa)
- Influencer: mikro saat hesapları (10-50K takipçili), tek seferlik PR

### 6.2 İçerik & SEO
- **Blog** — "Submariner Nasıl Anlaşılır?", "Patek Calatrava 5196 değerleme", marka rehberleri
- Hedef anahtar kelimeler:
  - "lüks saat müzayedesi" (ay 2K arama)
  - "rolex submariner satış" (ay 5K)
  - "ikinci el patek philippe" (ay 1K)
- Google Search Console → indekslenme takibi (zaten metadata + sitemap var)

### 6.3 Sosyal medya
- **Instagram** — günlük 1-2 saat post + reel (kapak fotoğrafları, sertifika hikayeleri)
- **Instagram Live** — presenter oturumları için zaten hazır
- **TikTok** — gençlere ulaşma (ikinci el saat trendi)
- **YouTube** — uzun form ekspertiz video, brand build

### 6.4 Topluluk
- **Telegram grubu** — alıcı + satıcı + meraklı
- Aylık offline meetup (İstanbul'da kafede, 20-30 kişi)
- Saat müzayedeleri Türkiye Discord (var mı bilmiyorum, yoksa kur)

### 6.5 Referans programı
- Satıcı 1 saat satarsa: komisyondan **%1 indirim** sonraki satışında
- Alıcı arkadaşını davet ederse: ilk teklif kredisi
- Backend'de kupon/promo sistemi: yeni feature (FAZ 7)

### 6.6 Ölçeklendirme sinyalleri
- Aylık 50+ satış olunca → ekspertiz partneri sayısını 5-7'ye çıkar
- Aylık 100+ satış → kendi ekspertizini kur (eksper işe al)
- Aylık 200+ satış → sermaye yatırımı / yatırımcı turu

---

## Maliyet özeti (ilk 6 ay)

| Kalem | Tutar (TL) |
|---|---|
| Yasal kuruluş + avukat | 10-20K |
| Aylık altyapı (Render Pro + Vercel Pro + Resend + Sentry) | 1.5-2K × 6 ay = 12K |
| Domain + SSL (zaten var) | 0 |
| Sanal POS başvuru + ilk komisyonlar | 0-5K |
| Kargo + sigorta (ilk işlemler) | 5-10K |
| Ekspertiz partner avansı | 10-20K |
| Pentest (5. ay) | 15-30K |
| Pazarlama + PR (ilk 3 ay) | 30-50K |
| Beta dönemi ürün (kendi koleksiyon) | satın değil, ödünç |
| **TOPLAM** | **~80-150K TL** ilk 6 ay |

Sermaye gerekmiyorsa: kendinden 30-50K TL ile başla, FAZ 5 sonunda gelirler giderleri karşılar.

---

## Risk haritası

### Yüksek risk
- **Sahte saat satışı**: tek 1 sahte saat → marka itibarı bitebilir. Ekspertiz partner kalitesi kritik.
- **Chargeback dolandırıcılık**: KYC + 3DS + manuel onay (>50K TL) zorunlu.
- **Kargo zayiat**: sigortasız asla. Tek bir Patek kaybı 500K TL geri ödeme.

### Orta risk
- **Düşük likidite**: ilk aylarda az müşteri = az saat = az müşteri (chicken-egg). Çözüm: kendin saat koy, anlaşmalı mağazadan ödünç al.
- **NVİ rate limit / kapanma**: NVİ KPSPublic resmi servisi bazen yavaş. Fallback: manuel admin onay (zaten var).
- **Render outage**: Vercel + Render ikilisi 99.9% uptime'da kalır ama kritik dönemde (canlı müzayede) downtime = direkt para kaybı. Status page kur, kullanıcıya haber ver.

### Düşük risk
- **Teknik scaling**: 1000 eş zamanlı kullanıcıya kadar mevcut yapı dayanır.
- **Bug**: yeterli test coverage ile MVP bug'ları kontrol altında.

---

## Sıralı eylem planı (önce hangi 3 şeyi yap?)

### Hafta 1-2
1. **Mali müşavire git** — şahıs mı LTD mi, ETBİS, VERBİS sicili açtır
2. **Avukatla 1 toplantı** — müzayede statüsü + sözleşme paketi sipariş et
3. **NPS ölçecek bir feedback formu ekle** — şu an kullanıcı geri bildirimi için backend hazır

### Hafta 3-6
4. iyzico veya PayTR sanal POS başvurusu
5. Backend'de ödeme entegrasyonu (mock yerine gerçek)
6. Partner mağaza için 5 firma listesi → randevu

### Hafta 7-12
7. Beta davet listesi (50 kişi)
8. Pilot müzayede planı: 1 oturum, 5 saat, 1 hafta
9. Sentry + monitoring kurulumu
10. PyTest temel coverage (kritik akışlar)

---

## Bugün ne yapmalısın?

1. Bu dosyayı oku
2. Mali müşavir + avukat için **2 randevu** al (en kritik blokaj)
3. **Domain hala miyaris.com mu?** Marka tescili Türk Patent'te yap (1500 TL, 2-3 ay onay)
4. Marka tescili paralel ilerlerken Faz 1'i başlat

Geri kalanları sırayla tek tek geçeriz. Her faz sonunda durup tekrar değerlendiririz.
