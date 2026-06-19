import Link from "next/link";

import { Container } from "@/components/shared/Container";
import { backendFetch } from "@/lib/api";
import { formatUSD } from "@/lib/format";
import type { WatchPublic } from "@/lib/types";

export const dynamic = "force-dynamic";

interface SearchParams {
  brand?: string;
}

async function getDirectSales(brand?: string): Promise<WatchPublic[]> {
  const query = new URLSearchParams({ limit: "60" });
  if (brand) query.set("brand", brand);
  try {
    return await backendFetch<WatchPublic[]>(
      `/api/v1/watches/marketplace?${query.toString()}`,
    );
  } catch {
    return [];
  }
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const watches = await getDirectSales(searchParams.brand);

  return (
    <Container className="py-16">
      <header className="mb-12">
        <span className="eyebrow">Hemen Al — Sabit Fiyat</span>
        <h1 className="font-display text-5xl mt-4">Miyaris Mağaza</h1>
        <p className="text-charcoal-500 mt-4 max-w-2xl leading-relaxed">
          Sabit fiyatla, müzayede beklemeden alabileceğiniz seçili
          koleksiyon. Tüm saatler anlaşmalı mağaza ekspertizinden geçer ve
          Güvenli Kasa ile teslim edilir.
        </p>
      </header>

      <ShopGrid watches={watches} />
    </Container>
  );
}

function ShopGrid({ watches }: { watches: WatchPublic[] }) {
  if (watches.length === 0) {
    return (
      <div className="py-24 text-center">
        <div className="eyebrow text-charcoal-300 mb-3">
          Koleksiyon Hazırlanıyor
        </div>
        <p className="text-charcoal-500 text-sm">
          Şu anda Miyaris Mağaza&apos;da sabit fiyatlı saat bulunmuyor.
          Müzayedelere göz atmak ister misiniz?
        </p>
        <Link
          href="/auctions"
          className="inline-block mt-6 text-xs tracking-widest uppercase text-brass border-b border-brass pb-0.5 hover:text-charcoal hover:border-charcoal transition-colors"
        >
          Müzayedeleri Gör →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
      {watches.map((w) => (
        <ShopCard key={w.id} watch={w} />
      ))}
    </div>
  );
}

function ShopCard({ watch }: { watch: WatchPublic }) {
  const primary =
    watch.images.find((i) => i.is_primary)?.url ?? watch.images[0]?.url ?? null;
  const price =
    watch.asking_price !== null && watch.asking_price !== undefined
      ? formatUSD(watch.asking_price)
      : "—";

  return (
    <Link
      href={`/watches/${watch.slug}`}
      className="group block"
      aria-label={`${watch.brand} ${watch.model}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-ivory-200 mb-4">
        {primary ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primary}
            alt={`${watch.brand} ${watch.model}`}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-charcoal-300 text-xs tracking-widest uppercase">
            Görsel yok
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="eyebrow">{watch.brand}</div>
        <h3 className="font-display text-lg leading-tight group-hover:text-brass transition-colors">
          {watch.model}
        </h3>
        <p className="text-xs text-charcoal-300">
          Ref. {watch.reference_number} · {watch.year}
        </p>
        <div className="flex justify-between items-baseline pt-3 border-t border-line mt-3">
          <span className="text-lg font-medium tabular-nums text-charcoal">
            {price}
          </span>
          <span className="text-[10px] tracking-widest uppercase text-brass">
            Satın Al →
          </span>
        </div>
      </div>
    </Link>
  );
}
