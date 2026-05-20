import { formatTRY } from "@/lib/format";
import type { AIValuationOut, AIProcessingStatus } from "@/lib/types";

interface Props {
  status: AIProcessingStatus;
  valuation: AIValuationOut | null;
  error: string | null;
}

export function AIValuationCard({ status, valuation, error }: Props) {
  // Yükleme durumu — kullanıcı saati yeni oluşturduysa
  if (status === "queued" || status === "processing") {
    return (
      <div className="border border-line bg-ivory-50 p-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-2 h-2 rounded-full bg-brass animate-pulse" />
          <span className="eyebrow text-brass-dark">Miyaris AI Analizi</span>
        </div>
        <p className="text-charcoal-500 leading-relaxed">
          Yapay zeka ajanlarımız bu saat için piyasa değerlemesi yapıyor ve SEO
          uyumlu ilan metni hazırlıyor. Bu işlem genellikle 30 saniyeden kısa
          sürer — sayfayı yenileyerek güncel durumu görebilirsiniz.
        </p>
      </div>
    );
  }

  // Hata durumu
  if (status === "failed") {
    return (
      <div className="border border-burgundy/30 bg-burgundy/5 p-8">
        <span className="eyebrow text-burgundy mb-3 block">
          Miyaris AI Analizi — Başarısız
        </span>
        <p className="text-charcoal-500 text-sm leading-relaxed">
          {error ?? "AI ajanları bu saat için bir sonuç üretemedi. Operasyon ekibimiz inceliyor."}
        </p>
      </div>
    );
  }

  // Done ama valuation gelmemişse (rare)
  if (!valuation) return null;

  const confidencePct = Math.round(valuation.confidence_score * 100);
  const confidenceColor =
    confidencePct >= 75
      ? "text-olive"
      : confidencePct >= 50
        ? "text-brass-dark"
        : "text-burgundy";

  const reasoning =
    typeof valuation.raw_output?.reasoning === "string"
      ? (valuation.raw_output.reasoning as string)
      : null;

  const sources = valuation.sources?.comparables;
  const comparableCount = Array.isArray(sources) ? sources.length : 0;

  return (
    <div className="border border-line bg-ivory-50 p-8">
      <div className="flex items-baseline justify-between mb-6">
        <span className="eyebrow text-brass-dark">Miyaris AI Değerlemesi</span>
        <span className={`text-xs tracking-widest uppercase ${confidenceColor}`}>
          %{confidencePct} güven
        </span>
      </div>

      <div className="font-display text-3xl text-charcoal mb-2 tabular-nums">
        {formatTRY(valuation.estimated_value_min)}
        <span className="text-charcoal-300 mx-3">—</span>
        {formatTRY(valuation.estimated_value_max)}
      </div>

      <p className="eyebrow mb-6">
        {comparableCount} karşılaştırma · {valuation.agent_version}
      </p>

      {reasoning && (
        <div className="border-t border-line pt-4">
          <p className="text-sm text-charcoal-700 leading-relaxed">
            {reasoning}
          </p>
        </div>
      )}
    </div>
  );
}
