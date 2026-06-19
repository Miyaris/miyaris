# Miyaris Sahtekârlık Önleme Politikası ve Güvenlik Mührü Şartnamesi

**Yürürlük:** [TARİH]
**Versiyon:** v1.0 (taslak — avukat onayı bekliyor)
**Belge No:** 04

---

## Giriş

Lüks saat e-ticaretinde en büyük finansal ve itibari risk, **iade dolandırıcılığı (iade sahtekârlık)** olarak bilinen düzenektir. Tipik senaryolar:

1. **Bait-ve-Switch (Yem ve Tuzak):** Alıcı orijinal saati teslim alır, kendisindeki sahte/kopya saati "ayıplı" diyerek iade eder. Site sahte saati Satıcı'ya geri yollar; orijinal Alıcı'da kalır.
2. **Component Swap (Parça Değişimi):** Alıcı orijinal saatten değerli parçayı (kasa, mekanizma, kadran) söker, yerine sahte parça takıp iade eder.
3. **Wear-ve-Return (Kullan-İade):** Alıcı yüksek ürünü olay/fotoğraf çekimi için "Hemen Al" ile alır, kullanır, sonra "fikir değiştirdim" cayma hakkıyla iade eder.

Bu politika; Miyaris'in **fiziksel doğrulama**, **delil kayıt zinciri** ve **iade red şartları** ile bu dolandırıcılıkları önleme stratejisini tanımlar.

---

## Bölüm 1 — Ekspertiz Kayıt Standardı (Biyometrik Saat Kimliği)

