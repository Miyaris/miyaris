import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/shared/Container";
import { backendFetch } from "@/lib/api";
import type {
  PresenterLotListItem,
  PublicSessionDetail,
} from "@/lib/types";

export const dynamic = "force-dynamic";

async function getSession(
  id: string,
): Promise<PublicSessionDetail | null> {
  try {
    return await backendFetch<PublicSessionDetail>(
      `/api/v1/auction-sessions/${id}`,
    );
  } catch {
    return null;
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function formatUsd(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const LOT_STATUS: Record<string, { label: string; cls: string }> = {
  scheduled: {
    label: "Sırada",
    cls: "border-charcoal/20 text-charcoal-700 bg-ivory-100",
  },
  live: {
    label: "Şu An Açık",
    cls: "border-olive/40 text-olive bg-olive/10",
  },
  ended: {
    label: "Tamamlandı",
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

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession(params.id);
  return {
    title: session
      ? `${session.name} — Canlı Müzayede`
      : "Müzayede Oturumu",
  };
}

export default async function PublicSessionPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession(params.id);
  if (!session) notFound();

  const isLive = session.status === "live";

  return (
    <Container className="py-16">
      <Link
        href="/auctions"
        className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-charcoal"
      >
        ← Müzayedeler
      </Link>

      <header className="mt-6 mb-12 border-b border-line pb-8">
        <span className="eyebrow text-brass-dark">
          {isLive ? "Canlı Müzayede" : "Planlanan Müzayede"}
        </span>
        <h1 className="font-display text-5xl mt-3">{session.name}</h1>
        <p className="mt-4 text-charcoal-500 tabular-nums">
          Sunucu: <strong>{session.presenter_name}</strong> ·{" "}
          {formatDateTime(session.scheduled_at)} · {session.lots.length} saat
        </p>
        {session.description && (
          <p className="mt-6 text-charcoal-700 max-w-3xl leading-relaxed">
            {session.description}
          </p>
        )}
        {isLive && (
          <div className="mt-6 inline-flex items-center gap-3 border border-olive/40 bg-olive/5 px-4 py-3">
            <span className="w-2 h-2 rounded-full bg-olive animate-pulse" />
            <span className="text-sm text-olive">
              Şu an canlı yayında — listedeki "Şu An Açık" saate teklif verebilirsin
            </span>
          </div>
        )}
      </header>

      {/* Lot listesi */}
      <h2 className="eyebrow text-charcoal-700 mb-6">
        Oturumdaki Saatler
      </h2>
      <ul className="space-y-3">
        {session.lots.map((lot, idx) => (
          <LotCard key={lot.auction_id} lot={lot} index={idx + 1} />
        ))}
      </ul>
    </Container>
  );
}

function LotCard({
  lot,
  index,
}: {
  lot: PresenterLotListItem;
  index: number;
}) {
  const badge = LOT_STATUS[lot.status];
  const isLive = lot.status === "live";
  return (
    <li
      className={`border bg-white p-5 flex items-center gap-5 ${
        isLive ? "border-olive/60" : "border-line"
      }`}
    >
      <span className="font-display text-3xl text-charcoal-300 tabular-nums w-12 text-right shrink-0">
        {index}
      </span>
      <div className="w-20 h-20 bg-ivory-200 shrink-0 overflow-hidden">
        {lot.primary_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lot.primary_image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg truncate">
          {lot.brand} {lot.model}
        </p>
        <p className="text-xs text-charcoal-300 tabular-nums">
          Ref. {lot.reference_number} · {lot.bid_count} teklif
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-base tabular-nums">{formatUsd(lot.current_price)}</p>
        <p className="text-[10px] text-charcoal-300 tabular-nums">
          başlangıç: {formatUsd(lot.starting_price)}
        </p>
      </div>
      <span
        className={`inline-block text-[10px] tracking-widest uppercase border px-2 py-1 shrink-0 ${badge?.cls ?? ""}`}
      >
        {badge?.label ?? lot.status}
      </span>
      {isLive ? (
        <Link
          href={`/auctions/${lot.auction_id}`}
          className="bg-olive text-ivory px-5 py-3 text-xs tracking-widest uppercase hover:bg-olive/90 shrink-0"
        >
          Teklif Ver →
        </Link>
      ) : (
        <Link
          href={`/auctions/${lot.auction_id}`}
          className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-brass border-b border-charcoal/20 hover:border-brass pb-0.5 shrink-0"
        >
          Detay
        </Link>
      )}
    </li>
  );
}
