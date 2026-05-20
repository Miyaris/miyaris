import type { AIProcessingStatus } from "@/lib/types";

interface Props {
  status: AIProcessingStatus;
  className?: string;
}

const CONFIG: Record<
  AIProcessingStatus,
  { label: string; dotClass: string; textClass: string; show: boolean }
> = {
  none: { label: "", dotClass: "", textClass: "", show: false },
  queued: {
    label: "AI kuyrukta",
    dotClass: "bg-brass",
    textClass: "text-charcoal-500",
    show: true,
  },
  processing: {
    label: "AI çalışıyor",
    dotClass: "bg-brass animate-pulse",
    textClass: "text-brass-dark",
    show: true,
  },
  done: {
    label: "AI tamamlandı",
    dotClass: "bg-olive",
    textClass: "text-charcoal-700",
    show: true,
  },
  failed: {
    label: "AI başarısız",
    dotClass: "bg-burgundy",
    textClass: "text-burgundy",
    show: true,
  },
};

export function AIStatusIndicator({ status, className = "" }: Props) {
  const cfg = CONFIG[status];
  if (!cfg.show) return null;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`}
        aria-hidden
      />
      <span
        className={`text-[10px] tracking-widest uppercase ${cfg.textClass}`}
      >
        {cfg.label}
      </span>
    </div>
  );
}
