# Mesafeli Satış Sözleşmesi

**Versiyon:** v1.0 (taslak — avukat onayı bekliyor)
**İşlem No:** [SISTEM_TARAFINDAN_OTOMATIK_UR.]

> **NOT:** Bu belge alıcının her satın alma işleminde dinamik olarak gösterilir; alıcı bilgileri ve ürün bilgileri otomatik doldurulur.

---

## 1. Sözleşmenin Tarafları

### Satıcı (Listing Owner)

**Ad:** [SATICI_AD_SOYAD]
**Adres:** [SATICI_ADRES — kargo amaçlı; gizli tutulur, sadece kargo şirketine paylaşılır]
**Telefon:** [—]
**E-posta:** [—]

### Aracı (Hizmet Sağlayıcı)

**Unvan:** [MIYARIS_SIRKET_UNVANI]
**Adres:** [—]
**Vergi No:** [—]
**MERSİS:** [—]
**ETBİS Kayıt No:** [—]
**E-posta:** destek@miyaris.com (planlanan)
**Telefon:** [—]

### Alıcı

**Ad:** [ALICI_AD_SOYAD]
**Adres:** [TESLIMAT_ADRESI]
**Telefon:** [—]
**E-posta:** [—]
**T.C. Kimlik No / VKN:** [—]

---

## 2. Sözleşmenin Konusu

Alıcı'nın Site üzerinden seçtiği ve aşağıda nitelikleri belirtilen ürünün satışı ve teslimi.

### Ürün Bilgileri

| Alan | Değer |
|---|---|
| Marka | [BRAND] |
| Model | [MODEL] |
| Referans No | [REFERENCE] |
| Yıl | [YEAR] |
| Durum | [CONDITION — Sıfır/Mint/Mükemmel/İyi/Orta] |
| Kutu / Evrak | [BOX_PAPERS] |
| Açıklama | [DESCRIPTION] |
| Saat Görsel ID | [WATCH_ID] |

---

## 3. Satış Bedeli ve Ödeme

### 3.1 Toplam Tutar

| Kalem | Tutar (USD/TL) |
|---|---|
| Ürün Fiyatı | [PRICE] |
| Kargo Ücreti | [SHIPPING — sigortalı kargo dahildir] |
| EFT İndirimi (varsa) | -[DISCOUNT] |
| **TOPLAM ÖDENECEK** | **[TOTAL]** |

### 3.2 Ödeme Yöntemi

Alıcı tarafından seçilen ödeme yöntemi: [PAYMENT_METHOD — Kredi Kartı / Banka Havalesi]

**Kredi Kartı:**
- Ödeme iyzico / PayTR (3D Secure) üzerinden alınır
- Tutar anında çekilir, Güvenli Kasa'ya aktarılır
- Kart bilgileri Miyaris tarafından saklanmaz

**Banka Havalesi (EFT):**
- %2.5 indirim uygulanır
- IBAN: [IBAN — havuz hesabı]
- Açıklamaya **işlem numarası** yazılması zorunludur
- 3 iş günü içinde havale yapılmazsa sipariş otomatik iptal edilir

### 3.3 Aracılık Ücreti

Bu sözleşmede belirtilen tutar **alıcının ödediği nihai tutardır**. Aracılık ücreti (komisyon) Satıcı'dan kesilir; alıcının ekstra ödeyeceği bir tutar yoktur.

---

## 4. Teslimat

### 4.1 Süreç

1. **Adım 1 (T+0):** Alıcı ödemeyi yapar. Tutar Güvenli Kasa'ya aktarılır.
2. **Adım 2 (T+0..3 gün):** Satıcı saati Ortak Mağaza'ya gönderir (kargo Satıcı tarafından).
3. **Adım 3 (T+5..7 gün):** Ortak Mağaza saati fiziksel olarak inceler:
   - **Orijinal çıkarsa:** Saat Alıcı'ya kargolanır, Güvenli Kasa Satıcı'ya aktarılır.
   - **Orijinal çıkmazsa veya kusur tespit edilirse:** Saat Satıcı'ya iade edilir, Güvenli Kasa Alıcı'ya iade edilir.
4. **Adım 4 (T+10..14 gün):** Alıcı saati teslim alır. Teslim alındığı anda satış kesinleşir.

### 4.2 Teslimat süresi

Toplam teslimat süresi **10-14 iş günüdür**. Bu süre Ortak Mağaza ekspertiz süresi ve kargo süresinin toplamıdır.

