"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuctionStream } from "@/hooks/useAuctionStream";
import type { BidPublic, PresenterShowcase } from "@/lib/types";

/**
 * Presenter Canlı Sunucu Ekranı.
 *
 * Tasarım:
 *  - Tam ekran dark palette — projektör veya monitörden uzaktan okunabilir.
 *  - Merkez: devasa fiyat (text-9xl range) + onaylı teklif veren alias.
 *  - Sayaç saniyede güncellenir; ends_at veya extended_until referans alınır.
 *  - +30sn ve SATTIM butonları gerçek backend endpoint'lerine bağlı.
 *  - Sağ panel: son 5 teklif logu (WS'ten canlı düşer).
 *  - Halka açık /auctions/[id] sayfasıyla aynı WS odasını dinlediği için
 *    izleyici tarafıyla tam senkron — fiyat ve geri sayım aynı saniyede
 *    iki tarafta da görünür.
 *
 * Instagram canlı yayını paralel akarken presenter konuşur; ekran yalnızca
 * "satış araç paneli" görevini görür.
 */
export function PresenterLiveSession({
  showcase,
  initialBids,
}: {
  showcase: PresenterShowcase;
  initialBids: BidPublic[];
}) {
  const router = useRouter();

  // useAuctionStream initial: showcase'ten dönüş.
  const { state, bids, connected } = useAuctionStream(showcase.auction_id, {
    initial: {
      currentPrice: showcase.current_price,
      endsAt: showcase.ends_at,
      extendedUntil: showcase.extended_until,
      status: showcase.status,
      bidCount: showcase.bid_count,
    },
    initialBids,
  });

  // Geri sayım — saniyede tick
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const effectiveEnd = state.extendedUntil ?? state.endsAt;
  const remainingSec = useMemo(() => {
    const ms = new Date(effectiveEnd).getTime() - now;
    return Math.max(0, Math.floor(ms / 1000));
  }, [effectiveEnd, now]);

  const lowTime = remainingSec <= 30 && state.status === "live";
  const closed = state.status === "ended" || state.status === "completed";
  const isLive = state.status === "live";
  const isScheduled = state.status === "scheduled";

  // Aksiyon state'leri
  const [actionPending, setActionPending] = useState<"extend" | "sell" | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingSell, setConfirmingSell] = useState(false);

  async function callAction(
    which: "extend" | "sell",
    body: object | null,
  ): Promise<void> {
    setActionError(null);
    setActionPending(which);
    try {
      const res = await fetch(
        `/api/presenter/showcases/${showcase.auction_id}/${which}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data?.detail ?? "İşlem başarısız");
        return;
      }
      // WS broadcast zaten state'i güncelliyor — yine de hub'a refresh sinyali
      router.refresh();
    } catch {
      setActionError("Bağlantı hatası");
    } finally {
      setActionPending(null);
    }
  }

  const highestBid = bids[0] ?? null;
  const watchLabel = `${showcase.brand} ${showcase.model}`;

  return (
    <main className="min-h-screen bg-charcoal text-ivory flex flex-col">
      {/* Üst şerit: başlık + bağlantı durumu */}
      <header className="border-b border-ivory/10 px-12 py-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-baseline gap-6">
          <Link
            href="/presenter"
            className="text-[10px] tracking-[0.3em] uppercase text-ivory/40 hover:text-ivory/70"
          >
            ← Panele Dön
          </Link>
          <p className="text-[10px] tracking-[0.3em] uppercase text-brass">
            {closed ? "Müzayede Kapandı" : isLive ? "Canlı" : "Bekliyor"}
          </p>
          <h1 className="font-display text-2xl truncate max-w-md">
            {watchLabel} · Ref. {showcase.reference_number}
          </h1>
        </div>
        <div className="flex items-center gap-8 tabular-nums">
          <Stat label="Toplam Teklif" value={String(state.bidCount)} />
          <Stat
            label="WS"
            value={connected ? "Bağlı" : "Bağlanıyor"}
            tone={connected ? "olive" : "muted"}
          />
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-0">
        {/* SOL — fiyat + sayaç + aksiyon */}
        <section className="flex flex-col items-center justify-center px-12 py-12 relative">
          <p className="text-[11px] tracking-[0.4em] uppercase text-ivory/40 mb-6">
            Mevcut En Yüksek Teklif
          </p>
          <div className="font-display text-[clamp(96px,14vw,192px)] leading-none tabular-nums text-brass">
            {formatUsd(state.currentPrice)}
          </div>

          <div className="mt-10 flex items-center gap-4">
            <span className="text-xl text-ivory/60 tracking-wide tabular-nums">
              {highestBid?.bidder_alias ?? "—"}
            </span>
            {highestBid && (
              <span className="inline-flex items-center gap-2 px-3 py-1 border border-olive/40 bg-olive/10">
                <CheckMark />
                <span className="text-xs tracking-widest uppercase text-olive">
                  Onaylı
                </span>
              </span>
            )}
          </div>

          {/* Sayaç + +30sn */}
          <div className="mt-14 flex flex-col items-center">
            <p className="text-[11px] tracking-[0.4em] uppercase text-ivory/40 mb-3">
              {isScheduled ? "Başlangıca" : "Kalan Süre"}
            </p>
            <div
              className={`font-display text-7xl leading-none tabular-nums transition-colors ${
                closed
                  ? "text-ivory/30"
                  : lowTime
                    ? "text-burgundy"
                    : "text-ivory"
              }`}
            >
              {formatTimer(
                isScheduled
                  ? Math.max(
                      0,
                      Math.floor(
                        (new Date(showcase.starts_at).getTime() - now) / 1000,
                      ),
                    )
                  : remainingSec,
              )}
            </div>
            {isLive && (
              <button
                type="button"
                onClick={() => callAction("extend", { seconds: 30 })}
                disabled={actionPending !== null}
                className="mt-6 text-xs tracking-[0.3em] uppercase text-brass-dark hover:text-brass border-b border-brass/40 pb-0.5 disabled:opacity-30"
              >
                {actionPending === "extend" ? "..." : "+ 30 Saniye Ekle"}
              </button>
            )}
          </div>

          {/* SATTIM bölümü */}
          <div className="mt-14 w-full max-w-2xl">
            {closed ? (
              <div className="border border-burgundy/50 bg-burgundy/10 px-8 py-6 text-center">
                <p className="text-[11px] tracking-[0.3em] uppercase text-burgundy mb-2">
                  Müzayede Kapandı
                </p>
                <p className="text-2xl font-display">
                  Son fiyat: {formatUsd(state.currentPrice)}
                </p>
                {highestBid && (
                  <p className="mt-2 text-base text-ivory/60">
                    Kazanan: {highestBid.bidder_alias}
                  </p>
                )}
                <p className="mt-3 text-xs text-ivory/40">
                  Güvenli Kasa süreci tetiklendi — alıcı ödeme adımına
                  yönlendirildi.
                </p>
              </div>
            ) : isScheduled ? (
              <div className="border border-ivory/15 bg-ivory/5 px-8 py-6 text-center">
                <p className="text-[11px] tracking-[0.3em] uppercase text-ivory/40 mb-2">
                  Müzayede henüz başlamadı
                </p>
                <p className="text-sm text-ivory/60 leading-relaxed">
                  Başlangıç:{" "}
                  {new Date(showcase.starts_at).toLocaleString("tr-TR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            ) : confirmingSell ? (
              <div className="border border-burgundy/40 bg-burgundy/5 px-8 py-6 flex items-center justify-between gap-6 flex-wrap">
                <p className="text-base text-ivory/90 flex-1 min-w-[260px]">
                  Müzayedeyi{" "}
                  <strong className="text-burgundy">
                    {formatUsd(state.currentPrice)}
                  </strong>{" "}
                  fiyatıyla{" "}
                  <strong>{highestBid?.bidder_alias ?? "—"}</strong> hesabına
                  kesinleştir?
                </p>
                <div className="flex items-center gap-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingSell(false);
                      setActionError(null);
                    }}
                    disabled={actionPending === "sell"}
                    className="text-xs tracking-[0.3em] uppercase text-ivory/60 hover:text-ivory"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={() => callAction("sell", null)}
                    disabled={actionPending === "sell"}
                    className="bg-burgundy text-ivory px-8 py-3 text-sm tracking-[0.3em] uppercase hover:bg-burgundy/90 disabled:opacity-50"
                  >
                    {actionPending === "sell" ? "..." : "Onayla"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingSell(true)}
                disabled={!highestBid}
                className="w-full bg-burgundy hover:bg-burgundy/90 disabled:opacity-30 disabled:cursor-not-allowed text-ivory py-8 text-3xl tracking-[0.25em] uppercase font-display transition-colors border-2 border-burgundy"
              >
                SATTIM! — Müzayedeyi Bitir
              </button>
            )}

            {actionError && (
              <p className="mt-4 text-sm text-burgundy border-l-2 border-burgundy pl-3 leading-relaxed">
                {actionError}
              </p>
            )}
          </div>
        </section>

        {/* SAĞ — Son tekliflerin log feed'i */}
        <aside className="border-t lg:border-t-0 lg:border-l border-ivory/10 bg-black/30 px-8 py-10 flex flex-col">
          <p className="text-[11px] tracking-[0.4em] uppercase text-ivory/40 mb-6">
            Son Teklifler
          </p>
          <ul className="space-y-3">
            {bids.slice(0, 5).map((b, idx) => (
              <BidLogRow key={b.id} bid={b} isLatest={idx === 0} />
            ))}
            {bids.length === 0 && (
              <li className="text-ivory/40 text-sm">Henüz teklif yok</li>
            )}
          </ul>

          <div className="mt-auto pt-8 border-t border-ivory/10 text-[10px] tracking-[0.3em] uppercase text-ivory/30">
            <p>Müzayede ID: {showcase.auction_id.slice(0, 8)}</p>
            <p className="mt-1">
              Halka açık sayfa: /auctions/{showcase.auction_id.slice(0, 8)}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "olive" | "burgundy" | "muted";
}) {
  const valueCls =
    tone === "olive"
      ? "text-olive"
      : tone === "burgundy"
        ? "text-burgundy"
        : tone === "muted"
          ? "text-ivory/40"
          : "text-ivory";
  return (
    <div className="text-right">
      <p className="text-[10px] tracking-[0.3em] uppercase text-ivory/40">
        {label}
      </p>
      <p className={`text-lg font-medium ${valueCls}`}>{value}</p>
    </div>
  );
}

function BidLogRow({ bid, isLatest }: { bid: BidPublic; isLatest: boolean }) {
  return (
    <li
      className={`flex items-center justify-between gap-3 px-3 py-3 border ${
        isLatest
          ? "border-brass/40 bg-brass/5"
          : "border-ivory/10 bg-transparent"
      }`}
    >
      <div className="min-w-0">
        <span className="text-sm text-ivory tabular-nums truncate block">
          {bid.bidder_alias}
        </span>
        <p className="text-[10px] tracking-widest uppercase text-ivory/30 mt-1 tabular-nums">
          {new Date(bid.placed_at).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
      </div>
      <span className="font-display text-xl tabular-nums text-brass shrink-0">
        {formatUsd(bid.amount)}
      </span>
    </li>
  );
}

function formatUsd(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatTimer(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const ss = (sec % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function CheckMark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="text-olive"
    >
      <path
        d="M3 8.5L6.5 12L13 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
