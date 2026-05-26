import { notFound } from "next/navigation";

import { backendFetch } from "@/lib/api";
import type { BidPublic, PresenterShowcase } from "@/lib/types";

import { PresenterLiveSession } from "./PresenterLiveSession";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sunucu Ekranı" };

/**
 * Canlı Sunucu Ekranı — yetkilendirme + ownership server-side doğrulanır.
 *
 * Akış:
 *  1. Layout guard zaten is_presenter=true olduğunu garantiledi
 *  2. Burada presenter'ın kendi showcase listesini çekiyoruz — backend
 *     listede yalnızca o kullanıcının sahip olduğu auction'ları döner
 *  3. URL'deki auction_id listede yoksa 404 (başka birinin showcase'i veya
 *     hiç olmayan id)
 *  4. Initial state + bids ile client component'i render et
 */
export default async function PresenterLivePage({
  params,
}: {
  params: { auctionId: string };
}) {
  let showcase: PresenterShowcase | undefined;
  let initialBids: BidPublic[] = [];

  try {
    const showcases = await backendFetch<PresenterShowcase[]>(
      "/api/v1/presenter/showcases?limit=200",
      { authenticated: true },
    );
    showcase = showcases.find((s) => s.auction_id === params.auctionId);
  } catch {
    notFound();
  }

  if (!showcase) {
    notFound();
  }

  // Bid history public endpoint — ownership şart değil
  try {
    initialBids = await backendFetch<BidPublic[]>(
      `/api/v1/auctions/${params.auctionId}/bids`,
    );
  } catch {
    initialBids = [];
  }

  return (
    <PresenterLiveSession showcase={showcase} initialBids={initialBids} />
  );
}
