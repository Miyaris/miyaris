import { AuctionCard } from "@/components/auctions/AuctionCard";
import type { AuctionListItem } from "@/lib/types";

export function AuctionGrid({ auctions }: { auctions: AuctionListItem[] }) {
  if (auctions.length === 0) {
    return (
      <div className="py-24 text-center text-charcoal-300 eyebrow">
        Şu anda açık artırma bulunmuyor
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
      {auctions.map((auction) => (
        <AuctionCard key={auction.id} auction={auction} />
      ))}
    </div>
  );
}
