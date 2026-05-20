import { notFound } from "next/navigation";

import { AuctionLiveSection } from "@/components/auctions/AuctionLiveSection";
import { Container } from "@/components/shared/Container";
import { WatchGallery } from "@/components/watches/WatchGallery";
import { ApiError, backendFetch } from "@/lib/api";
import { formatTRY } from "@/lib/format";
import { isLoggedIn } from "@/lib/session";
import type { AuctionPublic, BidPublic } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getAuction(id: string): Promise<AuctionPublic | null> {
  try {
    return await backendFetch<AuctionPublic>(`/api/v1/auctions/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

async function getBids(id: string): Promise<BidPublic[]> {
  try {
    return await backendFetch<BidPublic[]>(`/api/v1/auctions/${id}/bids`);
  } catch {
    return [];
  }
}

const CONDITION_LABELS: Record<string, string> = {
  new: "Sıfır",
  mint: "Mint",
  excellent: "Mükemmel",
  good: "İyi",
  fair: "Orta",
};

export default async function AuctionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const auction = await getAuction(params.id);
  if (!auction) notFound();

  const [bids, loggedIn] = await Promise.all([
    getBids(params.id),
    Promise.resolve(isLoggedIn()),
  ]);

  return (
    <Container className="py-12 md:py-20">
      <div className="grid md:grid-cols-12 gap-12 lg:gap-16">
        <div className="md:col-span-7">
          <WatchGallery
            images={auction.watch.images}
            alt={`${auction.watch.brand} ${auction.watch.model}`}
          />
        </div>

        <div className="md:col-span-5 space-y-10">
          <div>
            <span className="eyebrow">{auction.watch.brand}</span>
            <h1 className="font-display text-4xl md:text-5xl mt-3 leading-tight">
              {auction.watch.model}
            </h1>
            <p className="text-charcoal-500 mt-3 tabular-nums">
              Ref. {auction.watch.reference_number}
              {auction.watch.year && ` · ${auction.watch.year}`}
            </p>
          </div>

          <AuctionLiveSection
            auctionId={auction.id}
            initial={{
              currentPrice: auction.current_price,
              endsAt: auction.ends_at,
              extendedUntil: auction.extended_until,
              status: auction.status,
              bidCount: auction.bid_count,
            }}
            initialBids={bids}
            minBidIncrement={auction.min_bid_increment}
            buyItNowPrice={auction.buy_it_now_price}
            isAuthenticated={loggedIn}
          />

          <SpecsTable
            condition={
              CONDITION_LABELS[auction.watch.condition] ?? auction.watch.condition
            }
            boxPapers={auction.watch.box_papers}
            serialNumber={auction.watch.serial_number}
            startingPrice={auction.starting_price}
          />
        </div>
      </div>

      {/* Açıklama */}
      <section className="mt-24 max-w-3xl">
        <h2 className="font-display text-2xl mb-6">Saat Hakkında</h2>
        <p className="text-charcoal-700 leading-relaxed whitespace-pre-line">
          {auction.watch.seo_description ?? auction.watch.description}
        </p>
      </section>

      {/* Güvenli kasa güven telkini */}
      <section className="mt-16 max-w-3xl border-t border-line pt-10">
        <div className="border border-line bg-ivory-50 p-6 md:p-8">
          <span className="eyebrow text-brass-dark mb-3 block">
            Sigortalı Kasada Muhafaza
          </span>
          <p className="text-sm text-charcoal-700 leading-relaxed">
            Fiziksel onayı tamamlanan tüm saatler, satış anına kadar Miyaris'in
            anlaşmalı sigortalı kasalarında tam güvence altında muhafaza
            edilmektedir. Hem alıcı hem satıcı için fiziksel risk Miyaris
            tarafından üstlenilir; saat yalnızca emanet hesabı tamamlandıktan
            sonra alıcıya sigortalı kargo ile gönderilir.
          </p>
        </div>
      </section>
    </Container>
  );
}

function SpecsTable({
  condition,
  boxPapers,
  serialNumber,
  startingPrice,
}: {
  condition: string;
  boxPapers: boolean;
  serialNumber: string | null;
  startingPrice: string;
}) {
  const rows: [string, string][] = [
    ["Durum", condition],
    ["Kutu & Kağıtlar", boxPapers ? "Var" : "Yok"],
    ...(serialNumber ? ([["Seri No", serialNumber]] as [string, string][]) : []),
    ["Başlangıç Fiyatı", formatTRY(startingPrice)],
  ];
  return (
    <dl className="divide-y divide-line border-y border-line">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between py-3 text-sm">
          <dt className="text-charcoal-300 tracking-wide">{label}</dt>
          <dd className="text-charcoal-700 font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