Eksper, her saat için aşağıdaki delil setini sisteme yükler. Bu kayıtlar **değişmez** (değiştirilemez, denetim iz'li) olarak saklanır.

### 1.1 Tanımlayıcı Veriler

| Alan | Açıklama | Kaynak |
|---|---|---|
| **Seri Numarası** | Marka standardına göre kasa içi/dış/mekanizma kaydı | Kasa ve evrak |
| **Referans Numarası** | Modelin resmi katalog kodu | Kadran/arka kapak |
| **Hareket (Movement) Numarası** | Mekanizma seri kaydı (varsa) | Mekanizma plakası |
| **Üretim Yılı** | Saatin fabrika çıkış tarihi | Marka veritabanı / seri analiz |

### 1.2 Makro Fotoğraf Setleri (zorunlu)

Eksper aşağıdaki kritik noktaların **yüksek çözünürlüklü makro fotoğraflarını** çeker ve sertifika belgesine ekler:

1. **Kasa arka kapak — seri numarası kazıması** (tam çerçeve + yakınlaştırma in)
2. **Hareket / Mekanizma plakası** (kasadan ayrılmış görsel)
3. **Kadran 12 / 6 / 9 / 3 saat noktaları** (ışıkta + ters açı)
4. **Saat çevresi (iç bilezik)** üzerindeki kazıma (saat üretiminde standart)
5. **Kelebek toka iç yüzeyi** (marka logosu kazıma)
6. **Kadran patina, ışıma, lokal kusur** (varsa) — bireysel parmak izi gibi
7. **Bileklik bağlantı noktaları** içinde işlenmiş kodlar

Bu fotoğraflar tek bir saatin **dijital DNA'sı** olur. İade gelen ürün bu DNA ile karşılaştırılır; tek bir uyumsuzluk dolandırıcılık kanıtıdır.

### 1.3 Eksper İmzası

- Eksperin tam adı, ekspertiz tarihi, ortak mağaza unvanı
- WOSTEP / WatchCSA / AHCI gibi sertifikasyon varsa belirtilir
- Sertifika PDF'i e-imza ile imzalanır (varsa) veya ıslak imza taranır
- Numaralı Ekspertiz Belgesi ID

### 1.4 Saklama

- Tüm fotoğraflar ve üst veri Vercel Blob (CDN) + PostgreSQL denetim iz
- Saklama süresi: **satış sonrası 10 yıl** (TTK md. 82)
- Veri ihlali müdahale planı kapsamında yedeklenir

---

## Bölüm 2 — Güvenlik Mührü (Tamper-Evident Seal) Zorunluluğu

### 2.1 Mühür Özellikleri

- **Tek kullanımlık** plastik veya hologramlı kelepçe
- Her mühür **eşsiz seri numarası** taşır (örn. `MYR-SEAL-A1B2C3-2026`)
- Mühür koparıldığında **kalıcı iz** bırakır; geri takmak / klonlamak imkansızdır
- Hologram, UV-baskı, mikrolazer kazıma gibi sahteciliğe dayanıklı özellikler içerir
- Numaralı mühür sertifika belgesine **fotoğraflı olarak** eklenir

### 2.2 Mührün Takılma Süreci

Eksper, saat **orijinal** olarak doğrulandıktan sonra, **kargoya verilmeden hemen önce**:

1. Saatin kordonuna veya bilekliğine mührü takar
2. Mührün **takılı haldeki** makro fotoğrafını çeker
3. Mühür seri numarasını sertifika PDF'ine yazar
4. Kargo paketi açılırken görünmeyen iç kısıma **ikinci güvenlik bandı** uygulanır (paket bütünlüğü için)
5. Tüm süreç **opsiyonel olarak video** ile kayda alınır (yüksek tutarlı satışlarda zorunlu)

### 2.3 Alıcının Mühür Sorumlulukları

Alıcı, paketi teslim aldığında:

1. **Mühür kontrolü:** Sertifikadaki mühür seri numarası ile saat üzerindeki numaranın eşleştiğini doğrular
2. **Eşleşmiyor veya zarar görmüş:** Paketi açmadan derhal Site'ye bildirim (48 saat)
3. **Eşleşiyor:** Mührü ancak kendisi kullanıma başlamak için keser; bu noktadan sonra **iade hakkı sona erer** (TKHK md. 15/2 istisnaları + işbu politika)
4. Açma anının **video kaydı** önerilir (özellikle yüksek tutarlı satışlar için)

---

## Bölüm 3 — İade ve Cayma Reddi Halleri

İşbu politika kapsamındaki saatler için aşağıdaki durumlarda **iade ve cayma hakları kesin olarak ortadan kalkar**:

### 3.1 Güvenlik Mührü ihlalleri

- a) Saat üzerindeki mühür koparılmış, zedelenmiş, makaslanmış
- b) Mühür seri numarası sertifikadaki numara ile uyuşmuyor
- c) Mühür mevcut ama mührün fotoğrafı ile teslim alınan saatin mührü arasında **fiziksel uyumsuzluk** var (renk, hologram, kazıma tarzı)
- d) Mühür eksik (paketten çıkmamış)

### 3.2 Biyometrik kimlik ihlalleri

- e) İade edilen saatin seri numarası ekspertiz kaydındaki numaradan farklı
- f) İade edilen saatin mekanizması ekspertiz kaydındaki ile farklı
- g) Makro fotoğraflardaki kalıcı izler (patina, çizik, üretim hatası) iade edilen üründe yok veya farklı
- h) Kadran, ibre veya komponentler ekspertiz kaydındaki ile uyumsuz

### 3.3 Süre ve usul ihlalleri

- i) Bildirim 48 saat içinde yapılmamış (cayma hakkı için 14 gün geçerli; ayıp ihbarı için 30 gün ama bildirim hızlı)
- j) Paket açma video kaydı talep edildiğinde sunulmamış
- k) Ürün orijinal kutu/evrak/sertifika eksik gelmiş

### 3.4 İdari sonuçlar

Yukarıdaki ihlallerden biri tespit edildiğinde Site:

1. İade talebini **reddeder**, Güvenli Kasa'daki ödeme Satıcı'ya serbest bırakılır
2. Alıcı'nın hesabını **kalıcı olarak iptal eder**
3. Cumhuriyet Savcılığı'na **dolandırıcılık (TCK md. 157, 158)** suç duyurusunda bulunur
4. Zarar tazmini için hukuki yola başvurur
5. Sektör paylaşım listelerine (varsa: ITO, sektör birlikleri) bildirimde bulunur

