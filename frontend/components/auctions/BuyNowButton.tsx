"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DeliveryMethodPicker } from "@/components/account/DeliveryMethodPicker";
import {
  InvoiceSummary,
  PaymentMethodPicker,
} from "@/components/account/PaymentMethodPicker";
import { Button } from "@/components/ui/Button";
import { formatUSD } from "@/lib/format";
import { EFT_DISCOUNT_RATE } from "@/lib/types";
import type { DeliveryMethod, PaymentMethod } from "@/lib/types";

interface Props {
  auctionId: string;
  buyItNowPrice: string;
  isAuthenticated: boolean;
  available: boolean;
}

export function BuyNowButton({
  auctionId,
  buyItNowPrice,
  isAuthenticated,
  available,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryMethod | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!available) return null;

  if (!isAuthenticated) {
    return (
      <div className="border border-line p-6 bg-ivory-50">
        <span className="eyebrow text-brass-dark mb-1 block">Hemen Al</span>
        <div className="font-display text-2xl mb-2 tabular-nums">
          {formatUSD(buyItNowPrice)}
        </div>
        <a
          href={`/login?next=/auctions/${auctionId}`}
          className="text-sm tracking-widest uppercase border-b border-charcoal pb-0.5 hover:text-brass hover:border-brass transition-colors"
        >
          Giriş yap → satın al
        </a>
      </div>
    );
  }

  const base = parseFloat(buyItNowPrice);
  const discount = payment === "bank_transfer" ? base * EFT_DISCOUNT_RATE : 0;
  const canSubmit = delivery !== null && payment !== null && !pending;

  async function buy() {
    if (!delivery || !payment) {
      setError("Teslimat ve ödeme yöntemini seçin");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/auctions/${auctionId}/buy-now`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_method: delivery,
          payment_method: payment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Satın alma başarısız");
        return;
      }
      router.push("/account/orders");
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  // Compact (collapsed) state — bir tıkla yükle expanded checkout açılır
  if (!expanded) {
    return (
      <div className="border-2 border-brass bg-brass/5 p-6">
        <div className="flex items-baseline justify-between mb-4">
          <span className="eyebrow text-brass-dark">Hemen Al</span>
          <span className="text-[10px] tracking-widest uppercase text-charcoal-300">
            Müzayedeyi beklemeden
          </span>
        </div>
        <div className="font-display text-3xl mb-4 tabular-nums">
          {formatUSD(buyItNowPrice)}
        </div>
        <Button
          onClick={() => setExpanded(true)}
          size="lg"
          className="w-full !bg-brass hover:!bg-brass-dark"
        >
          {formatUSD(buyItNowPrice)} — Satın Almaya Devam
        </Button>
        <p className="text-xs text-charcoal-300 mt-3 leading-relaxed">
          %100 güvenli emanet ödemesi. Sigortalı kasada saklanır.
        </p>
      </div>
    );
  }

  return (
    <div className="border-2 border-brass bg-brass/5 p-6 space-y-6">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow text-brass-dark">Hemen Al — Checkout</span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs tracking-widest uppercase text-charcoal-300 hover:text-charcoal"
        >
          İptal
        </button>
      </div>

      <DeliveryMethodPicker
        value={delivery}
        onChange={setDelivery}
        disabled={pending}
      />

      <PaymentMethodPicker
        value={payment}
        onChange={setPayment}
        listedPrice={buyItNowPrice}
        disabled={pending}
      />

      <div>
        <span className="eyebrow mb-3 block">Sipariş Özeti</span>
        <InvoiceSummary
          listedPrice={buyItNowPrice}
          discountAmount={discount}
          paymentMethod={payment}
        />
      </div>

      {error && (
        <div className="text-sm text-burgundy border-l-2 border-burgundy pl-3">
          {error}
        </div>
      )}

      <Button
        onClick={buy}
        disabled={!canSubmit}
        size="lg"
        className="w-full !bg-brass hover:!bg-brass-dark"
      >
        {pending
          ? "İşleniyor..."
          : payment === "bank_transfer"
            ? "EFT ile Satın Al — İndirimle"
            : payment === "credit_card"
              ? "Kredi Kartı ile Satın Al"
              : "Önce ödeme yöntemini seçin"}
      </Button>
      <p className="text-xs text-charcoal-300 leading-relaxed">
        %100 güvenli emanet ödemesi. Saat doğrulanana kadar paranız bloke
        edilir; sigortalı kasada muhafaza edilir.
      </p>
    </div>
  );
}
