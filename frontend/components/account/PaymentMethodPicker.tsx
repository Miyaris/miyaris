"use client";

import { formatUSD } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";
import { EFT_DISCOUNT_RATE } from "@/lib/types";

interface Props {
  value: PaymentMethod | null;
  onChange: (m: PaymentMethod) => void;
  /** Standart (kredi kartı) fiyat — EFT indirim hesabı için referans */
  listedPrice: string | number;
  disabled?: boolean;
}

export function PaymentMethodPicker({
  value,
  onChange,
  listedPrice,
  disabled,
}: Props) {
  const base = typeof listedPrice === "string" ? parseFloat(listedPrice) : listedPrice;
  const discountAmount = base * EFT_DISCOUNT_RATE;
  const eftTotal = base - discountAmount;

  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="eyebrow mb-2">Ödeme Yöntemi</legend>

      {/* CREDIT CARD */}
      <label
        className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
          value === "credit_card"
            ? "border-charcoal bg-ivory"
            : "border-line hover:border-charcoal-300"
        }`}
      >
        <input
          type="radio"
          name="payment_method"
          value="credit_card"
          checked={value === "credit_card"}
          onChange={(e) => onChange(e.target.value as PaymentMethod)}
          className="mt-1 accent-charcoal"
        />
        <div className="flex-1">
          <div className="flex justify-between items-baseline">
            <div className="text-sm font-medium">Kredi Kartı ile Ödeme</div>
            <div className="font-medium tabular-nums">
              {formatUSD(base)}
            </div>
          </div>
          <div className="text-xs text-charcoal-300 mt-0.5">
            Ekstra ücret yok — standart fiyat.
          </div>
        </div>
      </label>

      {/* BANK TRANSFER — %2.5 EFT discount */}
      <label
        className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
          value === "bank_transfer"
            ? "border-olive bg-olive/5"
            : "border-line hover:border-olive/50"
        }`}
      >
        <input
          type="radio"
          name="payment_method"
          value="bank_transfer"
          checked={value === "bank_transfer"}
          onChange={(e) => onChange(e.target.value as PaymentMethod)}
          className="mt-1 accent-olive"
        />
        <div className="flex-1">
          <div className="flex justify-between items-baseline gap-3">
            <div className="text-sm font-medium">
              VIP Banka Transferi (EFT/Havale)
            </div>
            <div className="text-right">
              <div className="font-medium tabular-nums text-olive">
                {formatUSD(eftTotal)}
              </div>
              <div className="text-[10px] tracking-widest uppercase text-olive">
                −%2.5 Özel Havale İndirimi
              </div>
            </div>
          </div>
          <div className="text-xs text-charcoal-500 mt-1 leading-relaxed">
            Banka transferiyle ödeme yaparak{" "}
            <strong className="text-olive">
              {formatUSD(discountAmount)}
            </strong>{" "}
            anında tasarruf edin. IBAN bilgileri sipariş oluştuktan sonra
            iletilir.
          </div>
        </div>
      </label>
    </fieldset>
  );
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  credit_card: "Kredi Kartı",
  bank_transfer: "Banka Transferi (EFT)",
};

/** Sipariş özetinde Standart Fiyat / EFT İndirimi / Toplam satırlarını
 *  gösteren mini fatura componenti. */
export function InvoiceSummary({
  listedPrice,
  discountAmount,
  paymentMethod,
}: {
  listedPrice: string | number;
  discountAmount: string | number;
  paymentMethod: PaymentMethod | null;
}) {
  const base =
    typeof listedPrice === "string" ? parseFloat(listedPrice) : listedPrice;
  const disc =
    typeof discountAmount === "string"
      ? parseFloat(discountAmount)
      : discountAmount;
  const total = base - disc;
  const hasDiscount = disc > 0;

  return (
    <dl className="border-y border-line divide-y divide-line">
      <div className="flex justify-between py-3 text-sm">
        <dt className="text-charcoal-300 tracking-wide">Standart Fiyat</dt>
        <dd className="text-charcoal-700 font-medium tabular-nums">
          {formatUSD(base)}
        </dd>
      </div>
      {hasDiscount && (
        <div className="flex justify-between py-3 text-sm">
          <dt className="text-olive tracking-wide">
            −%2.5 Özel Havale İndirimi
          </dt>
          <dd className="text-olive font-medium tabular-nums">
            −{formatUSD(disc)}
          </dd>
        </div>
      )}
      <div className="flex justify-between py-3 text-sm">
        <dt className="text-charcoal-700 font-medium tracking-wide">
          Toplam {paymentMethod === "bank_transfer" ? "(EFT)" : "(Kredi Kartı)"}
        </dt>
        <dd className="text-charcoal font-display tabular-nums text-base">
          {formatUSD(total)}
        </dd>
      </div>
    </dl>
  );
}
