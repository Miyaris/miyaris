import Link from "next/link";
import { notFound } from "next/navigation";

import { AIValuationCard } from "@/components/account/AIValuationCard";
import { CertificateForm } from "@/app/admin/moderation/[id]/CertificateForm";
import { RejectForm } from "@/app/admin/moderation/[id]/RejectForm";
import { WatchGallery } from "@/components/watches/WatchGallery";
import { ApiError, backendFetch } from "@/lib/api";
import type { AdminWatchDetail } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "İlan Moderasyonu" };

const CONDITION_LABELS: Record<string, string> = {
  new: "Sıfır",
  mint: "Mint",
  excellent: "Mükemmel",
  good: "İyi",
  fair: "Orta",
};

async function getWatch(id: string): Promise<AdminWatchDetail | null> {
  try {
    return await backendFetch<AdminWatchDetail>(`/api/v1/admin/watches/${id}`, {
      authenticated: true,
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
      return null;
    }
    throw e;
  }
}

export default async function ModerationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const watch = await getWatch(params.id);
  if (!watch) notFound();

  // Üç giriş durumu da ekspertiz/moderasyon kararı bekliyor: legacy
  // pending_review, AUCTION öncesi pending_pre_expertise, DIRECT_SALE sonrası
  // awaiting_expertise.
  const isPending =
    watch.status === "pending_review" ||
    watch.status === "pending_pre_expertise" ||
    watch.status === "awaiting_expertise";

  const STATUS_LABELS: Record<string, string> = {
    draft: "Taslak",
    pending_review: "İnceleniyor",
    pending_pre_expertise: "Ön Ekspertiz Bekliyor",
    active: "Aktif",
    awaiting_expertise: "Ekspertiz Bekliyor",
    sold: "Satıldı",
    rejected: "Reddedildi",
  };

  return (
    <div>
      <Link
        href="/admin/moderation"
        className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-brass border-b border-current pb-0.5"
      >
        ← Kuyruğa dön
      </Link>

      <div className="mt-8 grid lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7 space-y-8">
          <WatchGallery
            images={watch.images}
            alt={`${watch.brand} ${watch.model}`}
          />

          <div>
            <h1 className="font-display text-4xl mb-3">
              {watch.brand} {watch.model}
            </h1>
            <p className="text-charcoal-500 tabular-nums">
              Ref. {watch.reference_number}
              {watch.year && ` · ${watch.year}`}
            </p>
          </div>

          <SpecsTable watch={watch} />

          <div>
            <h2 className="font-display text-xl mb-3">Satıcı Açıklaması</h2>
            <p className="text-charcoal-700 leading-relaxed whitespace-pre-line">
              {watch.description}
            </p>
          </div>

          {watch.seo_description && (
            <div>
              <h2 className="font-display text-xl mb-3 flex items-center gap-3">
                AI Tarafından Yazılan Metin
                <span className="eyebrow text-brass">Yayında bu gösterilir</span>
              </h2>
              <p className="text-charcoal-700 leading-relaxed whitespace-pre-line">
                {watch.seo_description}
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-8">
          <SellerCard
            name={watch.seller.full_name}
            email={watch.seller.email}
            kyc={watch.seller.kyc_verified}
          />

          {/* Partner mağaza teslimat kodu — fiziksel saatle eşleştirme için */}
          {watch.delivery_code && (
            <div className="border-2 border-brass bg-brass/5 p-5">
              <span className="eyebrow text-brass-dark mb-1 block">
                Partner Mağaza Teslimat Kodu
              </span>
              <div className="font-display text-2xl tabular-nums tracking-wider">
                {watch.delivery_code}
              </div>
              <p className="text-xs text-charcoal-500 mt-2 leading-relaxed">
                Saat fiziksel olarak partnere ulaştığında bu kodla eşleştirilir.
                Ekspertiz raporu bu koda referansla hazırlanır.
              </p>
            </div>
          )}

          <AIValuationCard
            status={watch.ai_processing_status}
            valuation={watch.latest_valuation}
            error={watch.ai_processing_error}
          />

          {isPending ? (
            <>
              <CertificateForm watchId={watch.id} />
              <RejectForm watchId={watch.id} />
            </>
          ) : (
            <div className="border border-line bg-ivory-50 p-6">
              <span className="eyebrow mb-2 block">Karar verildi</span>
              <p className="text-sm text-charcoal-700">
                Bu saat artık{" "}
                <strong>
                  {STATUS_LABELS[watch.status] ?? watch.status}
                </strong>{" "}
                durumunda. Moderasyon eylemleri kapalı.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SellerCard({
  name,
  email,
  kyc,
}: {
  name: string;
  email: string;
  kyc: boolean;
}) {
  return (
    <div className="border border-line p-6 bg-ivory-50">
      <span className="eyebrow mb-3 block">Satıcı</span>
      <div className="font-display text-lg">{name}</div>
      <div className="text-sm text-charcoal-500 tabular-nums">{email}</div>
      <div className="mt-3 flex items-center gap-2">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            kyc ? "bg-olive" : "bg-charcoal-300"
          }`}
          aria-hidden
        />
        <span className="eyebrow">
          {kyc ? "KYC doğrulandı" : "KYC bekliyor"}
        </span>
      </div>
    </div>
  );
}

function SpecsTable({ watch }: { watch: AdminWatchDetail }) {
  const rows: [string, string][] = [
    ["Kondisyon", CONDITION_LABELS[watch.condition] ?? watch.condition],
    ["Kutu & Kağıtlar", watch.box_papers ? "Var" : "Yok"],
    ...(watch.serial_number
      ? ([["Seri No", watch.serial_number]] as [string, string][])
      : []),
    [
      "Yüklenme",
      new Date(watch.created_at).toLocaleString("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    ],
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
