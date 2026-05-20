import type { EscrowStatus, ListingType } from "@/lib/types";

interface Step {
  key: EscrowStatus;
  title: string;
  description: string;
}

/**
 * AUCTION akışı — saat müzayedeyi kazandıktan SONRA escrow oluşur.
 * Saat Miyaris'in kasasında bekliyor olabilir; "ödeme bekleniyor" cümlesi
 * alıcının teklif sonrası ödeme yapmasına odaklanır.
 */
const AUCTION_STEPS: Step[] = [
  {
    key: "pending_payment",
    title: "Ödeme Bekleniyor",
    description: "Müzayedeyi kazandınız — Güvenli Kasa'ya ödeme yapın",
  },
  {
    key: "funded",
    title: "Ödeme Alındı",
    description: "Para Güvenli Kasa'da bloke edildi",
  },
  {
    key: "awaiting_authentication",
    title: "Saat Doğrulamada",
    description: "Partner mağaza ekspertizi başladı",
  },
  {
    key: "authenticated",
    title: "Orijinallik Onaylandı",
    description: "Uzman doğrulama sertifikası tamamlandı",
  },
  {
    key: "shipped_to_buyer",
    title: "Alıcıya Gönderildi",
    description: "Sigortalı kargo yola çıktı",
  },
  {
    key: "delivered",
    title: "Teslim Edildi",
    description: "Alıcı paketi teslim aldı",
  },
  {
    key: "released",
    title: "Satıcıya Ödendi",
    description: "Emanet hesabından satıcı hesabına aktarıldı",
  },
];

/**
 * DIRECT_SALE akışı — alıcı "Hemen Al" deyince escrow yaratılır, saat henüz
 * ekspertize gitmemiştir. Bu nedenle ön adım copy'leri farklı: satıcı saati
 * partner mağazaya teslim eder, sonra eksper doğrular.
 */
const DIRECT_SALE_STEPS: Step[] = [
  {
    key: "pending_payment",
    title: "Ödeme Bekleniyor",
    description: "Siparişiniz oluştu — Güvenli Kasa'ya ödeme yapın",
  },
  {
    key: "funded",
    title: "Ödeme Alındı",
    description:
      "Para Güvenli Kasa'da bloke edildi. Satıcıya teslimat kodu iletildi.",
  },
  {
    key: "awaiting_authentication",
    title: "Satıcı Saati Mağazaya Teslim Ediyor",
    description: "Partner mağaza ekspertiz için saati bekliyor",
  },
  {
    key: "authenticated",
    title: "Orijinallik Onaylandı",
    description: "Uzman saat üzerinde doğrulama yaptı",
  },
  {
    key: "shipped_to_buyer",
    title: "Alıcıya Gönderildi",
    description: "Sigortalı kargo yola çıktı",
  },
  {
    key: "delivered",
    title: "Teslim Edildi",
    description: "Alıcı paketi teslim aldı",
  },
  {
    key: "released",
    title: "Satıcıya Ödendi",
    description: "Emanet hesabından satıcı hesabına aktarıldı",
  },
];

const STEP_INDEX: Record<EscrowStatus, number> = {
  pending_payment: 0,
  funded: 1,
  awaiting_authentication: 2,
  authenticated: 3,
  shipped_to_buyer: 4,
  delivered: 5,
  released: 6,
  refunded: -1,
  disputed: -1,
};

export function EscrowTimeline({
  current,
  listingType,
}: {
  current: EscrowStatus;
  listingType?: ListingType;
}) {
  const steps = listingType === "direct_sale" ? DIRECT_SALE_STEPS : AUCTION_STEPS;
  const currentIdx = STEP_INDEX[current];
  const isAbnormal = currentIdx === -1;

  if (isAbnormal) {
    return (
      <div className="border border-burgundy/30 bg-burgundy/5 p-6">
        <span className="eyebrow text-burgundy mb-2 block">
          {current === "refunded" ? "İade Edildi" : "Uyuşmazlık"}
        </span>
        <p className="text-sm text-charcoal-500 leading-relaxed">
          {current === "refunded"
            ? "Ödeme alıcıya iade edildi. İşlem tamamlandı."
            : "Bir uyuşmazlık var. Operasyon ekibi inceliyor."}
        </p>
      </div>
    );
  }

  return (
    <ol className="border border-line bg-ivory-50">
      {steps.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isUpcoming = idx > currentIdx;

        return (
          <li
            key={step.key}
            className={`flex gap-4 p-5 ${
              idx < steps.length - 1 ? "border-b border-line" : ""
            }`}
          >
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                  isDone
                    ? "bg-olive text-ivory"
                    : isCurrent
                      ? "bg-charcoal text-ivory"
                      : "border border-line text-charcoal-300"
                }`}
              >
                {isDone ? "✓" : idx + 1}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`w-px flex-1 mt-2 ${
                    isDone ? "bg-olive" : "bg-line"
                  }`}
                  style={{ minHeight: "1.5rem" }}
                />
              )}
            </div>

            <div className="flex-1 pb-1">
              <h4
                className={`font-display text-base ${
                  isUpcoming ? "text-charcoal-300" : "text-charcoal"
                }`}
              >
                {step.title}
              </h4>
              <p
                className={`text-xs mt-1 leading-relaxed ${
                  isUpcoming ? "text-charcoal-300" : "text-charcoal-500"
                }`}
              >
                {step.description}
              </p>
              {isCurrent && (
                <span className="inline-block mt-2 text-[10px] tracking-widest uppercase text-brass">
                  Şu an
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
