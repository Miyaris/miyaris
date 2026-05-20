import Link from "next/link";
import { notFound } from "next/navigation";

import { AIStatusIndicator } from "@/components/account/AIStatusIndicator";
import { AIValuationCard } from "@/components/account/AIValuationCard";
import { StatusBadge } from "@/components/account/StatusBadge";
import { Container } from "@/components/shared/Container";
import { WatchGallery } from "@/components/watches/WatchGallery";
import { ApiError, backendFetch } from "@/lib/api";
import type { WatchOwnerDetail } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "İlan Detayı" };

const CONDITION_LABELS: Record<string, string> = {
  new: "Sıfır",
  mint: "Mint",
  excellent: "Mükemmel",
  good: "İyi",
  fair: "Orta",
};

async function getWatch(id: string): Promise<WatchOwnerDetail | null> {
  try {
    return await backendFetch<WatchOwnerDetail>(`/api/v1/watches/me/${id}`, {
      authenticated: true,
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
      return null;
    }
    throw e;
  }
}

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { just_created?: string };
}) {
  const watch = await getWatch(params.id);
  if (!watch) notFound();

  const justCreated = searchParams.just_created === "1";

  return (
    <Container className="py-12">
      <Link
        href="/account/listings"
        className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-brass border-b border-current pb-0.5"
      >
        ← İlanlarıma dön
      </Link>

      {justCreated && (
        <div className="mt-8 border border-olive/30 bg-olive/5 p-6">
          <span className="eyebrow text-olive mb-2 block">İlan Oluşturuldu</span>
          <p className="text-sm text-charcoal-700 leading-relaxed">
            Saatiniz inceleme kuyruğuna alındı. AI ajanlarımız değerleme ve metin
            hazırlama sürecini başlattı; durum güncellemelerini bu sayfada
            takip edebilirsiniz.
          </p>
        </div>
      )}

      {/* Partner mağaza teslimat banner'ı — ekspertiz bekleyen tüm akışlar
          için: legacy pending_review, müzayede öncesi pending_pre_expertise,
          direkt satış sonrası awaiting_expertise. */}
      {watch.delivery_code &&
        (watch.status === "pending_review" ||
          watch.status === "pending_pre_expertise" ||
          watch.status === "awaiting_expertise") && (
          <div className="mt-8 border-2 border-brass bg-brass/5 p-6 md:p-8">
            <div className="flex items-start gap-6 flex-wrap md:flex-nowrap">
              <div className="flex-shrink-0">
                <span className="eyebrow text-brass-dark mb-2 block">
                  {watch.status === "awaiting_expertise"
                    ? "Satış Sonrası Teslimat Kodu"
                    : "Ön Ekspertiz Teslimat Kodu"}
                </span>
                <div className="font-display text-3xl md:text-4xl tabular-nums tracking-wider">
                  {watch.delivery_code}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-charcoal-700 leading-relaxed">
                  Lütfen saatinizi{" "}
                  <strong className="text-charcoal">
                    {watch.delivery_code}
                  </strong>{" "}
                  kodu ile yetkili Miyaris partner mağazasına teslim ediniz.{" "}
                  {watch.status === "awaiting_expertise"
                    ? "Alıcıya kargolanmadan önce uzman onayı alınacak; onaylanan saat doğrudan alıcıya yollanır ve ödemeniz serbest bırakılır."
                    : "Ekspertiz onayı tamamlandıktan sonra ilanınız haftalık müzayede planına otomatik olarak alınır."}
                </p>
                <p className="text-xs text-charcoal-300 mt-3 leading-relaxed">
                  Partner mağaza listesi için{" "}
                  <a
                    href="/how-it-works"
                    className="border-b border-current hover:text-brass"
                  >
                    Nasıl Çalışır
                  </a>{" "}
                  sayfasına bakabilirsiniz. Kodu mağazada ekspere göstermeniz
                  yeterlidir.
                </p>
              </div>
            </div>
          </div>
        )}

      <div className="mt-12 grid md:grid-cols-12 gap-12">
        <div className="md:col-span-6">
          <WatchGallery
            images={watch.images}
            alt={`${watch.brand} ${watch.model}`}
          />
        </div>

        <div className="md:col-span-6 space-y-8">
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="eyebrow">{watch.brand}</span>
                <h1 className="font-display text-4xl mt-2">{watch.model}</h1>
              </div>
              <StatusBadge status={watch.status} />
            </div>
            <p className="text-charcoal-500 tabular-nums">
              Ref. {watch.reference_number}
              {watch.year && ` · ${watch.year}`}
            </p>
            <AIStatusIndicator
              status={watch.ai_processing_status}
              className="mt-3"
            />
          </div>

          <AIValuationCard
            status={watch.ai_processing_status}
            valuation={watch.latest_valuation}
            error={watch.ai_processing_error}
          />

          <SpecsTable
            condition={
              CONDITION_LABELS[watch.condition] ?? watch.condition
            }
            boxPapers={watch.box_papers}
            serialNumber={watch.serial_number}
          />
        </div>
      </div>

      <section className="mt-20 grid md:grid-cols-12 gap-12">
        <div className="md:col-span-6">
          <h2 className="font-display text-2xl mb-4">Sizin Açıklamanız</h2>
          <p className="text-charcoal-700 leading-relaxed whitespace-pre-line">
            {watch.description}
          </p>
        </div>

        {watch.seo_description && (
          <div className="md:col-span-6">
            <h2 className="font-display text-2xl mb-4 flex items-center gap-3">
              AI Tarafından Yazılan Metin
              <span className="eyebrow text-brass">Yayında bu metin gösterilir</span>
            </h2>
            <p className="text-charcoal-700 leading-relaxed whitespace-pre-line">
              {watch.seo_description}
            </p>
          </div>
        )}
      </section>

      {watch.status === "active" && watch.listing_type === "auction" && (
        <section className="mt-16 border-t border-line pt-12 text-center">
          <h3 className="font-display text-2xl mb-4">İlan onaylandı</h3>
          <p className="text-charcoal-500 mb-8">
            Saatiniz açık artırmaya çıkmaya hazır.
          </p>
          <Link
            href={`/sell/auction/new?watch=${watch.id}`}
            className="inline-block bg-charcoal text-ivory px-8 py-4 text-sm tracking-widest uppercase hover:bg-charcoal-700 transition-colors"
          >
            Müzayedeye Çıkar
          </Link>
        </section>
      )}

      {watch.status === "active" && watch.listing_type === "direct_sale" && (
        <section className="mt-16 border-t border-line pt-12 text-center">
          <h3 className="font-display text-2xl mb-4">Mağazada Yayında</h3>
          <p className="text-charcoal-500 mb-8 max-w-xl mx-auto leading-relaxed">
            Saatiniz Miyaris Mağaza vitrininde sabit fiyatla satılıyor. Alıcı
            satın aldığında size partner mağaza teslimat kodu gösterilecek.
          </p>
          <Link
            href={`/watches/${watch.slug}`}
            className="inline-block border border-charcoal px-8 py-4 text-sm tracking-widest uppercase hover:bg-charcoal hover:text-ivory transition-colors"
          >
            Vitrindeki İlanı Gör →
          </Link>
        </section>
      )}
    </Container>
  );
}

function SpecsTable({
  condition,
  boxPapers,
  serialNumber,
}: {
  condition: string;
  boxPapers: boolean;
  serialNumber: string | null;
}) {
  const rows: [string, string][] = [
    ["Durum", condition],
    ["Kutu & Kağıtlar", boxPapers ? "Var" : "Yok"],
    ...(serialNumber ? ([["Seri No", serialNumber]] as [string, string][]) : []),
  ];
  return (
    <dl className="divide-y divide-line border-y border-line">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between py-3 text-sm">
          <dt className="text-charcoal-300 tracking-wide">{label}</dt>
          <dd className="text-charcoal-700 font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