[AVUKAT NOTU: Suç duyurusunda bulunma zorunluluğu mu, takdir mi? Otomatik tetiklemenin avantaj/dezavantajı]

---

## Bölüm 4 — Şüpheli İade Süreci (İhtilaf Yönetimi)

### 4.1 Alıcı bildirim iletti

Alıcı, paketi mühür kontrolü dahil **48 saat içinde** bildirim yaptıysa:

1. Site talepi inceler
2. Mühür durumu fotoğraflı doğrulanır
3. Saat Ortak Mağaza'ya gönderilir (Alıcı tarafından, sigortalı kargo)
4. Ekspertiz kayıtlarıyla karşılaştırma yapılır
5. **6 iş günü** içinde sonuç bildirilir

### 4.2 Sonuç senaryoları

- **Mühür ihlali yok + ürün gerçekten ayıplı:** Tam iade + kargo masrafı Site tarafından
- **Mühür ihlali yok + ürün ekspertiz kaydı ile aynı:** İade reddedilir, "fikir değişikliği" niteliğinde olduğu için cayma hakkı kullanılamaz (TKHK md. 15/2-d müzayede istisnası veya kişiselleştirilmiş ürün istisnası)
- **Mühür ihlali var:** Hesap iptali + suç duyurusu + zarar tazmini

### 4.3 Karşılıklı koruma — Satıcının pozisyonu

Bu politika sadece alıcıya değil, **satıcıya da** güvence verir:

- Alıcı tarafından dolandırıcılık tespit edildiğinde Satıcı'nın saati **ve** ödemesi korunur
- Site Satıcı adına süreç yürütür; Satıcı hukuki riske maruz kalmaz
- Satıcı'nın itibarı korunur (yanlış "sahte saat sattı" iddiasından)

---

## Bölüm 5 — Şeffaflık ve Önleyici Tedbirler

### 5.1 Listeleme öncesinde alıcıya bildirim

- "Hemen Al" veya "Teklif Ver" butonuna basmadan önce **net bilgilendirme**: "Bu ürüne uygulanan Sahtekârlık Önleme Politikası gereği, paket açıldıktan sonra mühür koparıldığında iade hakkı sona erer."
- Sertifika belgesi alıcıya teslim öncesi gösterilir
- Mühür seri numarası ve fotoğrafı alıcıya e-posta ile **teslim anında** iletilir

### 5.2 Alıcı eğitimi (UX akışında)

Site, kullanıcı yolculuğunun kritik noktalarında bilgilendirici içerik gösterir:

- Kayıt sırasında "Sahtekârlık Önleme Politikası" özet videosu (1-2 dk)
- Satın alma onayında onay kutusu: "Sahtekârlık Önleme Politikasını okudum ve kabul ettim"
- Paket teslim alındığında SMS/e-posta: "Paketi açmadan mühür kontrolü yapın, video kaydı tutmanızı öneriyoruz"

### 5.3 Reklam ve PR'da kullanım

"Sertifikalı saat" iddiasının yanı sıra Site:

- "Tamper-Evident Mühürlü Teslimat" rozeti
- "Biyometrik Saat Kimliği" hizmeti
- "Sahtekârlık Önleme Korumalı Müzayede" ibaresi

— gibi pazarlama materyallerinde kullanılır. **Avukat NOT:** "Sertifikalı" gibi iddialar Reklam Kurulu denetimine tabidir; ibareler önceden gözden geçirilmeli.

---

## Bölüm 6 — Sigorta ve Risk Havuzu

### 6.1 Kargo sigortası

