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
  slug: string;
  listedPrice: string;
}

interface BuyResponse {
  id: string;
}

/**
 * Miyaris Mağaza — DIRECT_SALE Satın Al butonu.
 *
 * Açılır panelde teslimat + ödeme yöntemi seçilir, EFT indirimi canlı
 * gösterilir, ardından `/api/watches/{slug}/buy` proxy'sine POST atılır.
 * Başarılı olursa kullanıcı `/account/orders/{escrowId}`'ye yönlenir.
 */
export function BuyDirectButton({ slug, listedPrice }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryMethod | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = parseFloat(listedPrice);
  const discount =
    payment === "bank_transfer" ? base * EFT_DISCOUNT_RATE : 0;

  async function submit() {
    if (!delivery || !payment) {
      setError("Teslimat ve ödeme yöntemini seçiniz");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/watches/${slug}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_method: delivery,
          payment_method: payment,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?next=/watches/${slug}`);
          return;
        }
        setError(body.detail ?? "Satın alma başarısız");
        return;
      }
      const order = body as BuyResponse;
      router.push(`/account/orders/${order.id}?just_created=1`);
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full"
        size="lg"
      >
        Hemen Satın Al
      </Button>
    );
  }

  return (
    <div className="space-y-6">
      <DeliveryMethodPicker
        value={delivery}
        onChange={setDelivery}
        disabled={pending}
      />

      <PaymentMethodPicker
        value={payment}
        onChange={setPayment}
        listedPrice={listedPrice}
        disabled={pending}
      />

      <InvoiceSummary
        listedPrice={listedPrice}
        discountAmount={discount.toFixed(2)}
        paymentMethod={payment}
      />

      {error && (
        <div className="text-sm text-burgundy border-l-2 border-burgundy pl-3">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Vazgeç
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={pending || !delivery || !payment}
          className="flex-1"
        >
          {pending ? "Sipariş Oluşturuluyor..." : "Siparişi Onayla"}
        </Button>
      </div>
    </div>
  );
}
