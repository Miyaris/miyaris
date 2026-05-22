import Link from "next/link";

import { Container } from "@/components/shared/Container";

export const metadata = { title: "Nasıl Çalışır" };

interface Step {
  num: string;
  title: string;
  body: string;
}

const AUCTION_STEPS: Step[] = [
  {
    num: "01",
    title: "Ön Ekspertiz",
    body: "Müzayedeye girecek saatler önce partner mağazaya teslim edilir. Uzmanlar saatin orijinalliğini fiziksel olarak doğrular; ilanınız o ana kadar Ön Ekspertiz aşamasında bekler. Onay alındığında otomatik olarak haftalık müzayede planına alınır.",
  },
  {
    num: "02",
    title: "Haftalık Açık Artırma",
    body: "Onaylı saatiniz her Pazartesi 00:00'da açılan, Pazar 23:59'da kapanan müzayedeye dahil edilir. Son saniye teklif koruması ile kapanış anındaki rekabet adil kalır. Rezerv fiyatınızın altında teklif gelirse satış olmaz; üstünde gelirse en yüksek teklif kazanır.",
  },
  {
    num: "03",
    title: "Güvenli Kasa & Teslimat",
    body: "Kazanan alıcı ödemeyi Miyaris Güvenli Kasa hesabına yapar. Saat partner mağaza üzerinden bir kez daha kontrol edilir, sonra alıcıya kargolanır veya mağazadan teslim edilir. Para ancak teslim onayıyla satıcıya aktarılır.",
  },
];

const DIRECT_SALE_STEPS: Step[] = [
  {
    num: "01",
    title: "İlanı Hemen Yayınla",
    body: "Saatinizi sabit fiyatla listeleyin — ön ekspertiz beklemenize gerek yok. İlanınız Miyaris Mağaza vitrininde anında yayına alınır. Fiyatı siz belirlersiniz, alıcı tek tıkla satın alır.",
  },
  {
    num: "02",
    title: "Satış Sonrası Ekspertiz",
    body: "Satış gerçekleşince saat Ekspertiz Bekliyor aşamasına alınır. Partner mağazaya teslim eder, uzman onayını burada alırsınız. Onaylanmadan alıcıya kargolanmaz, satıcıya da ödeme yapılmaz — alıcı 100% güvendedir.",
  },
  {
    num: "03",
    title: "Hızlı Teslim & Tahsilat",
    body: "Ekspertiz tamamlanır tamamlanmaz Güvenli Kasa'daki tutar serbest bırakılır. Alıcı saatini, satıcı parasını alır — müzayede beklemeden anında satış akışı tamamlanır.",
  },
];

