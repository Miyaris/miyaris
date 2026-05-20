import Link from "next/link";
import { notFound } from "next/navigation";

import { BuyDirectButton } from "@/app/watches/[slug]/BuyDirectButton";
import { Container } from "@/components/shared/Container";
import { WatchGallery } from "@/components/watches/WatchGallery";
import { ApiError, backendFetch } from "@/lib/api";
import { formatUSD } from "@/lib/format";
import type { WatchPublic } from "@/lib/types";

export const dynamic = "force-dynamic";

const CONDITION_LABELS: Record<string, string> = {
  new: "Sıfır",
  mint: "Mint",
  excellent: "Mükemmel",
  good: "İyi",
  fair: "Orta",
};

async function getWatch(slug: string): Promise<WatchPublic | null> {
  try {
    return await backendFetch<WatchPublic>(
      `/api/v1/watches/by-slug/${encodeURIComponent(slug)}`,
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const watch = await getWatch(params.slug);
  if (!watch) return { title: "Saat Bulunamadı — Miyaris" };
  return { title: `${watch.brand} ${watch.model} — Miyaris Mağaza` };
}

export default async function WatchDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const watch = await getWatch(params.slug);
  if (!watch) notFound();

  const canBuyNow =
    watch.listing_type === "direct_sale" &&
    watch.status === "active" &&
    watch.asking_price !== null;

  return (
    <Container className="py-12">
      <Link
        href="/shop"
        className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-brass border-b border-current pb-0.5"
      >
        ← Mağazaya dön
      </Link>

      <div className="mt-12 grid md:grid-cols-12 gap-12">
        <div className="md:col-span-7">
          <WatchGallery
            images={watch.images}
            alt={`${watch.brand} ${watch.model}`}
          />
        </div>

        <div className="md:col-span-5 space-y-8">
          <div>
            <span className="eyebrow">{watch.brand}</span>
            <h1 className="font-display text-4xl mt-2">{watch.model}</h1>
            <p className="text-charcoal-500 tabular-nums mt-2">
              Ref. {watch.reference_number} · {watch.year}
            </p>
          </div>

          {canBuyNow ? (
            <div className="border border-charcoal p-8 bg-ivory space-y-6">
              <div>
                <span className="eyebrow text-brass mb-1 block">
                  Sabit Fiyat
                </span>
                <div className="font-display text-4xl tabular-nums">
                  {formatUSD(watch.asking_price ?? "0")}
                </div>
              </div>
              <BuyDirectButton
                slug={watch.slug}
                listedPrice={watch.asking_price ?? "0"}
              />
              <p className="text-xs text-charcoal-300 leading-relaxed">
                Ödemeniz Miyaris Güvenli Kasa'da tutulur. Saat partner mağaza
                ekspertizinden geçtikten sonra adresinize gönderilir.
              </p>
            </div>
          ) : (
            <div className="border border-line p-6 bg-ivory-50">
              <span className="eyebrow text-charcoal-300 block mb-2">
                Satışta Değil
              </span>
              <p className="text-sm text-charcoal-500 leading-relaxed">
                Bu saat şu anda Miyaris Mağaza'da satışta değil. Açık artırma
                olarak listelenmiş olabilir.
              </p>
            </div>
          )}

          <SpecsTable
            condition={CONDITION_LABELS[watch.condition] ?? watch.condition}
            boxPapers={watch.box_papers}
            year={watch.year}
          />
        </div>
      </div>

      <section className="mt-16 max-w-3xl">
        <h2 className="font-display text-2xl mb-4">Açıklama</h2>
        <p className="text-charcoal-700 leading-relaxed whitespace-pre-line">
          {watch.seo_description || watch.description}
        </p>
      </section>
    </Container>
  );
}

function SpecsTable({
  condition,
  boxPapers,
  year,
}: {
  condition: string;
  boxPapers: boolean;
  year: number;
}) {
  const rows: [string, string][] = [
    ["Üretim Yılı", String(year)],
    ["Kondisyon", condition],
    ["Kutu & Kağıtlar", boxPapers ? "Var" : "Yok"],
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
