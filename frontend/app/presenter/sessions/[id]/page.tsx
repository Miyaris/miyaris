import Link from "next/link";
import { notFound } from "next/navigation";

import { backendFetch } from "@/lib/api";
import type { PresenterSessionDetail } from "@/lib/types";

import { AddLotForm } from "./AddLotForm";
import { SessionLifecycleActions } from "./SessionLifecycleActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Oturum Detayı" };

async function getSession(
  id: string,
): Promise<PresenterSessionDetail | null> {
  try {
    return await backendFetch<PresenterSessionDetail>(
      `/api/v1/presenter/sessions/${id}`,
      { authenticated: true },
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

const LOT_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  scheduled: {
    label: "Sırada",
    cls: "border-charcoal/20 text-charcoal-700 bg-ivory-100",
  },
  live: {
    label: "Canlı",
    cls: "border-olive/40 text-olive bg-olive/10",
  },
  ended: { label: "Bitti", cls: "border-line text-charcoal-500 bg-ivory-200" },
  completed: {
    label: "Tamamlandı",
    cls: "border-line text-charcoal-500 bg-ivory-200",
  },
  cancelled: {
    label: "İptal",
    cls: "border-burgundy/30 text-burgundy bg-burgundy/10",
  },
};

const SESSION_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  planning: {
    label: "Hazırlanıyor",
    cls: "border-charcoal/20 text-charcoal-700 bg-ivory-100",
  },
  live: { label: "Canlı", cls: "border-olive/40 text-olive bg-olive/10" },
  ended: { label: "Bitti", cls: "border-line text-charcoal-500 bg-ivory-200" },
  cancelled: {
    label: "İptal",
    cls: "border-burgundy/30 text-burgundy bg-burgundy/10",
  },
};

export default async function PresenterSessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession(params.id);
  if (!session) notFound();

  const badge = SESSION_STATUS_LABEL[session.status];
  const canEdit = session.status === "planning" || session.status === "live";
  const canAddLot = canEdit;

  return (
    <main className="min-h-screen bg-ivory">
      <div className="max-w-screen-xl mx-auto px-6 py-10">
        <Link
          href="/presenter"
          className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-charcoal"
        >
          ← Sunucu Paneli
        </Link>

        <header className="mt-6 mb-10 border-b border-line pb-6">
          <div className="flex items-baseline justify-between flex-wrap gap-4">
            <h1 className="font-display text-4xl">{session.name}</h1>
            <span
              className={`inline-block text-xs tracking-widest uppercase border px-3 py-1.5 ${badge.cls}`}
            >
              {badge.label}
            </span>
          </div>
          <p className="mt-3 text-sm text-charcoal-500 tabular-nums">
            Planlanan: {formatDateTime(session.scheduled_at)} ·{" "}
            {session.lots.length} saat
          </p>
          {session.description && (
            <p className="mt-4 text-sm text-charcoal-700 max-w-3xl leading-relaxed">
              {session.description}
            </p>
          )}

          {/* Oturum yaşam döngüsü aksiyonları */}
          <div className="mt-6">
            <SessionLifecycleActions
              sessionId={session.id}
              status={session.status}
              lotCount={session.lots.length}
            />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-12">
          {/* SOL — Lot listesi */}
          <section>
            <h2 className="eyebrow text-charcoal-700 mb-5">
              Saatler ({session.lots.length})
            </h2>
            {session.lots.length === 0 ? (
              <div className="border border-dashed border-line bg-ivory-50 py-16 text-center">
                <p className="text-sm text-charcoal-500">
                  Bu oturuma henüz saat eklemedin.
                </p>
                <p className="text-xs text-charcoal-300 mt-2">
                  Sağdaki formu kullanarak ilk saatini ekle.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {session.lots.map((lot, idx) => {
                  const lotBadge = LOT_STATUS_LABEL[lot.status];
                  return (
                    <li
                      key={lot.auction_id}
                      className="border border-line bg-white p-4 flex items-center gap-5"
                    >
                      <span className="font-display text-2xl text-charcoal-300 tabular-nums w-10 text-right shrink-0">
                        {idx + 1}
                      </span>
                      <div className="w-16 h-16 bg-ivory-200 shrink-0 overflow-hidden">
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
                        <p className="font-display text-base truncate">
                          {lot.brand} {lot.model}
                        </p>
                        <p className="text-xs text-charcoal-300 tabular-nums truncate">
                          Ref. {lot.reference_number} · {lot.bid_count} teklif
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm tabular-nums">
                          {formatUsd(lot.current_price)}
                        </p>
                        <p className="text-[10px] text-charcoal-300 tabular-nums">
                          başlangıç: {formatUsd(lot.starting_price)}
                        </p>
                      </div>
                      <span
                        className={`inline-block text-[10px] tracking-widest uppercase border px-2 py-1 shrink-0 ${lotBadge?.cls ?? ""}`}
                      >
                        {lotBadge?.label ?? lot.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* SAĞ — Saat ekleme formu (yalnız PLANNING/LIVE) */}
          <aside>
            {canAddLot ? (
              <div className="border border-line bg-white p-6">
                <h2 className="eyebrow text-brass-dark mb-4">Saat Ekle</h2>
                <AddLotForm sessionId={session.id} />
              </div>
            ) : (
              <div className="border border-line bg-ivory-50 p-6 text-center">
                <p className="text-xs text-charcoal-500 leading-relaxed">
                  Bu oturum {session.status === "ended" ? "bitti" : "iptal edildi"}.
                  Saat eklenemez.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