const COMMISSION_TIERS: { range: string; rate: string; sample: string }[] = [
  {
    range: "$0 — $5.000",
    rate: "%4.0",
    sample: "$3.000 satışta $120 komisyon, $2.880 net.",
  },
  {
    range: "$5.001 — $15.000",
    rate: "%2.5",
    sample: "$10.000 satışta $325 komisyon, $9.675 net.",
  },
  {
    range: "$15.001 +",
    rate: "%1.5",
    sample: "$50.000 satışta $975 komisyon, $49.025 net.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-line">
        <Container className="py-24 md:py-32">
          <div className="max-w-3xl">
            <span className="eyebrow">Nasıl Çalışır</span>
            <h1 className="font-display text-5xl md:text-6xl leading-[1.05] mt-6">
              İki vitrin, tek güvence.
              <br />
              <span className="text-brass">Siz seçin.</span>
            </h1>
            <p className="mt-8 text-lg text-charcoal-500 leading-relaxed">
              Miyaris saatinizi iki farklı yolla satabilmenizi sağlar:
              haftalık müzayede ile rekabetin maksimum bedeli oluşturmasına
              izin verin, ya da Miyaris Mağaza'da sabit fiyatla hemen
              listeleyin. Her iki akışta da partner mağaza ekspertizi ve
              Güvenli Kasa zorunludur — yalnızca zamanlaması değişir.
            </p>
          </div>
        </Container>
      </section>

      {/* İkili Vitrin Karşılaştırması */}
      <section className="bg-ivory-50 border-b border-line">
        <Container className="py-20 grid md:grid-cols-2 gap-12">
          <VitrinCard
            label="Müzayede"
            title="Açık Artırma"
            tagline="Rekabet en yüksek bedeli bulsun."
            bullets={[
              "Ön ekspertiz zorunlu — ilan müzayedeye çıkmadan onay alır",
              "Pazartesi 00:00 → Pazar 23:59 haftalık pencere",
              "Son saniye teklif koruması ile canlı teklif sistemi",
              "İsteğe bağlı 'Hemen Al' fiyatıyla müzayedeyi sonlandırma",
            ]}
            ctaLabel="Müzayedeleri Gör"
            ctaHref="/auctions"
          />
          <VitrinCard
            label="Hemen Al"
            title="Miyaris Mağaza"
            tagline="Beklemeden, sabit fiyatla."
            bullets={[
              "İlan anında yayında — ön ekspertiz bekletmez",
              "Sabit satış fiyatı — siz belirlersiniz",
              "Satış sonrası ekspertiz: alıcı, ödeme önce kasaya gider",
              "Hızlı tahsilat: ekspertiz onayı = ödeme serbest",
            ]}
            ctaLabel="Mağazaya Git"
            ctaHref="/shop"
          />
        </Container>
      </section>

      {/* AUCTION akış adımları */}
      <section>
        <Container className="py-24">
          <div className="mb-16 max-w-2xl">
            <span className="eyebrow text-brass">Müzayede Akışı</span>
            <h2 className="font-display text-4xl mt-4">
              Açık artırma için üç adım.
            </h2>
          </div>
          <FlowSteps steps={AUCTION_STEPS} />
        </Container>
      </section>

      {/* DIRECT SALE akış adımları */}
      <section className="bg-ivory-50 border-y border-line">
        <Container className="py-24">
          <div className="mb-16 max-w-2xl">
            <span className="eyebrow text-brass">Hemen Al Akışı</span>
            <h2 className="font-display text-4xl mt-4">
              Direkt satış için üç adım.
            </h2>
          </div>
          <FlowSteps steps={DIRECT_SALE_STEPS} />
        </Container>
      </section>

      {/* Kademeli Komisyon */}
      <section>
        <Container className="py-24">
          <div className="mb-12 max-w-2xl">
            <span className="eyebrow text-brass">Kademeli Komisyon</span>
            <h2 className="font-display text-4xl mt-4">
              Yüksek satışta daha az komisyon.
            </h2>
            <p className="mt-6 text-charcoal-500 leading-relaxed">
              Sabit oran yerine satış değerine göre kademeli platform
              komisyonu uygularız — daha pahalı saat daha düşük etkili oranla
              değerlenir. Hem müzayede hem de Mağaza satışları için aynı
              tablo geçerli.
            </p>
          </div>
          <div className="border border-line">
            {COMMISSION_TIERS.map((t, i) => (
              <div
                key={t.range}
                className={`grid grid-cols-12 items-center px-6 py-6 ${
                  i < COMMISSION_TIERS.length - 1 ? "border-b border-line" : ""
                }`}
              >
                <div className="col-span-12 sm:col-span-4">
                  <div className="eyebrow text-charcoal-300 mb-1">Dilim</div>
                  <div className="font-display text-2xl tabular-nums">
                    {t.range}
                  </div>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <div className="eyebrow text-charcoal-300 mb-1">Oran</div>
                  <div className="font-display text-3xl text-brass tabular-nums">
                    {t.rate}
                  </div>
                </div>
                <div className="col-span-6 sm:col-span-5">
                  <div className="eyebrow text-charcoal-300 mb-1">Örnek</div>
                  <div className="text-sm text-charcoal-700 leading-relaxed">
                    {t.sample}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-charcoal-300 tracking-wide">
            Kazanç Özeti, ilan formunda fiyat yazdığınız anda canlı
            olarak komisyon, net kazanç ve ortalama oranı gösterir.
          </p>
        </Container>
      </section>

      {/* Güvenli Kasa & KYC */}
      <section className="bg-ivory-50 border-y border-line">
        <Container className="py-24 grid md:grid-cols-3 gap-12">
          <Pillar
            label="Güvenli Kasa"
            title="Emanet Koruması"
            body="Alıcının ödemesi Miyaris emanet hesabında tutulur. Saat alıcıya ulaşıp doğrulanmadan satıcıya transfer edilmez; partner mağaza zinciri her teslimde fiziksel mühür kontrolü yapar."
          />
          <Pillar
            label="EFT Avantajı"
            title="%2.5 İndirim"
            body="Banka havalesi seçen alıcılara otomatik %2.5 indirim. Yasal düzenleme gereği kredi kartı ek ücreti yok — onun yerine havale tercihine ödül."
          />
          <Pillar
            label="KYC"
            title="T.C. & MERSİS"
            body="Tüm satıcı ve alıcıların kimliği T.C. Kimlik No üzerinden NVİ KPSPublic ile doğrulanır. Kurumsal hesaplar için MERSİS numarası da kayda alınır."
          />
        </Container>
      </section>

      {/* CTA */}
      <section>
        <Container className="py-24 text-center">
          <h2 className="font-display text-4xl mb-6">
            Saatinizi hangi vitrine koyacaksınız?
          </h2>
          <p className="text-charcoal-500 mb-12 max-w-xl mx-auto leading-relaxed">
            Tek bir formda her iki akışı da seçebilirsiniz. Müzayede ya da
            Mağaza — karar sizin.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <Link
              href="/sell-watch"
              className="inline-block bg-charcoal text-ivory px-8 py-4 text-sm tracking-widest uppercase hover:bg-charcoal-700 transition-colors"
            >
              Saatinizi Listeleyin
            </Link>
            <Link
              href="/auctions"
              className="inline-block border border-charcoal px-8 py-4 text-sm tracking-widest uppercase hover:bg-charcoal hover:text-ivory transition-colors"
            >
              Müzayedelere Bakın
            </Link>
            <Link
              href="/shop"
              className="inline-block border border-brass text-brass px-8 py-4 text-sm tracking-widest uppercase hover:bg-brass hover:text-ivory transition-colors"
            >
              Mağazaya Göz Atın
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}

function FlowSteps({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-16">
      {steps.map((s) => (
        <div key={s.num} className="grid md:grid-cols-12 gap-12 items-start">
          <div className="md:col-span-4">
            <div className="font-display text-6xl text-brass mb-2">{s.num}</div>
            <h3 className="font-display text-2xl">{s.title}</h3>
          </div>
          <div className="md:col-span-7 md:col-start-6">
            <p className="text-charcoal-700 leading-relaxed text-lg">{s.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function VitrinCard({
  label,
  title,
  tagline,
  bullets,
  ctaLabel,
  ctaHref,
}: {
  label: string;
  title: string;
  tagline: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="bg-ivory border border-line p-10 flex flex-col">
      <span className="eyebrow text-brass">{label}</span>
      <h3 className="font-display text-3xl mt-3">{title}</h3>
      <p className="text-charcoal-500 mt-3 italic">{tagline}</p>
      <ul className="mt-8 space-y-3 flex-grow">
        {bullets.map((b) => (
          <li
            key={b}
            className="text-sm text-charcoal-700 leading-relaxed flex gap-3"
          >
            <span className="text-brass mt-1">—</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className="mt-10 inline-flex items-center text-xs tracking-widest uppercase text-charcoal hover:text-brass border-b border-current pb-1 self-start"
      >
        {ctaLabel} →
      </Link>
    </div>
  );
}

function Pillar({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <span className="eyebrow text-brass mb-3 block">{label}</span>
      <h3 className="font-display text-2xl mb-4">{title}</h3>
      <p className="text-charcoal-500 leading-relaxed">{body}</p>
    </div>
  );
}
