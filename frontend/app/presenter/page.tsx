import Link from "next/link";

import { backendFetch } from "@/lib/api";
import type { AuctionStatus, PresenterShowcase } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sunucu Paneli" };

const STATUS_LABEL: Record<AuctionStatus, { label: string; cls: string }> = {
  scheduled: {
    label: "Bekliyor",
    cls: "border-charcoal/20 text-charcoal-700 bg-ivory-100",
  },
  live: {
    label: "Canlı",
    cls: "border-olive/40 text-olive bg-olive/10",
  },
  ended: {
    label: "Bitti",
    cls: "border-line text-charcoal-500 bg-ivory-200",
  },
  completed: {
    label: "Tamamlandı",
    cls: "border-line text-charcoal-500 bg-ivory-200",
  },
  cancelled: {
    label: "İptal",
    cls: "border-burgundy/30 text-burgundy bg-burgundy/10",
  },
};

async function getMyShowcases(): Promise<PresenterShowcase[]> {
  try {
    return await backendFetch<PresenterShowcase[]>(
      "/api/v1/presenter/showcases?limit=100",
      { authenticated: true },
    );
  } catch {
    return [];
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatPrice(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Presenter Hub — yetkili kullanıcının kendi planladığı tüm müzayedeler.
 *
 * Aksiyon haritası:
 *  - Canlı müzayedeler: "Sunucu Ekranı" → /presenter/live/[id]
 *  - Bekleyen müzayedeler: "Sunucu Ekranı" (ön izleme) + zaman gösterimi
 *  - Bitenler: arşivlenir, eylem yok
 *
 * "+ Yeni Yayın" sağ üstte sabit — presenter bir sonraki yayını planlar.
 */
export default async function PresenterHubPage() {
  const showcases = await getMyShowcases();
  const live = showcases.filter((s) => s.status === "live");
  const upcoming = showcases.filter((s) => s.status === "scheduled");
  const closed = showcases.filter(
    (s) => s.status === "ended" || s.status === "completed",
  );

  return (
    <main className="min-h-screen bg-ivory">
      <div className="max-w-screen-2xl mx-auto px-8 py-10">
        <header className="mb-12 border-b border-line pb-6">
          <p className="eyebrow text-brass-dark">Sunucu Paneli</p>
          <div className="flex items-baseline justify-between gap-6 flex-wrap mt-3">
            <h1 className="font-display text-4xl">Yayınlarım</h1>
            <Link
              href="/presenter/new"
              className="text-xs tracking-widest uppercase bg-charcoal text-ivory px-6 py-3 hover:bg-charcoal-700 transition-colors"
            >
              + Yeni Yayın
            </Link>
          </div>
          <p className="mt-4 text-sm text-charcoal-500 max-w-2xl leading-relaxed">
            Kendi müzayedelerini buradan planla, canlı yayında sunucu ekranı
            üzerinden yönet. Ekspertiz adımı atlanır — yetkili presenter olarak
            ürünü doğrudan listeleyebilirsin.
          </p>
        </header>

        {live.length > 0 && (
          <Section title="Canlı" tone="live">
            <ShowcaseGrid items={live} />
          </Section>
        )}

        {upcoming.length > 0 && (
          <Section title="Yaklaşan" tone="scheduled">
            <ShowcaseGrid items={upcoming} />
          </Section>
        )}

        {closed.length > 0 && (
          <Section title="Geçmiş" tone="closed">
            <ShowcaseGrid items={closed} muted />
          </Section>
        )}

        {showcases.length === 0 && (
          <div className="py-24 text-center">
            <p className="eyebrow text-charcoal-300 mb-6">
              Henüz yayın açmadın
            </p>
            <Link
              href="/presenter/new"
              className="text-sm tracking-widest uppercase text-brass-dark border-b border-brass/40 pb-0.5 hover:text-brass"
            >
              İlk müzayedeni planla →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "live" | "scheduled" | "closed";
  children: React.ReactNode;
}) {
  const dotCls =
    tone === "live"
      ? "bg-olive animate-pulse"
      : tone === "scheduled"
        ? "bg-brass"
        : "bg-charcoal-300";
  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-5">
        <span className={`w-2 h-2 rounded-full ${dotCls}`} />
        <h2 className="eyebrow text-charcoal-700">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ShowcaseGrid({
  items,
  muted = false,
}: {
  items: PresenterShowcase[];
  muted?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((s) => (
        <ShowcaseCard key={s.auction_id} showcase={s} muted={muted} />
      ))}
    </div>
  );
}

function ShowcaseCard({
  showcase: s,
  muted,
}: {
  showcase: PresenterShowcase;
  muted: boolean;
}) {
  const badge = STATUS_LABEL[s.status];
  const isLive = s.status === "live";
  const isPlayable = s.status === "live" || s.status === "scheduled";

  return (
    <article
      className={`border border-line bg-white transition-shadow ${
        muted ? "opacity-60" : "hover:shadow-sm"
      }`}
    >
      <div className="aspect-[4/3] bg-ivory-200 overflow-hidden">
        {s.primary_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.primary_image_url}
            alt={`${s.brand} ${s.model}`}
            className="w-full h-full object-cover"
          />
        ) : null}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="font-display text-lg truncate">
              {s.brand} {s.model}
            </p>
            <p className="text-[10px] tracking-widest uppercase text-charcoal-300 tabular-nums">
              Ref. {s.reference_number}
            </p>
          </div>
          <span
            className={`shrink-0 inline-block text-[10px] tracking-widest uppercase border px-2 py-1 ${badge.cls}`}
          >
            {badge.label}
          </span>
        </div>

        <dl className="text-xs grid grid-cols-2 gap-2 mb-4 tabular-nums">
          <div>
            <dt className="text-charcoal-300 tracking-widest uppercase">
              Mevcut
            </dt>
            <dd className="text-charcoal text-base">
              {formatPrice(s.current_price)}
            </dd>
          </div>
          <div>
            <dt className="text-charcoal-300 tracking-widest uppercase">
              Teklif
            </dt>
            <dd className="text-charcoal text-base">{s.bid_count}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-charcoal-300 tracking-widest uppercase">
              {isLive ? "Biter" : "Başlar"}
            </dt>
            <dd className="text-charcoal-700">
              {formatDateTime(isLive ? s.ends_at : s.starts_at)}
            </dd>
          </div>
        </dl>

        {isPlayable && (
          <Link
            href={`/presenter/live/${s.auction_id}`}
            className={`block w-full text-center text-xs tracking-widest uppercase py-3 transition-colors ${
              isLive
                ? "bg-olive text-ivory hover:bg-olive/90"
                : "bg-charcoal text-ivory hover:bg-charcoal-700"
            }`}
          >
            {isLive ? "Sunucu Ekranını Aç" : "Hazırlık Ekranı"}
          </Link>
        )}
      </div>
    </article>
  );
}
