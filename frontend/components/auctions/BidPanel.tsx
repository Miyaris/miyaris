"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { formatTRY } from "@/lib/format";

interface Props {
  auctionId: string;
  currentPrice: string;
  minBidIncrement: string;
  /** Sayfayı render eden Server Component'ten geliyor — yoksa giriş yapmamış demek */
  isAuthenticated: boolean;
  /** Açık artırma teklif kabul ediyor mu? (status === 'live') */
  acceptsBids: boolean;
}

export function BidPanel({
  auctionId,
  currentPrice,
  minBidIncrement,
  isAuthenticated,
  acceptsBids,
}: Props) {
  const router = useRouter();
  const minBid = (
    parseFloat(currentPrice) + parseFloat(minBidIncrement)
  ).toFixed(2);
  const [amount, setAmount] = useState(minBid);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/auctions/${auctionId}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Teklif başarısız");
        return;
      }
      router.refresh(); // sunucu state'ini yenile
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  if (!acceptsBids) {
    return (
      <div className="border border-line p-8 bg-ivory-50">
        <PriceDisplay
          label="Mevcut Fiyat"
          amount={currentPrice}
          size="lg"
          emphasize
        />
        <p className="mt-6 text-sm text-charcoal-500">
          Bu açık artırma şu anda teklif kabul etmiyor.
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="border border-line p-8 bg-ivory-50">
        <PriceDisplay
          label="Mevcut Fiyat"
          amount={currentPrice}
          size="lg"
          emphasize
        />
        <p className="mt-6 text-sm text-charcoal-500">
          Teklif vermek için giriş yapmanız gerekiyor.
        </p>
        <a
          href={`/login?next=/auctions/${auctionId}`}
          className="mt-4 inline-block text-sm tracking-widest uppercase border-b border-charcoal pb-1 hover:text-brass hover:border-brass transition-colors"
        >
          Giriş yap
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-line p-8 bg-ivory-50 space-y-6"
    >
      <PriceDisplay
        label="Mevcut Fiyat"
        amount={currentPrice}
        size="lg"
        emphasize
      />

      <div>
        <Input
          label="Teklifiniz (USD)"
          type="number"
          inputMode="decimal"
          step="1"
          min={minBid}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          hint={`Minimum teklif: ${formatTRY(minBid)} (artış: ${formatTRY(minBidIncrement)})`}
          error={error ?? undefined}
        />
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Gönderiliyor..." : "Teklif Ver"}
      </Button>

      <p className="text-xs text-charcoal-300 leading-relaxed">
        Teklif verdiğinizde Miyaris Kullanım Koşullarını kabul etmiş olursunuz.
        Son 5 dakikada gelen teklifler süreyi 5 dakika daha uzatır.
      </p>
    </form>
  );
}
