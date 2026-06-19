import Link from "next/link";

import { AuctionGrid } from "@/components/auctions/AuctionGrid";
import { Container } from "@/components/shared/Container";
import { backendFetch } from "@/lib/api";
import type {
  AuctionListItem,
  AuctionStatus,
  PublicSessionListItem,
} from "@/lib/types";

export const dynamic = "force-dynamic";

// Açık metadata — daha önce eksikti, bu yüzden Google bu sayfayı root
// metadata'sıyla aynı başlık altında indeksledi ve "miyaris.com › auctions"
// olarak ana sonuç gibi gösterdi. Artık her sayfa kendi başlığı + canonical
// URL'i ile ayrışıyor; root tek "homepage" sonucu olarak kalır.
export const metadata = {
  title: "Açık Artırmalar",
  description:
    "Miyaris haftalık küratörlü açık artırmaları — sertifikalı saatler, " +
    "şeffaf teklif geçmişi ve son saniye teklif koruması ile güvenli müzayede.",
  alternates: {
    canonical: "https://miyaris.com/auctions",
  },
  openGraph: {
    title: "Açık Artırmalar | Miyaris",
    description:
      "Sertifikalı lüks saat müzayedelerine teklif verin — Miyaris haftalık " +
      "küratörlü açık artırmaları.",
    url: "https://miyaris.com/auctions",
  },
};

const FILTERS: { value: AuctionStatus | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "live", label: "Canlı" },
  { value: "scheduled", label: "Yakında" },
  { value: "ended", label: "Sona Erdi" },
];

interface SearchParams {
  status?: string;
  brand?: string;
}

async function getAuctions(params: SearchParams): Promise<AuctionListItem[]> {
  const query = new URLSearchParams();
  if (params.status && params.status !== "all") {
    query.set("status_filter", params.status);
  }
  if (params.brand) query.set("brand", params.brand);
  query.set("limit", "60");

  try {
    return await backendFetch<AuctionListItem[]>(
      `/api/v1/auctions?${query.toString()}`,
    );
  } catch {
    return [];
  }
}

async function getPresenterSessions(): Promise<PublicSessionListItem[]> {
  try {
    return await backendFetch<PublicSessionListItem[]>(
      "/api/v1/auction-sessions?limit=30",
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

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [auctions, sessions] = await Promise.all([
    getAuctions(searchParams),
    getPresenterSessions(),
  ]);
  const activeStatus = searchParams.status ?? "all";

  return (
    <Container className="py-16">
      <header className="mb-12">
        <span className="eyebrow">Haftalık Müzayede</span>
        <h1 className="font-display text-5xl mt-4">Müzayedeler</h1>
        <p className="text-charcoal-500 mt-4 max-w-2xl leading-relaxed">
          Anlaşmalı mağaza ekspertizinden geçmiş saatlerin canlı açık
          artırmaları. Pazartesi başlar, Pazar akşamı kapanır.
        </p>
      </header>

      {/* Presenter müzayede oturumları — varsa ayrı bölüm */}
      {sessions.length > 0 && (
        <section className="mb-16">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="eyebrow text-brass-dark">Canlı Sunucu Müzayedeleri</h2>
            <p className="text-xs text-charcoal-300 tabular-nums">
              {sessions.length} oturum
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-12 border-b border-line pb-6">
        {FILTERS.map((f) => {
          const isActive = activeStatus === f.value;
          const href =
            f.value === "all" ? "/auctions" : `/auctions?status=${f.value}`;
          return (
            <a
              key={f.value}
              href={href}
              className={`px-5 py-2 text-xs tracking-widest uppercase transition-colors ${
                isActive
                  ? "bg-charcoal text-ivory"
                  : "text-charcoal-500 hover:text-charcoal"
              }`}
            >
              {f.label}
            </a>
          );
        })}
      </div>

      <AuctionGrid auctions={auctions} />
    </Container>
  );
}

function SessionCard({ session: s }: { session: PublicSessionListItem }) {
  const isLive = s.status === "live";
  return (
    <Link
      href={`/auctions/sessions/${s.id}`}
      className="block border border-line bg-white hover:shadow-sm transition-shadow group"
    >
      <div className="aspect-[4/3] bg-ivory-200 overflow-hidden relative">
        {s.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.cover_image_url}
            alt={s.name}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
          />
        ) : null}
        {isLive && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-2 px-3 py-1 bg-olive text-ivory text-[10px] tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-ivory animate-pulse" />
            Canlı
          </span>
        )}
      </div>
      <div className="p-5">
        <p className="font-display text-xl truncate">{s.name}</p>
        <p className="text-xs text-charcoal-500 mt-1">
          Sunucu: {s.presenter_name}
        </p>
        <p className="text-[10px] tracking-widest uppercase text-charcoal-300 tabular-nums mt-3">
          {s.lot_count} saat · {formatDateTime(s.scheduled_at)}
        </p>
      </div>
    </Link>
  );
}
