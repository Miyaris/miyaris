import Link from "next/link";

import { formatTRY, formatTimeRemaining } from "@/lib/format";
import type { MyAuctionParticipation } from "@/lib/types";

export function MyBidCard({ item }: { item: MyAuctionParticipation }) {
  const isLive = item.status === "live";
  const isEnded = item.status === "ended" || item.status === "completed";

  // Renk + etiket: leading vs outbid vs won vs lost
  const standing = (() => {
    if (isEnded) {
      return item.is_leading
        ? { label: "Kazandın", className: "text-olive border-olive/30" }
        : { label: "Kaybettin", className: "text-burgundy border-burgundy/30" };
    }
    return item.is_leading
      ? { label: "Lidersin", className: "text-olive border-olive/30" }
      : { label: "Geçildin", className: "text-burgundy border-burgundy/30" };
  })();

  return (
    <Link
      href={`/auctions/${item.auction_id}`}
      className="flex gap-6 border-b border-line py-6 group hover:bg-ivory-50/50 -mx-2 px-2 transition-colors"
    >
      <div className="w-24 h-24 md:w-28 md:h-28 flex-shrink-0 bg-ivory-200 overflow-hidden">
        {item.primary_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.primary_image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : null}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="eyebrow">{item.brand}</span>
              <h3 className="font-display text-lg mt-1 truncate group-hover:text-brass transition-colors">
                {item.model}
              </h3>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-1 text-[10px] tracking-widest uppercase border ${standing.className}`}
            >
              {standing.label}
            </span>
          </div>
        </div>

        <div className="flex items-baseline justify-between mt-3 gap-4">
          <div>
            <div className="text-xs eyebrow">Sizin teklifiniz</div>
            <div className="font-medium tabular-nums text-base mt-0.5">
              {formatTRY(item.my_highest_bid)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs eyebrow">Mevcut</div>
            <div className="font-medium tabular-nums text-base mt-0.5">
              {formatTRY(item.current_price)}
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs eyebrow">
              {isLive ? "Kalan süre" : "Bitti"}
            </div>
            <div className="text-sm tabular-nums text-charcoal-700 mt-0.5">
              {isLive
                ? formatTimeRemaining(item.extended_until ?? item.ends_at)
                : new Date(item.ends_at).toLocaleDateString("tr-TR", {
                    day: "2-digit",
                    month: "short",
                  })}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
