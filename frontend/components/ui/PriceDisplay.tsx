import { formatTRY } from "@/lib/format";

interface PriceDisplayProps {
  amount: string | number;
  label?: string;
  size?: "sm" | "md" | "lg";
  emphasize?: boolean;
}

const sizeClasses = {
  sm: "text-base",
  md: "text-2xl",
  lg: "text-4xl md:text-5xl",
};

export function PriceDisplay({
  amount,
  label,
  size = "md",
  emphasize = false,
}: PriceDisplayProps) {
  return (
    <div>
      {label && <div className="eyebrow mb-1">{label}</div>}
      <div
        className={`font-display tabular-nums ${sizeClasses[size]} ${
          emphasize ? "text-charcoal" : "text-charcoal-700"
        }`}
      >
        {formatTRY(amount)}
      </div>
    </div>
  );
}
