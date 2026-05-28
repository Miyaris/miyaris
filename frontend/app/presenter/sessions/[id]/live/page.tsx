import { notFound } from "next/navigation";

import { backendFetch } from "@/lib/api";
import type { BidPublic, PresenterSessionDetail } from "@/lib/types";

import { PresenterSessionLive } from "./PresenterSessionLive";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sunucu Ekranı" };

/**
 * Canlı sunucu ekranı — oturum bazlı.
 *
 * Server tarafında oturum detayını çekiyoruz (ownership guard backend'de).
 * Mevcut LIVE lot için ilk bid listesini de çekip client'a veriyoruz, WS
 * sonrasında devralacak.
 */
export default async function SessionLivePage({
  params,
}: {
  params: { id: string };
}) {
  let session: PresenterSessionDetail | null = null;
  try {
    session = await backendFetch<PresenterSessionDetail>(
      `/api/v1/presenter/sessions/${params.id}`,
      { authenticated: true },
    );
  } catch {
    notFound();
  }
  if (!session) notFound();

  // Mevcut LIVE lot — yoksa null
  const currentLot =
    session.lots.find((l) => l.status === "live") ?? null;

  let initialBids: BidPublic[] = [];
  if (currentLot) {
    try {
      initialBids = await backendFetch<BidPublic[]>(
        `/api/v1/auctions/${currentLot.auction_id}/bids`,
      );
    } catch {
      initialBids = [];
    }
  }

  return (
    <PresenterSessionLive
      session={session}
      initialBids={initialBids}
    />
  );
}
