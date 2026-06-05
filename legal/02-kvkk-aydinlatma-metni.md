# Miyaris KVKK Aydınlatma Metni

**Yürürlük:** [TARIH]
**Versiyon:** v1.0 (taslak — avukat onayı bekliyor)

---

## Veri Sorumlusu

**[ŞIRKET UNVANI]** ("Miyaris" veya "Veri Sorumlusu")
**Adres:** [ADRES]
**Vergi No:** [VERGİ NO]
**MERSİS No:** [MERSİS]
**E-Posta:** kvkk@miyaris.com (planlanan)
**Web:** https://miyaris.com
**VERBİS Sicil No:** [—]

---

## İşlenen Kişisel Veriler

Miyaris, hizmetlerinin sunumu için aşağıdaki kişisel verileri işlemektedir:

### Kimlik Verileri (Özel Nitelikli)

- T.C. Kimlik Numarası
- Ad, Soyad
- Doğum Yılı
- MERSİS Numarası (kurumsal üyeler için)

### İletişim Verileri

- E-posta adresi
- Telefon numarası

### İşlem Verileri

- Hesap kayıt tarihi
- Üyelik geçmişi
- Listelenen saat bilgileri (marka, model, referans, yıl, durum, fotoğraf)
- Verilen teklifler (tutar, tarih, müzayede)
- Satın alma geçmişi
- Ödeme yöntemi (kredi kartı / banka havalesi — kart numarası saklanmaz, ödeme sağlayıcı PayU/iyzico tarafında token)
- Kargo / teslimat adresi (işlem sırasında alınır)

### Teknik Veriler

- IP adresi
- Tarayıcı bilgileri (User-Agent)
- Cihaz tipi
- Çerez verileri (ayrı politika ile detaylandırılmıştır)
- Site içi gezinme verileri

### Müzayede Verileri

- Teklif sıralama
- Teklif tutarları
- Müzayede sonuçları

---

## Veri İşleme Amaçları

Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:

1. **Üyelik akdi gereği:**
   - Hesap oluşturma ve yönetimi
   - NVİ üzerinden kimlik doğrulama (Kanunen Gerekli)
   - E-posta doğrulama
   - Şifre yenileme

2. **Hizmet sunumu:**
   - Saat listeleme ve satış akışı
   - Açık artırma akışı
   - Güvenli Kasa para emaneti
   - Komisyon hesaplama ve faturalandırma
   - Kargo / teslimat koordinasyonu

3. **Yasal yükümlülükler:**
   - MASAK bildirim yükümlülüğü (suç gelirleri aklanmasının önlenmesi)
   - Vergi mevzuatı (defter tutma, e-Fatura)
   - Tüketici Kanunu (cayma hakkı, ayıplı mal, garanti)
   - 6563 sayılı Elektronik Ticaret Kanunu
   - Yargı veya idari taleplere yanıt

4. **Meşru menfaat:**
   - Platform güvenliği (rate limit, fraud tespit)
   - Audit trail (immutable log)
   - Site performans analizi
   - Hizmet kalitesi ölçümü

5. **Açık rıza gerektiren amaçlar (ayrı rıza alınır):**
   - Pazarlama ve tanıtım e-postaları
   - Üçüncü taraf reklam ortakları ile veri paylaşımı
   - Profilleme

---

## Veri İşlemenin Hukuki Sebepleri

Kişisel verileriniz KVKK md. 5/2 ve 6/2 uyarınca aşağıdaki hukuki sebeplere dayanılarak işlenir:

- **a) Açık rıza:** Pazarlama e-postaları, profilleme
- **b) Sözleşmenin kurulması veya ifası:** Üyelik sözleşmesi, satış sözleşmesi
- **c) Veri sorumlusunun hukuki yükümlülüklerini yerine getirmesi:** Vergi, MASAK, KVKK, Ticaret Bakanlığı (ETBİS)
- **d) Bir hakkın tesisi, kullanılması veya korunması:** Yasal süreçler, audit
- **e) Veri sahibinin temel hak ve özgürlüklerine zarar vermemek kaydıyla meşru menfaat:** Güvenlik, fraud tespiti

---

## Özel Nitelikli Veriler (T.C. Kimlik No)

T.C. Kimlik Numarası, KVKK md. 6 kapsamında **özel nitelikli kişisel veri** olarak değerlendirilir.

### Toplama gerekçesi

- 6563 sayılı Elektronik Ticaret Kanunu
- 5237 sayılı TCK md. 245/A (yetkisiz banka/kredi kartı kullanımının engellenmesi)
- 5549 sayılı Suç Gelirlerinin Aklanmasının Önlenmesi Hakkında Kanun (MASAK)
- 6502 sayılı TKHK md. 5 (tüketici haklarının korunması)

### İşleme şartı

T.C. Kimlik No, **Aydınlatma Metni'nin yanı sıra ayrı Açık Rıza Metni** ile onayınız alınarak işlenmektedir.

### Saklama

- AES-256 ile şifreli olarak veritabanında saklanır
- Yetkisiz erişime karşı IAM ve audit log uygulanır
- Hizmet sona erdikten sonra **10 yıl** boyunca vergi/ticaret kanunları gereği saklanır

