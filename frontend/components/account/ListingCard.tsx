import Link from "next/link";

import { AIStatusIndicator } from "@/components/account/AIStatusIndicator";
import { StatusBadge } from "@/components/account/StatusBadge";
import type { ListingType, WatchPublic } from "@/lib/types";

function ListingTypeBadge({ type }: { type: ListingType }) {
  const isAuction = type === "auction";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[9px] tracking-widest uppercase border ${
        isAuction
          ? "border-charcoal text-charcoal bg-ivory"
          : "border-brass text-brass-dark bg-brass/5"
      }`}
    >
      {isAuction ? "Müzayede" : "Hemen Al"}
    </span>
  );
}


export function ListingCard({ watch }: { watch: WatchPublic }) {
  const primary =
    watch.images.find((i) => i.is_primary)?.url ?? watch.images[0]?.url ?? null;

  return (
    <Link
      href={`/account/listings/${watch.id}`}
      className="flex gap-6 border-b border-line py-6 group hover:bg-ivory-50/50 -mx-2 px-2 transition-colors"
    >
      <div className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 bg-ivory-200 overflow-hidden">
        {primary ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primary}
            alt={`${watch.brand} ${watch.model}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] tracking-widest uppercase text-charcoal-300">
            Görsel yok
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="eyebrow">{watch.brand}</span>
              <ListingTypeBadge type={watch.listing_type} />
            </div>
            <h3 className="font-display text-xl mt-1 truncate group-hover:text-brass transition-colors">
              {watch.model}
            </h3>
            <p className="text-sm text-charcoal-500 mt-1 tabular-nums">
              Ref. {watch.reference_number}
              {watch.year && ` · ${watch.year}`}
            </p>
          </div>
          <StatusBadge status={watch.status} />
        </div>

        <div className="flex items-center gap-4 mt-4">
          <AIStatusIndicator status={watch.ai_processing_status} />
          <span className="text-xs text-charcoal-300 ml-auto">
            {new Date(watch.created_at).toLocaleDateString("tr-TR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </div>
    </Link>
  );
}
