"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Canlı Müzayede Sunucu Paneli (Presenter Dashboard) — uzaktan okunabilir UI.
 *
 * Tasarım kararları:
 *  - Tam ekran, dark palette (charcoal) — sahnede projektörden veya
 *    monitörden 3-4 metre uzaktan rahat okunsun.
 *  - Mevcut En Yüksek Teklif: ekranın yatay merkezinde `text-9xl` (~128px),
 *    tabular-nums + altın renkli.
 *  - Onaylı Teklif Veren: alias + yeşil onay rozeti (KYC/teminat
 *    gösterimi); presenter "bu kişiden teklif alabilirim" sezgisini
 *    bir bakışta okur.
 *  - Geri sayım: MM:SS formatlı, son 30sn'de kırmızıya döner.
 *  - "+30 Saniye Ekle" — sahnede tekliflerin yığıldığı an yetki kullanır.
 *  - "SATTIM!" — devasa kırmızı buton (CTA gibi değil, decisive action),
 *    iki adımlı confirm (yanlışlıkla basmayı engeller).
 *  - Sağda: son 5 teklif aktığı log feed (yeni teklif üstte fade-in).
 *
 * MVP: WebSocket YOK — veriler local state. "Yeni Teklif Simüle Et" butonu
 * test için. Production'da bu state useAuctionStream + REST POST aksiyonlar
 * ile değiştirilecek. Yapısal değişiklik gerekmez, state shape aynı kalır.
 */

interface BidLogEntry {
  id: string;
  bidder_alias: string;
  amount: number;
  placed_at: Date;
  /** Bu teklif sahibi için yeşil onay rozeti — KYC veya teminat onaylı mı */
  approved: boolean;
}

