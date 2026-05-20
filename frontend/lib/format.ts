/**
 * Para formatı — Amerikan Doları, lüks katalog tarzı (kuruşsuz).
 * Backend Decimal'i string olarak gönderdiği için string|number kabul ederiz.
 */
export function formatUSD(amount: string | number): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Geri uyumluluk için alias — kademeli refactor sırasında çağıran kod kırılmasın. */
export const formatTRY = formatUSD;

/**
 * Bitiş zamanına kalan süreyi insan-okur biçimde döner ("3g 14s 22dk").
 * 0 veya negatif fark için "Bitti" döner.
 */
export function formatTimeRemaining(endsAt: string | Date): string {
  const end = typeof endsAt === "string" ? new Date(endsAt) : endsAt;
  const diff = end.getTime() - Date.now();
  if (diff <= 0) return "Bitti";

  const seconds = Math.floor(diff / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}g ${hours}s`;
  if (hours > 0) return `${hours}s ${minutes}dk`;
  return `${minutes}dk`;
}

/** Bir sonraki haftanın Pazartesi 00:00 (yerel saat). Form üzerinde gösterilir. */
export function nextMondayDate(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi
  const daysUntilMonday = (8 - day) % 7 || 7; // bugün Pazartesi ise +7
  const d = new Date(now);
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Sonraki Pazar 23:59 (Pazartesi'den 6 gün sonra) */
export function nextSundayEndDate(): Date {
  const monday = nextMondayDate();
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 0, 0);
  return sunday;
}

/** Türkçe uzun tarih: "12 Mayıs Pazartesi" */
export function formatDateTR(d: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(d);
}
