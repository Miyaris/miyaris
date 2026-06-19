import Link from "next/link";

import { backendFetch } from "@/lib/api";
import type {
  PresenterSessionListItem,
  PresenterSessionStatus,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sunucu Paneli" };

const STATUS_LABEL: Record<
  PresenterSessionStatus,
  { label: string; cls: string }
> = {
  planning: {
    label: "Hazırlanıyor",
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
  cancelled: {
    label: "İptal",
    cls: "border-burgundy/30 text-burgundy bg-burgundy/10",
  },
};

async function getMySessions(): Promise<PresenterSessionListItem[]> {
  try {
    return await backendFetch<PresenterSessionListItem[]>(
      "/api/v1/presenter/sessions?limit=100",
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

/**
 * Presenter Hub — yetkili kullanıcının açtığı tüm müzayede oturumları.
 *
 * Yapı:
 *  - Canlı oturumlar üstte (varsa)
 *  - Hazırlanan oturumlar (planlama fazında — saat eklemeye devam)
 *  - Geçmiş oturumlar (bitti / iptal)
 *  - "+ Yeni Oturum" sağ üstte sabit
 */
export default async function PresenterHubPage() {
  const sessions = await getMySessions();
  const live = sessions.filter((s) => s.status === "live");
  const planning = sessions.filter((s) => s.status === "planning");
  const closed = sessions.filter(
    (s) => s.status === "ended" || s.status === "cancelled",
  );

  return (
    <main className="min-h-screen bg-ivory">
      <div className="max-w-screen-2xl mx-auto px-8 py-10">
        <header className="mb-12 border-b border-line pb-6">
          <p className="eyebrow text-brass-dark">Sunucu Paneli</p>
          <div className="flex items-baseline justify-between gap-6 flex-wrap mt-3">
            <h1 className="font-display text-4xl">Oturumlarım</h1>
            <Link
              href="/presenter/new"
              className="text-xs tracking-widest uppercase bg-charcoal text-ivory px-6 py-3 hover:bg-charcoal-700 transition-colors"
            >
              + Yeni Oturum
            </Link>
          </div>
          <p className="mt-4 text-sm text-charcoal-500 max-w-2xl leading-relaxed">
            Bir oturum aç, içine birden çok saat ekle, ardından canlı sunucu
            ekranı üzerinden sırayla satış yap. Herkese açık sayfada oturumun adı
            altında listelenir.
          </p>
        </header>

        {live.length > 0 && (
          <Section title="Canlı" tone="live">
            <SessionGrid items={live} />
          </Section>
        )}
        {planning.length > 0 && (
          <Section title="Hazırlanan" tone="planning">
            <SessionGrid items={planning} />
          </Section>
        )}
        {closed.length > 0 && (
          <Section title="Geçmiş" tone="closed">
            <SessionGrid items={closed} muted />
          </Section>
        )}

        {sessions.length === 0 && (
          <div className="py-24 text-center">
            <p className="eyebrow text-charcoal-300 mb-6">
              Henüz oturum açmadın
            </p>
            <Link
              href="/presenter/new"
              className="text-sm tracking-widest uppercase text-brass-dark border-b border-brass/40 pb-0.5 hover:text-brass"
            >
              İlk oturumunu aç →
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
  tone: "live" | "planning" | "closed";
  children: React.ReactNode;
}) {
  const dotCls =
    tone === "live"
      ? "bg-olive animate-pulse"
      : tone === "planning"
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

function SessionGrid({
  items,
  muted = false,
}: {
  items: PresenterSessionListItem[];
  muted?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((s) => (
        <SessionCard key={s.id} session={s} muted={muted} />
      ))}
    </div>
  );
}

function SessionCard({
  session: s,
  muted,
}: {
  session: PresenterSessionListItem;
  muted: boolean;
}) {
  const badge = STATUS_LABEL[s.status];
  const isLive = s.status === "live";
  const isOpenable = s.status === "live" || s.status === "planning";

  return (
    <article
      className={`border border-line bg-white transition-shadow ${
        muted ? "opacity-60" : "hover:shadow-sm"
      }`}
    >
      <div className="aspect-[4/3] bg-ivory-200 overflow-hidden">
        {s.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.cover_image_url}
            alt={s.name}
            className="w-full h-full object-cover"
          />
        ) : null}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="font-display text-lg truncate">{s.name}</p>
            <p className="text-[10px] tracking-widest uppercase text-charcoal-300 mt-1 tabular-nums">
              {s.lot_count} saat · {formatDateTime(s.scheduled_at)}
            </p>
          </div>
          <span
            className={`shrink-0 inline-block text-[10px] tracking-widest uppercase border px-2 py-1 ${badge.cls}`}
          >
            {badge.label}
          </span>
        </div>

        {s.description && (
          <p className="text-xs text-charcoal-500 mb-4 line-clamp-2 leading-relaxed">
            {s.description}
          </p>
        )}

        {isOpenable && (
          <div className="flex gap-2">
            <Link
              href={`/presenter/sessions/${s.id}`}
              className="flex-1 text-center text-xs tracking-widest uppercase border border-charcoal text-charcoal-700 py-2.5 hover:bg-charcoal hover:text-ivory transition-colors"
            >
              {isLive ? "Yönet" : "Detay"}
            </Link>
            {isLive && (
              <Link
                href={`/presenter/sessions/${s.id}/live`}
                className="flex-1 text-center text-xs tracking-widest uppercase bg-olive text-ivory py-2.5 hover:bg-olive/90"
              >
                Sunucu Ekranı
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