- Tüm gönderilerde **CIF (Cost, Insurance, Freight)** seviyesinde kargo sigortası
- Kargo şirketinin sigorta poliçesi ile birlikte **ek havuz sigortası** (Yıllık prim ödenir, her gönderiyi 1 milyon TL'ye kadar kapsar)

### 6.2 Mesleki sorumluluk sigortası

Ortak Mağaza eksperlerinin yanlış doğrulama riskine karşı:

- Eksperin kendi mesleki sorumluluk sigortası (varsa)
- Site tarafından alınan ek **toplu poliçe** — yıllık prim ~100K TL
- Sahte saat onaylanması durumunda alıcının zararı bu poliçeden tazmin edilir

[AVUKAT NOTU: Türkiye'de saat eksperliği için sigorta ürünü mevcut mu? Allianz, AXA Türkiye sorgulanabilir]

---

## Bölüm 7 — Mahkeme ve Uyuşmazlık Çözümü

### 7.1 Sahtekârlık Önleme uyuşmazlıkları

İşbu politika kapsamındaki uyuşmazlıklar:

- **Adli mercilere** Cumhuriyet Savcılığı bildirimi (TCK md. 157, 158)
- **Hukuk mahkemelerine** zarar tazmini davası
- **Tüketici Hakem Heyeti'ne** başvuru: politikanın ihlali tüketicinin değil **dolandırıcının** sorumluluğu olduğundan, tüketici sıfatı tartışmalıdır

[AVUKAT NOTU: Tüketici sıfatlı alıcı dolandırıcılık yaptığında tüketici koruma şemsiyesinden çıkar — bu yorumun mahkeme içtihadına dayalı doğrulaması]

### 7.2 Yetkili mahkeme

- İstanbul (Çağlayan) Adliyesi

---

## Bölüm 8 — Politika Güncellemeleri

İşbu politika:

- Yılda bir kez **gözden geçirilir**
- Sektör pratikleri (StockX, Chrono24, Bezel, Crown & Caliber) takip edilir
- Sahtecilik teknolojileri ilerledikçe (3D baskı, derin sahtecilik) **mühür, fotoğraf ve doğrulama yöntemleri** güncellenir
- Önemli değişiklikler 30 gün öncesinden duyurulur

---

## EK A — Operasyonel Uygulama Listesi (Backend Geliştirme Notları)

### A.1 Saat ile Orijinallik Sertifikası veri yapısı genişletmesi

```
Certificate {
  ...mevcut alanlar
  + serial_number_macro_url    (Vercel Blob URL)
  + movement_serial_macro_url
  + dial_macros: [URL, URL, URL]  (12, 6, 9, 3 noktaları)
  + rehaut_macro_url
  + lugs_macro_url
  + tamper_seal_serial         (metin dizisi, eşsiz)
  + tamper_seal_photo_url      (takılı haldeki fotoğraf)
  + unboxing_video_url         (opsiyonel — yüksek tutarlı satışlar)
  + expert_signature           (e-imza veya taranmış ıslak imza)
  + standard_id                (WOSTEP/WatchCSA/AHCI)
}
```

### A.2 İade akışı uç nokta'i

```
POST /arayüz/v1/emanet ödeme/{id}/uyuşmazlık
  gövde: {
    sebep: metin dizisi,
    tamper_seal_serial_observed: metin dizisi,  // alıcının okuduğu numara
    tamper_seal_photo_url: metin dizisi,        // alıcının çektiği fotoğraf
    unboxing_video_url?: metin dizisi,
    notlar: metin dizisi,
  }
```

Backend otomatik mühür numara karşılaştırması yapar; uyuşmuyorsa otomatik 409 + fraud_flag.

### A.3 Admin paneli yeni sekme: "Sahtekârlık Önleme Vakaları"

- Tüm aktif uyuşmazlıklar listelenir
- Her vaka için ekspertiz kayıtları + alıcı bildirimi yan yana karşılaştırma
- Karar verme butonları: "İade Onayla", "İade Reddet + Sahtekârlık Bildir", "Daha Fazla Bilgi Talep Et"
- Suç duyurusu hazırlık modülü (PDF taslağı)

[Bu bölüm avukat onayından sonra teknik tarafa entegre edilecek]

---

**Politika Sahibi:** [ŞİRKET UNVANI]
**Onay Tarihi:** [TARİH]
**Sonraki Gözden Geçirme:** [TARİH + 12 AY]
