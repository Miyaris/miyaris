"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DeliveryMethodPicker } from "@/components/account/DeliveryMethodPicker";
import {
  InvoiceSummary,
  PaymentMethodPicker,
} from "@/components/account/PaymentMethodPicker";
import { Button } from "@/components/ui/Button";
import { EFT_DISCOUNT_RATE } from "@/lib/types";
import type { DeliveryMethod, PaymentMethod } from "@/lib/types";

interface Props {
  escrowId: string;
  amount: string;
}

/**
 * Auction kazananı ödemesini bu component üzerinden tamamlar.
 *
 * 3 seçim aşamalı tek form'da:
 *   - Teslimat yöntemi (Kargo / Mağaza)
 *   - Ödeme yöntemi (Kredi Kartı / Banka Transferi — EFT seçilirse %2.5 indirim)
 *   - Mini fatura özeti (canlı indirim hesabıyla)
 *   - Ödeme onayı
 */
export function FundButton({ escrowId, amount }: Props) {
  const router = useRouter();
  const [delivery, setDelivery] = useState<DeliveryMethod | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = parseFloat(amount);
  const discount = payment === "bank_transfer" ? base * EFT_DISCOUNT_RATE : 0;

  const canSubmit = delivery !== null && payment !== null && !pending;

  async function pay() {
    if (!delivery || !payment) {
      setError("Teslimat ve ödeme yöntemini seçin");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${escrowId}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_method: delivery,
          payment_method: payment,
          payment_provider_ref: "demo-mock",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Ödeme başarısız");
        return;
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border border-line bg-ivory-50 p-6 space-y-6">
      <div>
        <span className="eyebrow text-brass-dark mb-2 block">
          Ödeme Bekleniyor
        </span>
        <p className="text-sm text-charcoal-700 leading-relaxed">
          Müzayedeyi kazandınız veya Hemen Al ile satın aldınız. Teslimat ve
          ödeme yöntemini seçtikten sonra ödeme tamamlanır. Para, saatin
          Miyaris sigortalı kasasına ulaşıp doğrulanana kadar emanet hesabında
          bloke edilir.
        </p>
      </div>

      <DeliveryMethodPicker
        value={delivery}
        onChange={setDelivery}
        disabled={pending}
      />

      <PaymentMethodPicker
        value={payment}
        onChange={setPayment}
        listedPrice={amount}
        disabled={pending}
      />

      <div className="border-t border-line pt-4">
        <span className="eyebrow mb-3 block">Sipariş Özeti</span>
        <InvoiceSummary
          listedPrice={amount}
          discountAmount={discount}
          paymentMethod={payment}
        />
      </div>

      {error && (
        <div className="text-sm text-burgundy border-l-2 border-burgundy pl-3">
          {error}
        </div>
      )}

      <Button onClick={pay} disabled={!canSubmit} size="lg" className="w-full">
        {pending
          ? "İşleniyor..."
          : payment === "bank_transfer"
            ? "EFT ile Öde — İndirimle"
            : payment === "credit_card"
              ? "Kredi Kartı ile Öde"
              : "Önce ödeme yöntemini seçin"}
      </Button>
      <p className="text-xs text-charcoal-300 leading-relaxed">
        ⓘ Demo modunda gerçek ödeme alınmaz. Production'da kredi kartı için
        iyzico üzerinden, EFT için IBAN bilgileri ile devam edilir.
      </p>
    </div>
  );
}
