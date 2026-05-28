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
 * Lot listesi sağda dikey: aktif lot vurgulanır (brass border + animasyon).
 * Bittikçe işaretlenir, sıradakine geçilir.
 *
 * Aksiyonlar:
 *  - "Sıradaki Saat" → mevcut lot ENDED (escrow varsa), sıradaki LIVE
 *  - "SATTIM" → mevcut lot ENDED + escrow (sıradakine geçmez, manuel
 *    advance bekler)
 *  - "+30 Saniye" → mevcut lot'un extended_until'i
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

  return (
    <main className="min-h-screen bg-charcoal text-ivory flex flex-col">
      <header className="border-b border-ivory/10 px-12 py-5 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-baseline gap-6">
          <Link
            href={`/presenter/sessions/${session.id}`}
            className="text-[10px] tracking-[0.3em] uppercase text-ivory/40 hover:text-ivory/70"
          >
            ← Detaya Dön
          </Link>
          <p className="text-[10px] tracking-[0.3em] uppercase text-brass">
            {session.status === "live" ? "Canlı Oturum" : "Oturum"}
          </p>
          <h1 className="font-display text-2xl truncate max-w-md">
            {session.name}
          </h1>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-0">
        {/* SOL — Aktif lot canlı paneli */}
        <section className="flex flex-col items-center justify-center px-12 py-12 relative">
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
              onActionSuccess={async () => {
                // Server'dan session detayını ve yeni bid listesini tekrar çek
                try {
                  const fresh = await fetch(
                    `/api/presenter/sessions/${session.id}/refresh`,
                    { cache: "no-store" },
                  );
                  if (fresh.ok) {
                    const data = await fresh.json();
                    setSession(data);
                    // Yeni current lot için bidleri sıfırla; WS hızlıca dolduracak
                    setBidsInitial([]);
                  } else {
                    router.refresh();
                  }
                } catch {
                  router.refresh();
                }
              }}
            />
          ) : (
            <NoLiveLotPanel
              sessionStatus={session.status}
              sessionId={session.id}
              hasUpcoming={session.lots.some(
                (l) => l.status === "scheduled",
              )}
              actionPending={actionPending}
              setActionPending={setActionPending}
              actionError={actionError}
              setActionError={setActionError}
              onRefresh={() => router.refresh()}
            />
          )}
        </section>

        {/* SAĞ — Lot listesi (oturum sırası) */}
        <aside className="border-t lg:border-t-0 lg:border-l border-ivory/10 bg-black/30 px-6 py-8 flex flex-col">
          <p className="text-[11px] tracking-[0.4em] uppercase text-ivory/40 mb-5">
            Oturum Sırası ({session.lots.length})
          </p>
          <ol className="space-y-2 overflow-y-auto">
            {session.lots.map((lot, idx) => (
              <LotRow
                key={lot.auction_id}
                lot={lot}
                index={idx + 1}
                isActive={lot.status === "live"}
              />
            ))}
          </ol>
          <div className="mt-auto pt-6 border-t border-ivory/10">
            <p className="text-[10px] tracking-[0.3em] uppercase text-ivory/30">
              Oturum ID: {session.id.slice(0, 8)}
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
    <>
      <p className="text-[11px] tracking-[0.4em] uppercase text-ivory/40 mb-3">
        Şu Anki Saat — {lot.brand} {lot.model}
      </p>
      <p className="text-xs text-ivory/30 tabular-nums mb-6">
        Ref. {lot.reference_number}
      </p>

      <div className="font-display text-[clamp(96px,14vw,180px)] leading-none tabular-nums text-brass">
        {formatUsd(state.currentPrice)}
      </div>

      <div className="mt-8 flex items-center gap-4">
        <span className="text-xl text-ivory/60 tracking-wide tabular-nums">
          {highestBid?.bidder_alias ?? "—"}
        </span>
        {highestBid && (
          <span className="inline-flex items-center gap-2 px-3 py-1 border border-olive/40 bg-olive/10 text-olive text-xs tracking-widest uppercase">
            ✓ Onaylı
          </span>
        )}
      </div>

      {remainingSec !== null && remainingSec > 0 && (
        <div className="mt-10 text-center">
          <p className="text-[10px] tracking-[0.4em] uppercase text-ivory/40 mb-2">
            Kalan Süre
          </p>
          <p
            className={`font-display text-6xl tabular-nums ${
              remainingSec <= 30 ? "text-burgundy" : "text-ivory"
            }`}
          >
            {formatTimer(remainingSec)}
          </p>
        </div>
      )}

      <div className="mt-10 w-full max-w-2xl space-y-4">
        <div className="flex items-center justify-center gap-4 flex-wrap">
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
              className="flex-1 bg-burgundy hover:bg-burgundy/90 disabled:opacity-30 text-ivory py-6 text-2xl tracking-[0.25em] uppercase font-display border-2 border-burgundy"
            >
              SATTIM
            </button>
            <button
              type="button"
              onClick={() => setConfirmingAdvance(true)}
              className="flex-1 bg-olive hover:bg-olive/90 text-ivory py-6 text-2xl tracking-[0.25em] uppercase font-display border-2 border-olive"
            >
              Sıradaki ↓
            </button>
          </div>
        )}

        {actionError && (
          <p className="text-sm text-burgundy border-l-2 border-burgundy pl-3">
            {actionError}
          </p>
        )}
      </div>
    </>
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
      <div className="text-center max-w-md">
        <p className="eyebrow text-ivory/40 mb-4">Oturum aktif değil</p>
        <p className="text-ivory/60 leading-relaxed">
          Bu oturum {sessionStatus === "planning" ? "henüz canlıya alınmadı" : sessionStatus === "ended" ? "bitti" : "iptal edildi"}.
          Detay sayfasından durumu yönet.
        </p>
        <Link
          href={`/presenter/sessions/${sessionId}`}
          className="mt-6 inline-block text-xs tracking-widest uppercase border border-ivory/40 px-6 py-3 hover:bg-ivory hover:text-charcoal"
        >
          Detaya Dön
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center max-w-md">
      <p className="eyebrow text-ivory/40 mb-4">Mevcut lot yok</p>
      <p className="text-ivory/60 leading-relaxed mb-8">
        {hasUpcoming
          ? "Sıradaki saate geçmek için aşağıdaki butona bas."
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
      ? "border-burgundy/40 bg-burgundy/5"
      : "border-olive/40 bg-olive/5";
  return (
    <div
      className={`border ${containerCls} px-6 py-4 flex items-center justify-between gap-4 flex-wrap`}
    >
      <p className="text-sm text-ivory/90 flex-1 min-w-[200px]">
        {message} <strong className={accentText}>{highlight}</strong>
      </p>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="text-xs tracking-[0.3em] uppercase text-ivory/60 hover:text-ivory"
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
      className={`flex items-center gap-3 px-3 py-2.5 border ${
        isActive
          ? "border-brass/60 bg-brass/10 animate-pulse"
          : done
            ? "border-ivory/10 opacity-50"
            : "border-ivory/10"
      }`}
    >
      <span className="font-display text-lg text-ivory/40 tabular-nums w-6 text-right shrink-0">
        {index}
      </span>
      <div className="w-10 h-10 bg-ivory/10 shrink-0 overflow-hidden">
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
        <p className="text-sm text-ivory truncate">
          {lot.brand} {lot.model}
        </p>
        <p className="text-[10px] tracking-widest uppercase text-ivory/30 tabular-nums">
          {formatUsd(lot.current_price)} · {lot.bid_count} teklif
        </p>
      </div>
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
