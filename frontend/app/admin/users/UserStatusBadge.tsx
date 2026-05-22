type Tone = "verified" | "pending" | "muted" | "brass";

interface Props {
  tone: Tone;
  label: string;
}

const TONES: Record<Tone, string> = {
  // Onaylı — koyu zeytin yeşili (sayfada "olive" başarı rengi olarak tanımlı)
  verified:
    "border-olive/40 bg-olive/5 text-olive",
  // Onaysız — yumuşak burgonya, dikkat çekici ama agresif değil
  pending:
    "border-burgundy/40 bg-burgundy/5 text-burgundy",
  // Pasif — silik nötr
  muted:
    "border-line bg-ivory-50 text-charcoal-500",
  // Admin/özel — pirinç (brass)
  brass:
    "border-brass/50 bg-brass/10 text-brass-dark",
};

export function UserStatusBadge({ tone, label }: Props) {
  return (
    <span
      className={[
        "inline-flex items-center text-[10px] tracking-[0.18em] uppercase font-medium",
        "border px-2 py-1 leading-none",
        TONES[tone],
      ].join(" ")}
    >
      {label}
    </span>
  );
}
