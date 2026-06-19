# Miyaris — Hukuk Belgeleri Klasörü

**Bu klasördekiler avukat tarafından son halini alacak TASLAKLARDIR.** Türk hukukuna göre temel zorunluluklar gözetilerek hazırlandı; nihai cila + risk değerlendirmesi için avukat onayı şarttır.

---

## Avukat için 5 dakikalık brief

### Miyaris nedir?

Türkiye'de yerleşik gerçek/tüzel kişilerin sahip olduğu **lüks saatleri** alıp satabildiği bir **online pazaryeri + müzayede platformu**. Üç temel akış:

1. **Direkt Satış (Miyaris Mağaza):** Satıcı sabit fiyatlı listeleme yapar; alıcı tıkla-al ile satın alır.
2. **Açık Artırma (Müzayede):** Saat haftalık veya presenter tarafından yönetilen oturumlarda canlı teklif alır; en yüksek teklif kazanır.
3. **Güvenli Kasa (Escrow):** Tüm ödemeler önce platforma gelir, saat fiziksel olarak anlaşmalı mağaza tarafından doğrulandıktan sonra satıcıya serbest bırakılır.

### Mevcut teknik altyapı

- **NVİ KPSPublic** ile gerçek zamanlı T.C. Kimlik doğrulaması (KYC)
- E-posta doğrulama, RS256 JWT auth
- Vercel Blob ile saat fotoğrafı + sertifika PDF storage
- Tüm işlemler audit trail (Bid + EscrowTransaction immutable)
- Render (Frankfurt/Ohio) + Vercel deployment
- PostgreSQL — kullanıcı + işlem + saat verisi

### Riskli alanlar (avukat dikkat etsin)

1. **Müzayede statüsü:** Aracılık mı yapıyoruz, kendimiz mi satıyoruz? "Aracı Hizmet Sağlayıcı" (6563 sayılı kanun) olarak konumlanmak en güvenli.
2. **Tüketici Hakem Heyeti:** B2C satışlarda sahte/ayıplı mal iddiasında platformun sorumluluğu nereye kadar?
3. **NVİ verisi işleme:** T.C. kimlik no + doğum yılı **özel nitelikli kişisel veri**. VERBİS sicili ve özel açık rıza şart.
4. **Müzayede tahkilatı:** "Kendi saatime kendim teklif veremem" + anti-sniping uzatma + reserve fiyat gibi kurallar yasal şart mı, sözleşmesel mi?
5. **Sahte saat sorumluluğu:** Eksper "AUTHENTIC" demiş ama sonradan sahte çıkarsa? Platform → eksper → satıcı zinciri sözleşmede net olmalı.
6. **Komisyon mekanizması:** Tüketici Kanunu kapsamında "komisyon" ifadesi vergi avantajı sağlar mı, "aracılık ücreti" mi demek lazım?
7. **Çekilme hakkı:** TKHK 15. madde 14 günlük cayma hakkı; müzayede ile alınan ürünlerde istisna kuralı var mı?

### Şirket bilgileri (avukat doldurur)

```
Tüzel Kişilik:    [ŞAHIS / LTD. ŞTİ. — karar avukat ile birlikte]
Unvan:            [Miyaris ........ veya MYR ........]
Vergi No:         [—]
Adres:            [—]
ETBİS Kayıt:      [—]
VERBİS Sicil No:  [—]
MERSİS:           [—]
e-Posta:          info@miyaris.com (planlanan)
Web:              https://miyaris.com
```

---

## Klasördeki belgeler (öncelik sırasına göre)

| Dosya | İçerik | Ne zaman onaylanmalı |
|---|---|---|
| `01-uyelik-sozlesmesi.md` | Kullanıcı kayıt sırasında onay verir | Lansman öncesi |
| `02-kvkk-aydinlatma-metni.md` | KVKK m.10 zorunluluğu | Kayıt formu öncesi |
| `03-acik-riza-metni.md` | NVİ verisi için ek rıza | Kayıt formu öncesi |
| `04-mesafeli-satis-sozlesmesi.md` | Her sipariş öncesi onay | İlk satış öncesi |
| `05-cerez-politikasi.md` | Çerez banner | Site yayınlanır yayınlanmaz |
| `06-muzayede-sartnamesi.md` | Açık artırma özel kuralları | İlk müzayede öncesi |
| `07-kullanim-sartlari.md` | Genel kullanım koşulları | Lansman öncesi |

---

## Avukatla görüşmede sorulması gerekenler

1. Şahıs şirketi mi LTD mi? (Müşteri sayısı + ciro beklentisi: ilk yıl ~500 üye, ~50 satış)
2. ETBİS + VERBİS başvuru sürecini birlikte mi yürütürüz?
3. Komisyon faturalandırması: hangi vergi sınıfı?
4. Müzayede şartnamesi noter onayı şart mı?
5. Sahte saat çıkması durumunda sigorta / sorumluluk havuzu öneririr misiniz?
6. Uluslararası satıcı/alıcı mümkün mü, mümkünse vergi etkisi?
7. Reklam ve PR'da "sertifikalı" iddiası nasıl yasal güvence altına alınır?

---

## NOT — bu taslaklar hukuki tavsiye değildir

Aşağıdaki belgeler yasal araştırmaya dayalı **kapsamlı taslaklardır** ancak bir avukatın güncel mevzuat + içtihat ile gözden geçirmesi ve nihai onayı alınmadan yayınlanmamalıdır.
