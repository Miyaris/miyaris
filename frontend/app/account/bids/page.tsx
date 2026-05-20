import Link from "next/link";

import { MyBidCard } from "@/components/account/MyBidCard";
import { Container } from "@/components/shared/Container";
import { backendFetch } from "@/lib/api";
import type { MyAuctionParticipation } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tekliflerim" };

async function getMyBids(): Promise<MyAuctionParticipation[]> {
  try {
    return await backendFetch<MyAuctionParticipation[]>(
      "/api/v1/auctions/me/bids",
      { authenticated: true },
    );
  } catch {
    return [];
  }
}

export default async function MyBidsPage() {
  const bids = await getMyBids();

  // Üç bölüm: aktif (canlı + leading/geçilen), kapanmış (won/lost)
  const live = bids.filter((b) => b.status === "live" || b.status === "scheduled");
  const ended = bids.filter(
    (b) => b.status === "ended" || b.status === "completed",
  );

  return (
    <Container className="py-16">
      <header className="flex items-baseline justify-between mb-12 border-b border-line pb-6">
        <div>
          <span className="eyebrow">Hesabım</span>
          <h1 className="font-display text-4xl mt-3">Tekliflerim</h1>
        </div>
        <Link
          href="/auctions"
          className="text-xs tracking-widest uppercase border-b border-charcoal pb-0.5 hover:text-brass hover:border-brass transition-colors"
        >
          Müzayedeye Göz At
        </Link>
      </header>

      {bids.length === 0 ? (
        <div className="py-24 text-center">
          <p className="eyebrow mb-6">Henüz teklif vermediniz</p>
          <Link
            href="/auctions"
            className="inline-block border border-charcoal px-8 py-4 text-sm tracking-widest uppercase hover:bg-charcoal hover:text-ivory transition-colors"
          >
            Koleksiyonu Keşfedin
          </Link>
        </div>
      ) : (
        <>
          {live.length > 0 && (
            <section className="mb-16">
              <h2 className="font-display text-xl mb-6 flex items-baseline gap-3">
                Aktif
                <span className="eyebrow text-charcoal-300">
                  {live.length} açık artırma
                </span>
              </h2>
              <div>
                {live.map((b) => (
                  <MyBidCard key={b.auction_id} item={b} />
                ))}
              </div>
            </section>
          )}

          {ended.length > 0 && (
            <section>
              <h2 className="font-display text-xl mb-6 flex items-baseline gap-3">
                Geçmiş
                <span className="eyebrow text-charcoal-300">
                  {ended.length} açık artırma
                </span>
              </h2>
              <div>
                {ended.map((b) => (
                  <MyBidCard key={b.auction_id} item={b} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </Container>
  );
}
