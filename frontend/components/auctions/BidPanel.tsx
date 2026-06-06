"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { formatTRY } from "@/lib/format";
import type { DepositStatus } from "@/lib/types";

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

  // Kapora durumu — yalnızca giriş yapmış ve teklif kabul eden müzayedelerde çek
  const [deposit, setDeposit] = useState<DepositStatus | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositPaying, setDepositPaying] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !acceptsBids) return;
    let cancelled = false;
    (async () => {
      setDepositLoading(true);
      try {
        const res = await fetch(`/api/auctions/${auctionId}/my-deposit`);
        if (!res.ok) return;
        const data = (await res.json()) as DepositStatus;
        if (!cancelled) setDeposit(data);
      } catch {
        /* sessizce yut — deposit durumu kritik değil, post anında zaten check edilir */
      } finally {
        if (!cancelled) setDepositLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auctionId, isAuthenticated, acceptsBids]);

  async function payDeposit() {
    setDepositError(null);
    setDepositPaying(true);
    try {
      const res = await fetch(`/api/auctions/${auctionId}/deposit`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setDepositError(data.detail ?? "Kapora alınamadı");
        return;
      }
      setDeposit(data as DepositStatus);
      setShowDepositModal(false);
    } catch {
      setDepositError("Bağlantı hatası");
    } finally {
      setDepositPaying(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Önce kapora kontrolü — ödenmemişse modali aç, request'i hiç yollamayım
    if (deposit && !deposit.deposit_paid) {
      setShowDepositModal(true);
      return;
    }

    setPending(true);
    try {
      const res = await fetch(`/api/auctions/${auctionId}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Backend defense-in-depth — fonksiyon başında check yaptık ama yine 403
        // gelirse (yarış durumu) modali aç
        if (
          res.status === 403 &&
          typeof data.detail === "string" &&
          data.detail.toLowerCase().includes("kapora")
        ) {
          setShowDepositModal(true);
        } else {
          setError(data.detail ?? "Teklif başarısız");
        }
        return;
      }
      router.refresh();
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

  const depositNeeded = deposit && !deposit.deposit_paid;

  return (
    <>
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

        {/* Kapora durumu rozeti — ödendiyse yeşil, ödenmediyse uyarı */}
        {!depositLoading && deposit && (
          <div
            className={`text-xs tracking-widest uppercase inline-flex items-center gap-2 border px-3 py-1.5 ${
              deposit.deposit_paid
                ? "border-olive/40 bg-olive/5 text-olive"
                : "border-brass/40 bg-brass/5 text-brass-dark"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                deposit.deposit_paid ? "bg-olive" : "bg-brass"
              }`}
            />
            {deposit.deposit_paid
              ? "Kapora Onaylı"
              : `${Math.round(Number(deposit.required_deposit_amount))} TL Kapora Gerekli`}
          </div>
        )}

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
          {pending
            ? "Gönderiliyor..."
            : depositNeeded
              ? "Kapora Yatır + Teklif Ver"
              : "Teklif Ver"}
        </Button>

        <p className="text-xs text-charcoal-300 leading-relaxed">
          Teklif verdiğinizde Miyaris Kullanım Koşullarını kabul etmiş olursunuz.
          Son 5 dakikada gelen teklifler süreyi 5 dakika daha uzatır.
        </p>
      </form>

      {/* Deposit modal */}
      {showDepositModal && deposit && (
        <DepositModal
          requiredAmount={deposit.required_deposit_amount}
          pending={depositPaying}
          error={depositError}
          onCancel={() => {
            setShowDepositModal(false);
            setDepositError(null);
          }}
          onConfirm={payDeposit}
        />
      )}
    </>
  );
}

function DepositModal({
  requiredAmount,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  requiredAmount: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const amountStr = `${Math.round(Number(requiredAmount))} TL`;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-ivory border border-line max-w-lg w-full p-8 shadow-xl"
      >
        <p className="eyebrow text-brass-dark mb-4">Müzayedeye Katılım</p>
        <h2 className="font-display text-3xl text-charcoal mb-6 leading-tight">
          {amountStr} Kapora Provizyonu
        </h2>

        <div className="space-y-4 text-sm leading-relaxed text-charcoal-700 mb-8">
          <p>
            Bu müzayedede teklif verebilmek için kartınızdan{" "}
            <strong className="text-charcoal">{amountStr}</strong> tutarında
            <strong className="text-charcoal"> kapora provizyonu (bloke)</strong>{" "}
            alınacaktır.
          </p>
          <ul className="space-y-2 pl-5 list-disc marker:text-brass-dark/60">
            <li>İhaleyi kazanamazsanız bu bloke anında kaldırılır.</li>
            <li>Kazanır ve satışı tamamlarsanız da bloke kaldırılır.</li>
            <li>
              <strong className="text-burgundy">
                Kazanır ama ödemeyi yapmazsanız kapora iade edilmez.
              </strong>
            </li>
          </ul>
          <div className="border-l-2 border-brass/40 bg-brass/5 px-4 py-3 mt-4">
            <p className="text-xs text-charcoal-500">
              <strong className="text-brass-dark">MVP notu:</strong> Şu an
              gerçek POS entegrasyonu (iyzico/PayTR) yerine{" "}
              <strong>mock akış</strong> kullanılıyor. Onayladığınızda kart
              talep edilmeden kapora kayıt altına alınır. Production'da 3D
              Secure ile gerçek provizyon alınacak.
            </p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-burgundy border-l-2 border-burgundy pl-3 mb-6">
            {error}
          </p>
        )}

        <div className="flex items-center gap-4 justify-end pt-4 border-t border-line">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-charcoal"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="bg-charcoal text-ivory px-8 py-3 text-xs tracking-widest uppercase hover:bg-charcoal-700 transition-colors disabled:opacity-50"
          >
            {pending ? "İşleniyor..." : `Kaporayı Yatır (${amountStr})`}
          </button>
        </div>
      </div>
    </div>
  );
}
