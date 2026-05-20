"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  formatDateTR,
  formatUSD,
  nextMondayDate,
  nextSundayEndDate,
} from "@/lib/format";

interface Props {
  watchId: string;
  valuationMin: string | null;
  valuationMax: string | null;
}

export function AuctionForm({ watchId, valuationMin, valuationMax }: Props) {
  const router = useRouter();

  const [startingPrice, setStartingPrice] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [buyItNowPrice, setBuyItNowPrice] = useState("");
  const [minBidIncrement, setMinBidIncrement] = useState("50");
  const [confirmed, setConfirmed] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Sistem tarafından otomatik atanan haftalık pencere — kullanıcı seçemez
  const monday = nextMondayDate();
  const sunday = nextSundayEndDate();

  function applyValuationSuggestion() {
    if (valuationMin && valuationMax) {
      const min = parseFloat(valuationMin);
      const max = parseFloat(valuationMax);
      // Lüks açık artırma akıllı default'u:
      //  starting = AI alt sınırının %85'i (düşük başlangıç ilgi çeker)
      //  reserve  = AI alt sınırı (gerçek tabanı korur)
      //  buy_now  = AI üst sınırının %110'u (üst sınırı geçen anında satın alma)
      setStartingPrice(Math.round((min * 0.85) / 10) * 10 + "");
      setReservePrice(Math.round(min / 10) * 10 + "");
      setBuyItNowPrice(Math.round((max * 1.1) / 10) * 10 + "");
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!confirmed) {
      setError("Önümüzdeki haftanın müzayedesine katılım onayı zorunlu");
      return;
    }

    const startNum = parseFloat(startingPrice);
    if (!startNum || startNum <= 0) {
      setError("Başlangıç fiyatı zorunlu");
      return;
    }
    if (reservePrice && parseFloat(reservePrice) < startNum) {
      setError("Rezerv fiyatı, başlangıç fiyatından küçük olamaz");
      return;
    }
    if (buyItNowPrice && parseFloat(buyItNowPrice) <= startNum) {
      setError("'Hemen Al' fiyatı başlangıç fiyatından büyük olmalı");
      return;
    }

    setPending(true);
    try {
      const payload = {
        watch_id: watchId,
        starting_price: startingPrice,
        reserve_price: reservePrice || null,
        buy_it_now_price: buyItNowPrice || null,
        min_bid_increment: minBidIncrement || "50",
      };

      const res = await fetch("/api/auctions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Müzayede oluşturulamadı");
        return;
      }
      router.push(`/auctions/${data.id}`);
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  const hasValuation = valuationMin && valuationMax;

  return (
    <form onSubmit={onSubmit} className="space-y-10">
      {/* Haftalık müzayede penceresi — kullanıcı seçemez, bilgi olarak gösterilir */}
      <div className="border border-line bg-ivory-50 p-6">
        <span className="eyebrow text-brass-dark mb-3 block">
          Haftalık Müzayede Takvimi
        </span>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-charcoal-500">Başlangıç</span>
            <span className="font-medium tabular-nums">
              {formatDateTR(monday)} · 00:00
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-charcoal-500">Bitiş</span>
            <span className="font-medium tabular-nums">
              {formatDateTR(sunday)} · 23:59
            </span>
          </div>
        </div>
        <p className="text-xs text-charcoal-300 mt-4 leading-relaxed">
          Tüm Miyaris müzayedeleri haftalıktır — Pazartesi 00:00 başlar,
          Pazar 23:59 sona erer. Tarih seçimi yoktur, saatiniz onaylandıktan
          sonra otomatik olarak bir sonraki haftanın müzayedesine yerleştirilir.
        </p>
      </div>

      {hasValuation && (
        <div className="border border-line bg-ivory-50 p-6">
          <span className="eyebrow text-brass-dark mb-2 block">
            Miyaris AI Değerlemesi
          </span>
          <div className="font-display text-2xl tabular-nums mb-3">
            {formatUSD(valuationMin)}
            <span className="text-charcoal-300 mx-2">—</span>
            {formatUSD(valuationMax)}
          </div>
          <button
            type="button"
            onClick={applyValuationSuggestion}
            className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-brass border-b border-current pb-0.5"
          >
            AI önerisini kullan
          </button>
        </div>
      )}

      <div className="space-y-6">
        <Input
          label="Başlangıç Fiyatı (USD)"
          type="number"
          inputMode="decimal"
          step="1"
          min={1}
          value={startingPrice}
          onChange={(e) => setStartingPrice(e.target.value)}
          placeholder="8500"
          required
          hint="Haftalık müzayede bu fiyattan başlar"
        />

        <Input
          label="Rezerv Fiyatı (USD, opsiyonel)"
          type="number"
          inputMode="decimal"
          step="1"
          min={1}
          value={reservePrice}
          onChange={(e) => setReservePrice(e.target.value)}
          placeholder="9500"
          hint="Bu fiyatın altında satış olmaz — alıcılara gizli"
        />

        <Input
          label="Hemen Al Fiyatı (USD, opsiyonel)"
          type="number"
          inputMode="decimal"
          step="1"
          min={1}
          value={buyItNowPrice}
          onChange={(e) => setBuyItNowPrice(e.target.value)}
          placeholder="14000"
          hint="Set ederseniz alıcılar müzayede bitmeden anında satın alabilir"
        />

        <Input
          label="Minimum Artış (USD)"
          type="number"
          inputMode="decimal"
          step="10"
          min={10}
          value={minBidIncrement}
          onChange={(e) => setMinBidIncrement(e.target.value)}
          hint="Her teklif önceki tekliften en az bu kadar fazla olmalı"
        />
      </div>

      <div className="border-t border-line pt-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 w-4 h-4 accent-charcoal"
          />
          <div>
            <span className="block text-sm font-medium">
              Önümüzdeki haftanın müzayedesine katıl
            </span>
            <span className="block text-xs text-charcoal-300 mt-0.5">
              Saatiniz {formatDateTR(monday)} 00:00'da yayına çıkacak ve{" "}
              {formatDateTR(sunday)} 23:59'da kapanacak. Anti-sniping kuralı
              gereği son 5 dakikadaki teklifler süreyi 5 dakika uzatır.
            </span>
          </div>
        </label>
      </div>

      {error && (
        <div className="text-sm text-burgundy border-l-2 border-burgundy pl-3">
          {error}
        </div>
      )}

      <div className="border-t border-line pt-8">
        <Button
          type="submit"
          size="lg"
          disabled={pending || !confirmed}
          className="w-full"
        >
          {pending ? "Yayınlanıyor..." : "Müzayedeyi Yayınla"}
        </Button>
      </div>
    </form>
  );
}
