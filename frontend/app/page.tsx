import Link from "next/link";

import { AuctionGrid } from "@/components/auctions/AuctionGrid";
import { Container } from "@/components/shared/Container";
import { backendFetch } from "@/lib/api";
import type { AuctionListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getFeaturedAuctions(): Promise<AuctionListItem[]> {
  try {
    return await backendFetch<AuctionListItem[]>(
      "/api/v1/auctions?status_filter=live&limit=6",
    );
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const auctions = await getFeaturedAuctions();

  return (
    <>
      {/* Hero */}
      <section className="border-b border-line">
        <Container className="py-24 md:py-36 grid md:grid-cols-12 gap-12 items-end">
          <div className="md:col-span-7">
            <span className="eyebrow">
              Miyaris — Lüks Saat Pazarı & Özel Müzayede
            </span>
            <h1 className="font-display text-5xl md:text-7xl leading-[1.05] mt-6">
              Sertifikalı lüks saatler.
              <br />
              <span className="text-brass">Güvenilir pazar</span>, şeffaf
              müzayede.
            </h1>
            <p className="mt-8 text-lg text-charcoal-500 leading-relaxed max-w-xl">
              Her parça, bağımsız eksperlerimiz tarafından fiziksel olarak
              doğrulanır. Sertifikalı saatleri doğrudan satın alın, kendi
              saatinizi güvenle satışa çıkarın veya haftalık özel
              müzayedelerimizde yerinizi alın.
            </p>
            <div className="mt-12 flex gap-6">
              <Link
                href="/auctions"
                className="inline-block bg-charcoal text-ivory px-8 py-4 text-sm tracking-widest uppercase hover:bg-charcoal-700 transition-colors"
              >
                Koleksiyonu Keşfet
              </Link>
              <Link
                href="/sell-watch"
                className="inline-block border border-charcoal px-8 py-4 text-sm tracking-widest uppercase hover:bg-charcoal hover:text-ivory transition-colors"
              >
                Saatinizi Satın
              </Link>
            </div>
          </div>

          <div className="md:col-span-5 grid grid-cols-3 gap-4 text-center">
            <Stat number="312" label="Sertifikalı Saat" />
            <Stat number="48 Saat" label="Ekspertiz Süresi" />
            <Stat number="%100" label="Emanet Garantisi" />
          </div>
        </Container>
      </section>

      {/* Featured */}
      <section>
        <Container className="py-24">
          <div className="flex items-baseline justify-between mb-16">
            <div>
              <span className="eyebrow">Öne Çıkanlar</span>
              <h2 className="font-display text-4xl mt-3">
                Bu Haftanın Müzayedesi & Hemen Al
              </h2>
            </div>
            <Link
              href="/auctions"
              className="hidden md:inline text-sm tracking-widest uppercase border-b border-charcoal pb-1 hover:text-brass hover:border-brass transition-colors"
            >
              Tümünü Gör
            </Link>
          </div>
          <AuctionGrid auctions={auctions} />
        </Container>
      </section>

      {/* Trust pillars */}
      <section className="bg-ivory-50 border-y border-line">
        <Container className="py-24 grid md:grid-cols-3 gap-16">
          <Pillar
            num="01"
            title="Fiziksel Otorite"
            body="Saat satıldığında önce uzmanlarımıza gelir, orijinallik sertifikası alır, ardından alıcıya gönderilir."
          />
          <Pillar
            num="02"
            title="Emanet Hesabı"
            body="Ödemeniz işlem tamamlanana kadar bağımsız bir havuz hesabında bloke edilir. Sahte tabir yok."
          />
          <Pillar
            num="03"
            title="Otonom Değerleme"
            body="Yapay zeka ajanlarımız global piyasayı tarar, her saat için bağımsız bir referans değer sunar."
          />
        </Container>
      </section>
    </>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="border-l border-line pl-4 first:border-l-0 first:pl-0">
      <div className="font-display text-3xl">{number}</div>
      <div className="eyebrow mt-2">{label}</div>
    </div>
  );
}

function Pillar({
  num,
  title,
  body,
}: {
  num: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="eyebrow text-brass mb-4">{num}</div>
      <h3 className="font-display text-2xl mb-4">{title}</h3>
      <p className="text-charcoal-500 leading-relaxed">{body}</p>
    </div>
  );
}
