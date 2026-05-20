"use client";

import { BidPanel } from "@/components/auctions/BidPanel";
import { BuyNowButton } from "@/components/auctions/BuyNowButton";
import { CountdownTimer } from "@/components/auctions/CountdownTimer";
import { LiveBidHistory } from "@/components/auctions/LiveBidHistory";
import { formatUSD } from "@/lib/format";
import {
  useAuctionStream,
  type AuctionLiveState,
} from "@/hooks/useAuctionStream";
import type { BidPublic } from "@/lib/types";

interface Props {
  auctionId: string;
  initial: AuctionLiveState;
  initialBids: BidPublic[];
  minBidIncrement: string;
  buyItNowPrice: string | null;
  isAuthenticated: boolean;
}

/**
 * Sayfanın canlı kısmını tek client component altında topluyor —
 * BidPanel, CountdownTimer, BuyNowButton ve BidHistory aynı WS state'ini paylaşır.
 */
export function AuctionLiveSection({
  auctionId,
  initial,
  initialBids,
  minBidIncrement,
  buyItNowPrice,
  isAuthenticated,
}: Props) {
  const { state, bids, connected } = useAuctionStream(auctionId, {
    initial,
    initialBids,
  });

  const buyNowAvailable =
    state.status === "scheduled" || state.status === "live";

  return (
    <>
      <div className="border-y border-line py-6 flex justify-between items-end gap-6">
        <CountdownTimer
          endsAt={state.endsAt}
          extendedUntil={state.extendedUntil}
        />
        <LiveStatusDot connected={connected} />
      </div>

      {buyItNowPrice && (
        <BuyNowButton
          auctionId={auctionId}
          buyItNowPrice={buyItNowPrice}
          isAuthenticated={isAuthenticated}
          available={buyNowAvailable}
        />
      )}

      <BidPanel
        auctionId={auctionId}
        currentPrice={state.currentPrice}
        minBidIncrement={minBidIncrement}
        isAuthenticated={isAuthenticated}
        acceptsBids={state.status === "live"}
      />

      {state.extendedUntil && state.status === "live" && (
        <p className="text-xs text-brass tracking-widest uppercase">
          ⊕ Süre uzatıldı: {formatUSD(state.currentPrice)} üzerinden
        </p>
      )}

      <LiveBidHistory bids={bids} bidCount={state.bidCount} />
    </>
  );
}

function LiveStatusDot({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs tracking-widest uppercase text-charcoal-300">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          connected ? "bg-olive animate-pulse" : "bg-charcoal-300"
        }`}
        aria-hidden
      />
      {connected ? "Canlı" : "Bağlanıyor"}
    </div>
  );
}
