"use client";

import { formatTRY } from "@/lib/format";
import type { BidPublic } from "@/lib/types";

interface Props {
  bids: BidPublic[];
  bidCount: number;
}

export function LiveBidHistory({ bids, bidCount }: Props) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-2xl">Teklif Geçmişi</h2>
        <span className="eyebrow">{bidCount} teklif</span>
      </div>

      {bids.length === 0 ? (
        <p className="text-charcoal-300 text-sm eyebrow">Henüz teklif yok</p>
      ) : (
        <ul className="divide-y divide-line max-h-96 overflow-y-auto">
          {bids.map((b, idx) => (
            <li
              key={b.id}
              className={`py-3 flex justify-between items-baseline transition-colors ${
                idx === 0 ? "bg-brass/5 -mx-2 px-2" : ""
              }`}
            >
              <div className="flex items-baseline gap-3">
                <span className="text-sm text-charcoal-700">
                  {b.bidder_name ?? "Anonim"}
                </span>
                {idx === 0 && (
                  <span className="text-[10px] tracking-widest uppercase text-brass">
                    En Yüksek
                  </span>
                )}
              </div>
              <span className="font-medium tabular-nums">
                {formatTRY(b.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
