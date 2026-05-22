import Link from "next/link";

import { Container } from "@/components/shared/Container";

export const metadata = {
  title: "Sertifikasyon Süreci",
  description:
    "Miyaris vitrinindeki her saat, uzman ekibimizin çok aşamalı sertifikasyon sürecinden geçer.",
};

interface ChecklistItem {
  title: string;
  body: string;
}

interface Stage {
  num: string;
  eyebrow: string;
  title: string;
  intro: string;
  checklist: ChecklistItem[];
}

const STAGES: Stage[] = [
  {
    num: "01",
    eyebrow: "Teslim",
    title: "Partner Mağazaya Fiziki Teslim",
    intro:
      "Satıcı saatini partner mağazamıza şahsen veya sigortalı kargoyla teslim eder. Bu adım Miyaris sertifikasyonun başlangıç noktasıdır — fotoğraf üzerinden değerlendirme yapılmaz, her parça uzmanın elinden geçer.",
    checklist: [
      {
        title: "Kimlik & sahiplik teyidi",
        body: "Teslim eden kişinin satıcıyla aynı olduğu, T.C. kimlik ve faturayla doğrulanır.",
      },
      {
        title: "Aksesuar envanteri",
        body: "Kutu, garanti belgesi, ek kayışlar — varsa her parça tek tek listelenir ve fotoğraflanır.",
      },
      {
        title: "Sigortalı muhafaza",
        body: "Teslim alındığı andan itibaren saat, sigortalı kasa içinde uzman değerlendirmesine kadar bekler.",
      },
    ],
  },
  {
    num: "02",
    eyebrow: "Görsel Ekspertiz",
    title: "Büyüteç Altında Çok Noktadan İnceleme",
    intro:
      "Sertifikalı saat uzmanlarımız her saati 10x büyütmeli büyüteç ile inceler. Hareket, kadran, kasa, taç ve kasa arkası tek tek karşılaştırılır; üretici imzaları ve seri numaraları referans kayıtlarımızla doğrulanır.",
    checklist: [
      {
        title: "Kadran & kavrama detayı",
        body: "Kadran detayları ve indeksler, taç logoları, baskı kalitesi — üreticinin orijinal toleranslarıyla kıyaslanır.",
      },
      {
        title: "Mekanizma",
        body: "Köprü işlemeleri, rotor süslemeleri, rubi yatak sayısı: orijinal kalibrenin imza özellikleri tek tek doğrulanır.",
      },
      {
        title: "Kasa & seri numarası",
        body: "Seri numarası üretici arşivimizdeki kayıtla eşleştirilir. Yeniden cila izi, kaynak veya repor varsa raporlanır.",
      },
    ],
  },
  {
    num: "03",
    eyebrow: "Teknik Doğrulama",
    title: "Mekanik & Su Geçirmezlik Testleri",
    intro:
      "Görsel inceleme yeterli değildir. Saatin gerçekten çalıştığını ve üreticinin ilan ettiği toleranslarda performans gösterdiğini doğrulamak için mekanizma performans raporu üretilir.",
    checklist: [
      {
        title: "Mekanik Hassasiyet Ölçümü",
        body: "Günlük saniye sapması, vuruş hatası ve mekanizma salınım değerleri 6 pozisyonda kayıt altına alınır.",
      },
      {
        title: "Su geçirmezlik (talep üzerine)",
        body: "Üretici sertifikasında dalış/su özelliği belirtilen modeller için kuru basınç testi yapılır.",
      },
      {
        title: "Rezerv & güç akışı",
        body: "Otomatik kurmalı saatlerde rotor verimi, manuel kurmalılarda zemberek geri akışı kontrol edilir.",
      },
    ],
  },
  {
    num: "04",
    eyebrow: "Sertifika",
    title: "Miyaris Sertifikası ile Yayın",
    intro:
      "Üç aşamayı geçen her saat, kendine özel bir Miyaris Sertifikası ile vitrinimize çıkar. Sertifika, alıcıya saatin geçmişini, kontrol noktalarını ve uzman onayını şeffaf şekilde sunar.",
    checklist: [
      {
        title: "Dijital sertifika",
        body: "Her saat için QR doğrulanabilir, blok-zincir benzeri hash'li dijital sertifika üretilir.",
      },
      {
        title: "Şeffaf rapor",
        body: "Tüm test sonuçları, fotoğraflar ve uzman notları alıcıya kapalı zarfta dijital olarak sunulur.",
      },
      {
        title: "İade güvencesi",
        body: "Sertifikalı saat satıştan sonra orijinallik testinde başarısız olursa, ödemenin tamamı alıcıya iade edilir.",
      },
    ],
  },
];

