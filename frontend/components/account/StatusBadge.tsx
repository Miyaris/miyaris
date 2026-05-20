import type { WatchStatus } from "@/lib/types";

const LABELS: Record<WatchStatus, string> = {
  draft: "Taslak",
  pending_review: "İnceleniyor",
  pending_pre_expertise: "Ön Ekspertiz Bekliyor",
  active: "Aktif",
  awaiting_expertise: "Ekspertiz Bekliyor",
  sold: "Satıldı",
  rejected: "Reddedildi",
};

const STYLES: Record<WatchStatus, string> = {
  draft: "bg-ivory-200 text-charcoal-500 border-line",
  pending_review: "bg-brass/10 text-brass-dark border-brass/30",
  pending_pre_expertise: "bg-brass/10 text-brass-dark border-brass/30",
  active: "bg-olive/10 text-olive border-olive/30",
  awaiting_expertise: "bg-brass/10 text-brass-dark border-brass/30",
  sold: "bg-charcoal/5 text-charcoal-700 border-charcoal/20",
  rejected: "bg-burgundy/10 text-burgundy border-burgundy/30",
};

export function StatusBadge({ status }: { status: WatchStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-[10px] tracking-widest uppercase border ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
