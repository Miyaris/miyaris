import type { EscrowStatus } from "@/lib/types";

const LABELS: Record<EscrowStatus, string> = {
  pending_payment: "Ödeme Bekleniyor",
  funded: "Ödendi",
  awaiting_authentication: "Doğrulamada",
  authenticated: "Doğrulandı",
  shipped_to_buyer: "Kargoda",
  delivered: "Teslim Edildi",
  released: "Tamamlandı",
  refunded: "İade Edildi",
  disputed: "Uyuşmazlık",
};

const STYLES: Record<EscrowStatus, string> = {
  pending_payment: "bg-brass/10 text-brass-dark border-brass/30",
  funded: "bg-olive/10 text-olive border-olive/30",
  awaiting_authentication: "bg-brass/10 text-brass-dark border-brass/30",
  authenticated: "bg-olive/10 text-olive border-olive/30",
  shipped_to_buyer: "bg-brass/10 text-brass-dark border-brass/30",
  delivered: "bg-olive/10 text-olive border-olive/30",
  released: "bg-charcoal/5 text-charcoal-700 border-charcoal/20",
  refunded: "bg-burgundy/10 text-burgundy border-burgundy/30",
  disputed: "bg-burgundy/10 text-burgundy border-burgundy/30",
};

export function EscrowStatusBadge({ status }: { status: EscrowStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-[10px] tracking-widest uppercase border ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}

export const ESCROW_STATUS_LABELS = LABELS;