[AVUKAT NOTU: Saklama süresi 10 yıl Türk Ticaret Kanunu md. 82 uyarınca; doğrulanabilir]

---

## Verilerin Paylaşıldığı Taraflar

Kişisel verileriniz, yalnızca aşağıdaki taraflarla paylaşılır:

### Yurt İçi

- **NVİ:** Kimlik doğrulama amacıyla T.C. Kimlik No + Ad/Soyad/Doğum Yılı paylaşılır
- **Partner Mağaza (Ekspertiz):** Saat ekspertizi için Saat bilgileri + satıcı iletişim verileri
- **Kargo şirketleri (Aras, Yurtiçi vb.):** Teslimat için ad, soyad, adres, telefon
- **Ödeme sağlayıcı (iyzico / PayTR):** Ödeme işlemi için ad, soyad, e-posta, tutar
- **Mali müşavir / vergi dairesi:** Yasal zorunluluk
- **MASAK / yetkili idari merciler:** Kanunen talep edildiğinde

### Yurt Dışı

[AVUKAT NOTU: Render Frankfurt + Vercel global edge → veri yurt dışında işleniyor. KVKK md. 9 ile açık rıza şart, taahhütname/BCR sözleşme gerekli]

- **Render Inc. (ABD/Frankfurt):** Backend hosting; PostgreSQL veritabanı Frankfurt'ta
- **Vercel Inc. (ABD):** Frontend hosting + CDN
- **Resend (ABD):** E-posta gönderim altyapısı
- **Anthropic (ABD):** AI değerleme ajanları (uygulanan yerde)

Bu taraflarla **standart sözleşme klozları** (SCC) veya KVKK Kurulu izinli **bağlayıcı kurumsal kurallar** (BCR) çerçevesinde veri aktarımı yapılır. Açık rıza ayrıca alınır.

---

## Verilerin Saklanma Süresi

| Veri | Süre | Gerekçe |
|---|---|---|
| Hesap bilgileri (aktif üyelik) | Üyelik süresince | Hizmet sözleşmesi |
| T.C. Kimlik No | 10 yıl (kayıt iptalinden sonra) | TTK md. 82, vergi mevzuatı |
| Mali kayıtlar (fatura, sözleşme) | 10 yıl | TTK md. 82 |
| Müzayede / teklif geçmişi | 10 yıl | Audit trail, hukuki uyuşmazlık |
| Çerez verileri | 12 ay | Standart pratik |
| Pazarlama e-posta verileri | Onay geri alınana kadar | KVKK md. 11/d |
| Log kayıtları (IP, User-Agent) | 6 ay | 5651 sayılı Kanun (asgari) |

---

## Veri Sahibinin Hakları (KVKK md. 11)

KVKK md. 11 kapsamında aşağıdaki haklarınız bulunmaktadır:

1. Kişisel verilerinizin işlenip işlenmediğini öğrenme
2. İşlenmişse buna ilişkin bilgi talep etme
3. İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme
4. Yurt içinde veya yurt dışında verilerin aktarıldığı tarafları bilme
5. Verilerin eksik/yanlış işlenmesi halinde düzeltilmesini isteme
6. KVKK md. 7 çerçevesinde silinmesini veya yok edilmesini isteme
7. Düzeltme/silme işlemlerinin aktarılan üçüncü taraflara bildirilmesini isteme
8. Otomatik sistemlerle analiz edilmek suretiyle aleyhine sonuç ortaya çıkmasına itiraz etme
9. Kanuna aykırı işleme nedeniyle zarara uğraması halinde zararının giderilmesini talep etme

### Başvuru yolu

Talepleriniz için:

- **E-posta:** kvkk@miyaris.com
- **Posta:** [ADRES]
- **KEP:** [—]

Başvurularınız 30 gün içerisinde ücretsiz olarak yanıtlanır.

[AVUKAT NOTU: VERBİS sicil yapıldıktan sonra başvuru formu zorunlu — Veri Sahibi Başvuru Formu eklensin]

---

## Veri Güvenliği Önlemleri

### Teknik önlemler

- TLS 1.2+ ile şifreli iletişim (HTTPS)
- AES-256 ile veritabanı şifrelemesi
- RS256 imzalı JWT auth
- IP bazlı rate limit
- 2FA opsiyonu (gelecek faz)
- Düzenli güvenlik denetimi (penetrasyon testi)
- Audit log (immutable)

### İdari önlemler

- KVKK politikası ve eğitimi
- Çalışanlara gizlilik taahhüdü
- Üçüncü taraflarla veri işleyici sözleşmeleri
- Veri ihlali müdahale planı

---

## Veri İhlali Bildirimi

Veri ihlali durumunda KVKK Kurulu'na **72 saat içinde** ve etkilenen veri sahiplerine **en kısa sürede** bildirim yapılır (KVKK md. 12).

---

## Aydınlatma Metni'nin Güncellenmesi

İşbu metin gerektiğinde güncellenir. Önemli değişiklikler e-posta ile bildirilir.

**Son güncelleme:** [TARIH]

---

**Veri Sorumlusu:** [ŞIRKET UNVANI]
**İletişim:** kvkk@miyaris.com