const INITIAL_BID = 18500;
const STARTING_TIMER_SEC = 180; // 3 dk
const TIMER_BUMP_SEC = 30;
const MIN_INCREMENT = 250;
const MAX_LOG_ITEMS = 5;

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTimer(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const ss = (sec % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function makeAlias(): string {
  // 6 karakterlik anonim alias — backend bidder_alias() ile aynı format
  const hex = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0")
    .toUpperCase();
  return `Üye #${hex}`;
}

function makeBid(prevAmount: number): BidLogEntry {
  return {
    id: crypto.randomUUID(),
    bidder_alias: makeAlias(),
    amount: prevAmount + MIN_INCREMENT,
    placed_at: new Date(),
    approved: Math.random() > 0.2,
  };
}

export function PresenterDashboard() {
  const [bids, setBids] = useState<BidLogEntry[]>(() => [
    {
      id: "seed-1",
      bidder_alias: "Üye #7C4F1A",
      amount: INITIAL_BID,
      placed_at: new Date(),
      approved: true,
    },
  ]);
  const [timerSec, setTimerSec] = useState<number>(STARTING_TIMER_SEC);
  const [ending, setEnding] = useState<"idle" | "confirm" | "sold">("idle");

  const highestBid = bids[0] ?? null;
  const totalBids = bids.length;
  const lowTime = timerSec <= 30 && ending !== "sold";

  // Geri sayım — saniye bazlı, 0'a inerse otomatik durur
  useEffect(() => {
    if (ending === "sold") return;
    if (timerSec <= 0) return;
    const tick = setTimeout(() => setTimerSec((s) => s - 1), 1000);
    return () => clearTimeout(tick);
  }, [timerSec, ending]);

  function addThirty() {
    setTimerSec((s) => s + TIMER_BUMP_SEC);
  }

  function simulateBid() {
    if (ending === "sold") return;
    setBids((prev) => {
      const next = makeBid(prev[0]?.amount ?? INITIAL_BID);
      return [next, ...prev].slice(0, 20);
    });
    // Anti-sniping: son 30sn'de teklif gelirse +30 ekle
    if (timerSec < 30) addThirty();
  }

  function startEnd() {
    setEnding("confirm");
  }
  function cancelEnd() {
    setEnding("idle");
  }
  function confirmEnd() {
    setEnding("sold");
  }

  // Onaylı satış sonrası: dashboard "kilitli" görünür ama veriyi koruyalım
  const closed = ending === "sold";

  return (
    <main className="min-h-screen bg-charcoal text-ivory flex flex-col">
      {/* Üst şerit: müzayede başlığı + bid sayacı */}
      <header className="border-b border-ivory/10 px-12 py-6 flex items-center justify-between">
        <div className="flex items-baseline gap-6">
          <p className="text-[10px] tracking-[0.3em] uppercase text-brass">
            Canlı Müzayede
          </p>
          <h1 className="font-display text-2xl">
            Rolex Submariner · Ref. 126610LN
          </h1>
        </div>
        <div className="flex items-center gap-8 tabular-nums">
          <Stat label="Toplam Teklif" value={totalBids.toString()} />
          <Stat
            label="Durum"
            value={closed ? "Satıldı" : lowTime ? "Son Saniye" : "Aktif"}
            tone={closed ? "burgundy" : lowTime ? "burgundy" : "olive"}
          />
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-0">
        {/* SOL — Devasa fiyat + sayaç + aksiyon butonları */}
        <section className="flex flex-col items-center justify-center px-12 py-16 relative">
          <p className="text-[11px] tracking-[0.4em] uppercase text-ivory/40 mb-6">
            Mevcut En Yüksek Teklif
          </p>
          <div className="font-display text-[clamp(96px,14vw,192px)] leading-none tabular-nums text-brass">
            {highestBid ? formatUsd(highestBid.amount) : "—"}
          </div>

          <div className="mt-10 flex items-center gap-4">
            <span className="text-xl text-ivory/60 tracking-wide tabular-nums">
              {highestBid?.bidder_alias ?? "—"}
            </span>
            {highestBid?.approved && (
              <span
                className="inline-flex items-center gap-2 px-3 py-1 border border-olive/40 bg-olive/10"
                aria-label="Onaylı teklif veren — provizyon doğrulandı"
              >
                <CheckMark />
                <span className="text-xs tracking-widest uppercase text-olive">
                  Onaylı
                </span>
              </span>
            )}
          </div>

          {/* Sayaç + +30sn */}
          <div className="mt-16 flex flex-col items-center">
            <p className="text-[11px] tracking-[0.4em] uppercase text-ivory/40 mb-3">
              Kalan Süre
            </p>
            <div
              className={`font-display text-7xl leading-none tabular-nums transition-colors ${
                lowTime ? "text-burgundy" : "text-ivory"
              }`}
            >
              {formatTimer(timerSec)}
            </div>
            <button
              type="button"
              onClick={addThirty}
              disabled={closed}
              className="mt-6 text-xs tracking-[0.3em] uppercase text-brass-dark hover:text-brass border-b border-brass/40 pb-0.5 disabled:opacity-30"
            >
              + 30 Saniye Ekle
            </button>
          </div>

          {/* SATTIM butonu / Confirm flow */}
          <div className="mt-16 w-full max-w-2xl">
            {closed ? (
              <div className="border border-burgundy/50 bg-burgundy/10 px-8 py-6 text-center">
                <p className="text-[11px] tracking-[0.3em] uppercase text-burgundy mb-2">
                  Müzayede Kapatıldı
                </p>
                <p className="text-2xl font-display">
                  Satış: {highestBid ? formatUsd(highestBid.amount) : "—"} ·{" "}
                  {highestBid?.bidder_alias}
                </p>
                <p className="mt-2 text-xs text-ivory/40">
                  Ödeme akışı tetiklendi — Güvenli Kasa süreci başladı.
                </p>
              </div>
            ) : ending === "confirm" ? (
              <div className="border border-burgundy/40 bg-burgundy/5 px-8 py-6 flex items-center justify-between gap-6">
                <p className="text-base text-ivory/90">
                  Müzayedeyi{" "}
                  <strong className="text-burgundy">
                    {highestBid ? formatUsd(highestBid.amount) : ""}
                  </strong>{" "}
                  fiyatıyla{" "}
                  <strong>{highestBid?.bidder_alias}</strong>{" "}
                  hesabına kesinleştir?
                </p>
                <div className="flex items-center gap-4 shrink-0">
                  <button
                    type="button"
                    onClick={cancelEnd}
                    className="text-xs tracking-[0.3em] uppercase text-ivory/60 hover:text-ivory"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={confirmEnd}
                    className="bg-burgundy text-ivory px-8 py-3 text-sm tracking-[0.3em] uppercase hover:bg-burgundy/90"
                  >
                    Onayla
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={startEnd}
                disabled={!highestBid}
                className="w-full bg-burgundy hover:bg-burgundy/90 disabled:opacity-30 text-ivory py-8 text-3xl tracking-[0.25em] uppercase font-display transition-colors border-2 border-burgundy"
              >
                SATTIM! — Müzayedeyi Bitir
              </button>
            )}
          </div>

          {/* Test simülasyon — production'da WS'ten gelecek */}
          {!closed && (
            <button
              type="button"
              onClick={simulateBid}
              className="absolute bottom-6 right-6 text-[10px] tracking-[0.3em] uppercase text-ivory/30 hover:text-ivory/60 border-b border-ivory/20 pb-0.5"
            >
              [Test] Yeni Teklif Simüle Et
            </button>
          )}
        </section>

        {/* SAĞ — Son tekliflerin log feed'i */}
        <aside className="border-t lg:border-t-0 lg:border-l border-ivory/10 bg-black/30 px-8 py-10 flex flex-col">
          <p className="text-[11px] tracking-[0.4em] uppercase text-ivory/40 mb-6">
            Son Teklifler
          </p>
          <ul className="space-y-3">
            {bids.slice(0, MAX_LOG_ITEMS).map((b, idx) => (
              <BidLogRow key={b.id} bid={b} isLatest={idx === 0} />
            ))}
            {bids.length === 0 && (
              <li className="text-ivory/40 text-sm">Henüz teklif yok</li>
            )}
          </ul>

          <div className="mt-auto pt-8 border-t border-ivory/10 text-[10px] tracking-[0.3em] uppercase text-ivory/30">
            <p>Veri Akışı: Yerel Simülasyon</p>
            <p className="mt-1">Canlı WebSocket entegrasyonu sonraki fazda</p>
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
  tone?: "default" | "olive" | "burgundy";
}) {
  const valueCls =
    tone === "olive"
      ? "text-olive"
      : tone === "burgundy"
        ? "text-burgundy"
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

function BidLogRow({ bid, isLatest }: { bid: BidLogEntry; isLatest: boolean }) {
  return (
    <li
      className={`flex items-center justify-between gap-3 px-3 py-3 border ${
        isLatest
          ? "border-brass/40 bg-brass/5"
          : "border-ivory/10 bg-transparent"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-ivory tabular-nums truncate">
            {bid.bidder_alias}
          </span>
          {bid.approved && <DotApproved />}
        </div>
        <p className="text-[10px] tracking-widest uppercase text-ivory/30 mt-1 tabular-nums">
          {bid.placed_at.toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
      </div>
      <span className="font-display text-xl tabular-nums text-brass shrink-0">
        ${bid.amount.toLocaleString("en-US")}
      </span>
    </li>
  );
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

function DotApproved() {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full bg-olive shrink-0"
      aria-label="Onaylı"
    />
  );
}