[AVUKAT NOTU: TKHK md. 6 — taahhüt edilen sürede teslim edilmemesi halinde tüketici cayma hakkına sahiptir. Yazılı süre 30 gün olarak ifade edilmeli mi?]

### 4.3 Kargo

- Kargo şirketi: Aras Kargo / Yurtiçi Kargo (Site seçimine göre)
- **Sigortalıdır** — kayıp veya hasarda Site sorumludur
- Hasar tespit edildiğinde 48 saat içinde fotoğraflı bildirim yapılmalıdır

---

## 5. Cayma Hakkı (TKHK md. 15)

### 5.1 Genel kural

Alıcı, ürünü teslim aldığı tarihten itibaren **14 gün içerisinde** hiçbir hukuki ve cezai sorumluluk üstlenmeksizin, hiçbir gerekçe göstermeksizin sözleşmeden cayma hakkına sahiptir.

### 5.2 Cayma istisnaları

**Aşağıdaki durumlarda cayma hakkı KULLANILAMAZ** (TKHK md. 15/2):

a) Tüketicinin istekleri doğrultusunda hazırlanan veya kişiselleştirilen ürünler
b) Niteliği gereği iade edilemeyen ürünler
c) Açık artırma ile alınmış ürünler (**Müzayede satışlarında cayma hakkı yoktur**)

[AVUKAT NOTU: Müzayede istisnası TKHK md. 15/2-d kapsamında — net belirtilsin ki müzayede alıcısı caymayamayacağını bilsin]

### 5.3 Cayma süreci

Cayma hakkını kullanmak isteyen Alıcı:

1. destek@miyaris.com adresine **yazılı bildirim** gönderir
2. Ürünü **orijinal kutu, evrak ve sertifikası ile birlikte**, **kullanılmamış / hasarsız** halde 10 iş günü içinde Site'ye iletir
3. Site ürünü teslim alır ve Ortak Mağaza tarafından **tekrar inceleme** yapar
4. Uygun bulunursa **ödeme tutarı 14 gün içerisinde iade edilir**

### 5.4 İade kargosu

- Cayma sebebi ürünün ayıplı olması ise kargo masrafı **Site'ye** aittir
- Cayma sebebi alıcıdan kaynaklanıyorsa kargo masrafı **alıcıya** aittir

---

## 6. Ayıplı Mal ve Garanti

### 6.1 Ayıp tespiti

Alıcı, teslimi takip eden 30 gün içinde ürünün ayıplı (sahte, ciddi kusurlu) olduğunu tespit ederse:

- destek@miyaris.com adresine ayıp ihbarı gönderir
- Ürün Site'ye iade edilir
- Ortak Mağaza tekrar inceleme yapar
- Ayıp tespit edilirse **tam iade** + **gönderim masrafı tazmini** yapılır

### 6.2 Ayıbın gizlenmesi durumunda Satıcı'nın sorumluluğu

Satıcı, ürünün gerçek durumunu sakladığı tespit edildiğinde:

- Üyeliği kalıcı olarak sonlandırılır
- Yapılan tüm satışlar incelenir
- Suç teşkil ediyorsa savcılığa bildirim yapılır

---

## 7. Mücbir Sebepler

Aşağıdaki durumlarda Site'nin sorumluluğu doğmaz:

- Deprem, sel, yangın, salgın hastalık
- Savaş, terör, iç karışıklık
- Yasal düzenlemelerdeki değişiklikler
- İnternet altyapısının kesilmesi
- Üçüncü taraf hizmet kesintileri (NVİ, kargo, banka)

---

## 8. Uyuşmazlık Çözümü

### Tüketici sıfatlı Alıcı

- **Tüketici Hakem Heyeti** — değer sınırına kadar (2026: ~24.000 TL)
- **Tüketici Mahkemeleri** — bu sınır üstü

### Ticari Alıcı

- Yargı yetkisi: İstanbul Çağlayan Adliyesi

---

## 9. Yürürlük ve Kabul

İşbu Sözleşme, Alıcı'nın site üzerinde **"Satın Al"** veya **"Ödeme Yap"** butonuna tıklaması ile elektronik olarak kabul edilmiştir. Bu işlem, sözleşmenin tüm hükümlerini okuyup anladığı ve kabul ettiği anlamına gelir.

Sözleşmenin bir nüshası Alıcı'nın e-posta adresine otomatik olarak gönderilir.

---

**Aracı (Hizmet Sağlayıcı) — Elektronik Onay:** [TIMESTAMP]
**Alıcı — Elektronik Kabul:** [TIMESTAMP]
**Satıcı — Listeleme Aşamasında Önceden Kabul:** [TIMESTAMP]