const TRUST_POINTS: { title: string; body: string }[] = [
  {
    title: "Bağımsız Uzman Ekip",
    body: "Miyaris uzmanları, Türkiye'deki bağımsız saat ekspertizi kuruluşlarından sertifikalıdır. Hiçbir uzman satıcıyla ekonomik bağ taşıyamaz; raporlar tamamen tarafsızdır.",
  },
  {
    title: "Reddedilebilir Saatler",
    body: "Sahte, replika veya ciddi şekilde modifiye edilmiş saatler vitrinimize giremez. Şüpheli bir parçanın seri numarası uluslararası kayıp/çalıntı veritabanlarıyla da karşılaştırılır.",
  },
  {
    title: "Açık Süreç",
    body: "Satıcı her aşamada bilgilendirilir; bir saat reddedildiğinde gerekçesi açık, raporlu ve itirazlara açık şekilde paylaşılır.",
  },
];

export default function AuthenticationPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-line">
        <Container className="py-24 md:py-32">
          <div className="max-w-3xl">
            <span className="eyebrow">Güven</span>
            <h1 className="font-display text-5xl md:text-6xl leading-[1.05] mt-6">
              Sertifikasyon Süreci.
              <br />
              <span className="text-brass">Her saat, dört kapıdan geçer.</span>
            </h1>
            <p className="mt-8 text-lg text-charcoal-500 leading-relaxed">
              Miyaris'te yayına çıkan her saat fiziksel olarak elimize ulaşır;
              uzmanlarımız büyüteç altında, hassasiyet ölçüm cihazları önünde
              ve referans arşivimizle karşılaştırarak doğrular. Sahte saatin
              Miyaris vitrinine girmesi yapısal olarak mümkün değildir.
            </p>
          </div>
        </Container>
      </section>

      {/* Aşamalar */}
      <section>
        <Container className="py-24 md:py-32">
          <div className="max-w-2xl mb-20">
            <span className="eyebrow">Dört Aşama</span>
            <h2 className="font-display text-4xl mt-4">
              Teslim, görsel ekspertiz, teknik test, sertifika.
            </h2>
          </div>

          <div className="space-y-20">
            {STAGES.map((stage) => (
              <div
                key={stage.num}
                className="grid md:grid-cols-[120px_1fr] gap-8 md:gap-16"
              >
                <div>
                  <div className="font-display text-6xl text-brass">
                    {stage.num}
                  </div>
                  <span className="eyebrow text-charcoal-500 mt-3 block">
                    {stage.eyebrow}
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-3xl mb-5">{stage.title}</h3>
                  <p className="text-charcoal-500 leading-relaxed mb-8">
                    {stage.intro}
                  </p>
                  <ul className="space-y-5">
                    {stage.checklist.map((item) => (
                      <li
                        key={item.title}
                        className="border-l-2 border-brass/40 pl-5"
                      >
                        <div className="text-sm font-medium text-charcoal mb-1">
                          {item.title}
                        </div>
                        <div className="text-sm text-charcoal-500 leading-relaxed">
                          {item.body}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Bağımsızlık */}
      <section className="bg-cream/40 border-y border-line">
        <Container className="py-24">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow">Bağımsızlık</span>
            <h2 className="font-display text-4xl mt-4">
              Uzman tarafsızlığı, sistemin omurgasıdır.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {TRUST_POINTS.map((p) => (
              <div key={p.title}>
                <h3 className="font-display text-xl mb-3">{p.title}</h3>
                <p className="text-sm text-charcoal-500 leading-relaxed">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section>
        <Container className="py-24 md:py-32 text-center">
          <span className="eyebrow">Sırada</span>
          <h2 className="font-display text-4xl md:text-5xl mt-4 mb-8">
            Saatiniz hazırsa, biz hazırız.
          </h2>
          <p className="text-charcoal-500 max-w-xl mx-auto mb-10 leading-relaxed">
            İlanınızı oluşturun — partner mağaza koordinatlarımızı paylaşalım,
            sertifikasyon sürecini birlikte başlatalım.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sell-watch"
              className="inline-block px-10 py-4 text-xs uppercase tracking-[0.2em] bg-charcoal text-cream hover:bg-charcoal/90"
            >
              Saatinizi Satın
            </Link>
            <Link
              href="/how-it-works"
              className="inline-block px-10 py-4 text-xs uppercase tracking-[0.2em] border border-charcoal text-charcoal hover:bg-charcoal hover:text-cream transition-colors"
            >
              Tüm Akışı Gör
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
