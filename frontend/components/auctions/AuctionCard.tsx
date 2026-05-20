import Link from "next/link";

import { formatTRY, formatTimeRemaining } from "@/lib/format";
import type { AuctionListItem } from "@/lib/types";

export function AuctionCard({ auction }: { auction: AuctionListItem }) {
  const isLive = auction.status === "live";
  const isScheduled = auction.status === "scheduled";

  return (
    <Link
      href={`/auctions/${auction.id}`}
      className="group block"
      aria-label={`${auction.brand} ${auction.model} açık artırması`}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-ivory-200 mb-4">
        {auction.primary_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={auction.primary_image_url}
            alt={`${auction.brand} ${auction.model}`}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-charcoal-300 text-xs tracking-widest uppercase">
            Görsel yok
          </div>
        )}

        {isLive && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-2 bg-ivory/90 px-3 py-1.5 text-[10px] tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-burgundy animate-pulse" />
            Canlı
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="eyebrow">{auction.brand}</div>
        <h3 className="font-display text-lg leading-tight group-hover:text-brass transition-colors">
          {auction.model}
        </h3>
        <div className="flex justify-between items-baseline pt-2">
          <span className="text-base font-medium tabular-nums">
            {formatTRY(auction.current_price)}
          </span>
          <span className="text-xs text-charcoal-300">
            {isScheduled
              ? "Yakında"
              : formatTimeRemaining(auction.ends_at)}
          </span>
        </div>
      </div>
    </Link>
  );
}
