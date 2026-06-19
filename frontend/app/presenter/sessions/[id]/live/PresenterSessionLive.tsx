"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuctionStream } from "@/hooks/useAuctionStream";
import type {
  BidPublic,
  PresenterLotListItem,
  PresenterSessionDetail,
} from "@/lib/types";

/**
 * Canlı Sunucu Ekranı — sıralı oturum akışı.
 *
 * Tasarım: ivory zemin + kömür yazı + altın vurgu. Ana site estetiğiyle
 * uyumlu klasik müzayede evi havası. Saat görseli aktif panelde belirgin.
 *
 * Aksiyonlar:
 *  - "Sıradaki Saat" → mevcut lot ENDED (Güvenli Kasa varsa), sıradaki LIVE
 *  - "SATTIM" → mevcut lot ENDED + Güvenli Kasa (sıradakine geçmez, manuel
 *    bekler)
 *  - "+30 Saniye" → mevcut lotun extended_until'i
 *  - "Oturumu Bitir" → tüm oturum manuel ENDED
 *
 * WS sadece mevcut LIVE lot'a bağlanır. Lot değişince hook re-init olur
 * (key prop ile zorlanır).
 */
export function PresenterSessionLive({
  session: initialSession,
  initialBids,
}: {
  session: PresenterSessionDetail;
  initialBids: BidPublic[];
}) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [bidsInitial, setBidsInitial] = useState(initialBids);
  const [actionPending, setActionPending] = useState<
    "advance" | "finalize" | "extend" | "end" | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentLot = useMemo(
    () => session.lots.find((l) => l.status === "live") ?? null,
    [session],
  );

  const upcomingLots = useMemo(
    () => session.lots.filter((l) => l.status === "scheduled"),
    [session],
  );
  const completedLots = useMemo(
    () => session.lots.filter((l) => l.status === "ended" || l.status === "completed"),
    [session],
  );

  async function refreshSession() {
    try {
      const fresh = await fetch(
        `/api/presenter/sessions/${session.id}/refresh`,
        { cache: "no-store" },
      );
      if (fresh.ok) {
        const data = await fresh.json();
        setSession(data);
        setBidsInitial([]);
      } else {
        router.refresh();
      }
    } catch {
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen bg-ivory text-charcoal flex flex-col">
      {/* Üst başlık şeridi */}
      <header className="border-b border-line bg-ivory/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="px-8 md:px-12 py-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-baseline gap-6">
            <Link
              href={`/presenter/sessions/${session.id}`}
              className="text-[10px] tracking-[0.3em] uppercase text-charcoal-500 hover:text-brass-dark"
            >
              ← Detaya Dön
            </Link>
            <div className="flex items-baseline gap-3">
              {session.status === "live" && (
                <span className="inline-flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-burgundy">
                  <span className="w-1.5 h-1.5 bg-burgundy rounded-full animate-pulse" />
                  Canlı Yayında
                </span>
              )}
              <h1 className="font-display text-2xl text-charcoal truncate max-w-md">
                {session.name}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-5 text-xs tracking-[0.2em] uppercase text-charcoal-500">
            <span>
              {completedLots.length} <span className="text-charcoal-300">·</span> {upcomingLots.length} sırada
            </span>
            <span className="hidden md:inline-flex items-center gap-2 text-olive">
              <span className="w-1.5 h-1.5 bg-olive rounded-full" />
              Sunucu çevrimiçi
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-0">
        {/* SOL — Aktif lot canlı paneli */}
        <section className="flex flex-col items-stretch justify-center px-8 md:px-12 py-10 relative">
          {currentLot ? (
            <ActiveLotPanel
              key={currentLot.auction_id}
              lot={currentLot}
              initialBids={
                bidsInitial.length > 0 &&
                bidsInitial[0]?.auction_id === currentLot.auction_id
                  ? bidsInitial
                  : []
              }
              sessionId={session.id}
              actionPending={actionPending}
              setActionPending={setActionPending}
              actionError={actionError}
              setActionError={setActionError}
              onActionSuccess={refreshSession}
            />
          ) : (
            <NoLiveLotPanel
              sessionStatus={session.status}
              sessionId={session.id}
              hasUpcoming={upcomingLots.length > 0}
              actionPending={actionPending}
              setActionPending={setActionPending}
              actionError={actionError}
              setActionError={setActionError}
              onRefresh={() => router.refresh()}
            />
          )}
        </section>

        {/* SAĞ — Oturum sırası */}
        <aside className="border-t lg:border-t-0 lg:border-l border-line bg-ivory-100 px-5 py-7 flex flex-col">
          <div className="flex items-baseline justify-between mb-5">
            <p className="text-[10px] tracking-[0.4em] uppercase text-charcoal-500">
              Oturum Sırası
            </p>
            <p className="text-xs tabular-nums text-charcoal-400">
              {session.lots.length}
            </p>
          </div>
          <ol className="space-y-2 overflow-y-auto pr-1">
            {session.lots.map((lot, idx) => (
              <LotRow
                key={lot.auction_id}
                lot={lot}
                index={idx + 1}
                isActive={lot.status === "live"}
              />
            ))}
          </ol>
          <div className="mt-auto pt-6 border-t border-line">
            <p className="text-[10px] tracking-[0.3em] uppercase text-charcoal-300">
              Oturum kimliği: {session.id.slice(0, 8)}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function ActiveLotPanel({
  lot,
  initialBids,
  sessionId,
  actionPending,
  setActionPending,
  actionError,
  setActionError,
  onActionSuccess,
}: {
  lot: PresenterLotListItem;
  initialBids: BidPublic[];
  sessionId: string;
  actionPending: "advance" | "finalize" | "extend" | "end" | null;
  setActionPending: (p: "advance" | "finalize" | "extend" | "end" | null) => void;
  actionError: string | null;
  setActionError: (e: string | null) => void;
  onActionSuccess: () => void;
}) {
  const { state, bids } = useAuctionStream(lot.auction_id, {
    initial: {
      currentPrice: lot.current_price,
      endsAt: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      extendedUntil: null,
      status: lot.status,
      bidCount: lot.bid_count,
    },
    initialBids,
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remainingSec = state.extendedUntil
    ? Math.max(
        0,
        Math.floor(
          (new Date(state.extendedUntil).getTime() - now) / 1000,
        ),
      )
    : null;

  const highestBid = bids[0] ?? null;
  const [confirmingAdvance, setConfirmingAdvance] = useState(false);
  const [confirmingFinalize, setConfirmingFinalize] = useState(false);

  async function call(
    which: "advance" | "finalize" | "extend",
    body?: object,
  ) {
    setActionError(null);
    setActionPending(which);
    try {
      const path =
        which === "advance"
          ? `/api/presenter/sessions/${sessionId}/advance`
          : which === "finalize"
            ? `/api/presenter/sessions/${sessionId}/finalize-current`
            : `/api/presenter/sessions/${sessionId}/extend`;
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data?.detail ?? "İşlem başarısız");
        return;
      }
      setConfirmingAdvance(false);
      setConfirmingFinalize(false);
      onActionSuccess();
    } catch {
      setActionError("Bağlantı hatası");
    } finally {
      setActionPending(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-10 items-start max-w-6xl mx-auto w-full">
      {/* Saat görseli */}
      <div className="aspect-square bg-ivory-200 overflow-hidden border border-line shadow-sm relative">
        {lot.primary_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lot.primary_image_url}
            alt={`${lot.brand} ${lot.model}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-charcoal-300 text-xs tracking-widest uppercase">
            Görsel yok
          </div>
        )}
        {/* Sol üst köşede altın aksanlı şerit */}
        <div className="absolute top-3 left-3 inline-flex items-center gap-2 bg-brass-dark text-ivory px-3 py-1 text-[10px] tracking-[0.3em] uppercase">
          Şimdi
        </div>
      </div>

      {/* Sağ taraf — bilgi ve aksiyonlar */}
      <div className="flex flex-col">
        <p className="text-[10px] tracking-[0.4em] uppercase text-brass-dark mb-3">
          Şimdiki Saat
        </p>
        <h2 className="font-display text-4xl md:text-5xl text-charcoal leading-tight">
          {lot.brand}
        </h2>
        <p className="font-display text-2xl md:text-3xl text-charcoal-700 mt-1">
          {lot.model}
        </p>
        <p className="text-xs tabular-nums text-charcoal-500 mt-3 tracking-wide">
          Referans {lot.reference_number}
        </p>

        {/* Mevcut fiyat — büyük, klasik tipografi */}
        <div className="mt-8 pb-5 border-b border-line">
          <p className="text-[10px] tracking-[0.4em] uppercase text-charcoal-400 mb-2">
            Şu Anki Teklif
          </p>
          <p className="font-display text-[clamp(64px,10vw,128px)] leading-none tabular-nums text-charcoal">
            {formatUsd(state.currentPrice)}
          </p>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="text-base text-charcoal-700 tabular-nums">
              {highestBid?.bidder_alias ?? "Henüz teklif yok"}
            </span>
            {highestBid && (
              <span className="inline-flex items-center gap-2 px-2.5 py-0.5 border border-olive/40 bg-olive/10 text-olive text-[10px] tracking-widest uppercase">
                ✓ Onaylı
              </span>
            )}
          </div>
        </div>

        {/* Geri sayım */}
        {remainingSec !== null && remainingSec > 0 && (
          <div className="mt-6">
            <p className="text-[10px] tracking-[0.4em] uppercase text-charcoal-400 mb-1">
              Kalan Süre
            </p>
            <p
              className={`font-display text-5xl tabular-nums leading-none ${
                remainingSec <= 30 ? "text-burgundy animate-pulse" : "text-charcoal"
              }`}
            >
              {formatTimer(remainingSec)}
            </p>
          </div>
        )}

        {/* Aksiyonlar */}
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              type="button"
              onClick={() => call("extend", { seconds: 30 })}
              disabled={actionPending !== null}
              className="text-xs tracking-[0.3em] uppercase text-brass-dark hover:text-brass border-b border-brass/40 pb-0.5 disabled:opacity-30"
            >
              {actionPending === "extend" ? "..." : "+ 30 Saniye Ekle"}
            </button>
          </div>

          {confirmingFinalize ? (
            <ConfirmBar
              message="Bu lot şu fiyatla kesinleştirilsin mi? (sıradakine geçmez)"
              highlight={formatUsd(state.currentPrice)}
              pending={actionPending === "finalize"}
              onCancel={() => setConfirmingFinalize(false)}
              onConfirm={() => call("finalize")}
              accent="burgundy"
              confirmLabel="SATTIM"
            />
          ) : confirmingAdvance ? (
            <ConfirmBar
              message="Mevcut lot bittirilip sıradakine geçilsin mi?"
              highlight={formatUsd(state.currentPrice)}
              pending={actionPending === "advance"}
              onCancel={() => setConfirmingAdvance(false)}
              onConfirm={() => call("advance")}
              accent="olive"
              confirmLabel="Sıradakine Geç"
            />
          ) : (
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setConfirmingFinalize(true)}
                disabled={!highestBid}
                className="flex-1 bg-burgundy hover:bg-burgundy/90 disabled:opacity-30 text-ivory py-5 text-xl tracking-[0.25em] uppercase font-display border-2 border-burgundy"
              >
                SATTIM
              </button>
              <button
                type="button"
                onClick={() => setConfirmingAdvance(true)}
                className="flex-1 bg-olive hover:bg-olive/90 text-ivory py-5 text-xl tracking-[0.25em] uppercase font-display border-2 border-olive"
              >
                Sıradaki ↓
              </button>
            </div>
          )}

          {actionError && (
            <p className="text-sm text-burgundy border-l-2 border-burgundy pl-3 py-1">
              {actionError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function NoLiveLotPanel({
  sessionStatus,
  sessionId,
  hasUpcoming,
  actionPending,
  setActionPending,
  actionError,
  setActionError,
  onRefresh,
}: {
  sessionStatus: PresenterSessionDetail["status"];
  sessionId: string;
  hasUpcoming: boolean;
  actionPending: "advance" | "finalize" | "extend" | "end" | null;
  setActionPending: (p: "advance" | "finalize" | "extend" | "end" | null) => void;
  actionError: string | null;
  setActionError: (e: string | null) => void;
  onRefresh: () => void;
}) {
  async function advance() {
    setActionError(null);
    setActionPending("advance");
    try {
      const res = await fetch(
        `/api/presenter/sessions/${sessionId}/advance`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data?.detail ?? "İşlem başarısız");
        return;
      }
      onRefresh();
    } catch {
      setActionError("Bağlantı hatası");
    } finally {
      setActionPending(null);
    }
  }

  if (sessionStatus !== "live") {
    return (
      <div className="text-center max-w-md mx-auto">
        <p className="text-[10px] tracking-[0.4em] uppercase text-charcoal-500 mb-4">
          Oturum aktif değil
        </p>
        <p className="text-charcoal-700 leading-relaxed">
          Bu oturum {sessionStatus === "planning" ? "henüz canlıya alınmadı" : sessionStatus === "ended" ? "tamamlandı" : "iptal edildi"}.
          Detay sayfasından durumu yönet.
        </p>
        <Link
          href={`/presenter/sessions/${sessionId}`}
          className="mt-6 inline-block text-xs tracking-widest uppercase border border-charcoal text-charcoal px-6 py-3 hover:bg-charcoal hover:text-ivory transition-colors"
        >
          Detaya Dön
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center max-w-md mx-auto">
      <p className="text-[10px] tracking-[0.4em] uppercase text-charcoal-500 mb-4">
        Mevcut lot yok
      </p>
      <p className="text-charcoal-700 leading-relaxed mb-8">
        {hasUpcoming
          ? "Sıradaki saate geçmek için aşağıdaki düğmeye bas."
          : "Tüm saatler tamamlandı. Oturumu bitirebilirsin."}
      </p>
      {hasUpcoming && (
        <button
          type="button"
          onClick={advance}
          disabled={actionPending === "advance"}
          className="bg-olive hover:bg-olive/90 text-ivory px-8 py-5 text-xl tracking-[0.25em] uppercase font-display border-2 border-olive disabled:opacity-30"
        >
          {actionPending === "advance" ? "..." : "Sıradakini Aç"}
        </button>
      )}
      {actionError && (
        <p className="mt-4 text-sm text-burgundy">{actionError}</p>
      )}
    </div>
  );
}

function ConfirmBar({
  message,
  highlight,
  pending,
  onCancel,
  onConfirm,
  accent,
  confirmLabel,
}: {
  message: string;
  highlight: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  accent: "burgundy" | "olive";
  confirmLabel: string;
}) {
  const accentBg = accent === "burgundy" ? "bg-burgundy" : "bg-olive";
  const accentText = accent === "burgundy" ? "text-burgundy" : "text-olive";
  const containerCls =
    accent === "burgundy"
      ? "border-burgundy/30 bg-burgundy/5"
      : "border-olive/30 bg-olive/5";
  return (
    <div
      className={`border ${containerCls} px-5 py-4 flex items-center justify-between gap-4 flex-wrap`}
    >
      <p className="text-sm text-charcoal flex-1 min-w-[200px]">
        {message} <strong className={accentText}>{highlight}</strong>
      </p>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="text-xs tracking-[0.3em] uppercase text-charcoal-500 hover:text-charcoal"
        >
          Vazgeç
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={`${accentBg} text-ivory px-6 py-3 text-sm tracking-[0.3em] uppercase hover:opacity-90 disabled:opacity-50`}
        >
          {pending ? "..." : confirmLabel}
        </button>
      </div>
    </div>
  );
}

function LotRow({
  lot,
  index,
  isActive,
}: {
  lot: PresenterLotListItem;
  index: number;
  isActive: boolean;
}) {
  const done = lot.status === "ended" || lot.status === "completed";
  return (
    <li
      className={`flex items-center gap-3 px-3 py-2.5 border transition-colors ${
        isActive
          ? "border-brass/60 bg-brass/10 shadow-sm"
          : done
            ? "border-line bg-ivory-200/40 opacity-60"
            : "border-line bg-ivory hover:bg-ivory-200/40"
      }`}
    >
      <span className="font-display text-lg text-charcoal-400 tabular-nums w-6 text-right shrink-0">
        {index}
      </span>
      <div className="w-12 h-12 bg-ivory-200 shrink-0 overflow-hidden border border-line">
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
        <p className="text-sm text-charcoal truncate font-medium">
          {lot.brand} {lot.model}
        </p>
        <p className="text-[10px] tracking-widest uppercase text-charcoal-500 tabular-nums mt-0.5">
          {formatUsd(lot.current_price)} · {lot.bid_count} teklif
        </p>
      </div>
      {isActive && (
        <span className="text-[9px] tracking-[0.3em] uppercase text-brass-dark shrink-0">
          Canlı
        </span>
      )}
    </li>
  );
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

function formatTimer(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(sec / 60).toString().padStart(2, "0");
  const ss = (sec % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
