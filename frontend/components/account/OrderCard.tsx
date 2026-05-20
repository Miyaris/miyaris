import Link from "next/link";

import { DELIVERY_LABELS } from "@/components/account/DeliveryMethodPicker";
import { EscrowStatusBadge } from "@/components/account/EscrowStatusBadge";
import { PAYMENT_LABELS } from "@/components/account/PaymentMethodPicker";
import { formatUSD } from "@/lib/format";
import type { EscrowListItem } from "@/lib/types";

interface Props {
  item: EscrowListItem;
  /** "buyer" — counterparty satıcı; "seller" — counterparty alıcı */
  perspective: "buyer" | "seller";
  basePath: string; // /account/orders veya /account/sales
}

export function OrderCard({ item, perspective, basePath }: Props) {
  return (
    <Link
      href={`${basePath}/${item.id}`}
      className="flex gap-6 border-b border-line py-6 group hover:bg-ivory-50/50 -mx-2 px-2 transition-colors"
    >
      <div className="w-24 h-24 md:w-28 md:h-28 flex-shrink-0 bg-ivory-200 overflow-hidden">
        {item.watch_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.watch_image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : null}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="eyebrow">{item.watch_brand}</span>
              <h3 className="font-display text-lg mt-1 truncate group-hover:text-brass transition-colors">
                {item.watch_model}
              </h3>
              <p className="text-xs text-charcoal-300 mt-1">
                {perspective === "buyer" ? "Satıcı:" : "Alıcı:"}{" "}
                {item.counterparty_name}
              </p>
            </div>
            <EscrowStatusBadge status={item.status} />
          </div>
        </div>

        <div className="flex items-baseline justify-between mt-3 gap-4">
          <span className="font-medium tabular-nums text-base">
            {formatUSD(item.amount)}
          </span>
          <span className="text-xs text-charcoal-300">
            {new Date(item.created_at).toLocaleDateString("tr-TR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        {(item.delivery_method || item.payment_method) && (
          <div className="flex flex-wrap gap-2 mt-2">
            {item.delivery_method && (
              <span className="text-[10px] tracking-widest uppercase text-charcoal-500 border border-line px-2 py-0.5">
                Teslimat: {DELIVERY_LABELS[item.delivery_method]}
              </span>
            )}
            {item.payment_method && (
              <span
                className={`text-[10px] tracking-widest uppercase border px-2 py-0.5 ${
                  item.payment_method === "bank_transfer"
                    ? "text-olive border-olive/30"
                    : "text-charcoal-500 border-line"
                }`}
              >
                Ödeme: {PAYMENT_LABELS[item.payment_method]}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
