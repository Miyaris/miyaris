"use client";

import type { DeliveryMethod } from "@/lib/types";

interface Option {
  value: DeliveryMethod;
  title: string;
  description: string;
}

const OPTIONS: Option[] = [
  {
    value: "shipping",
    title: "Sigortalı Kargo ile Teslimat",
    description:
      "Saat, Miyaris'in sigortalı kargo ortağı ile belirttiğiniz adrese güvenle gönderilir. Teslim alma anına kadar Miyaris sorumluluk üstlenir.",
  },
  {
    value: "store_pickup",
    title: "Anlaşmalı Mağazadan Teslim Al",
    description:
      "Saati fiziksel olarak inceleyip Miyaris anlaşmalı saat butiğinden teslim alın. Mağaza adresi siparişiniz oluştuktan sonra paylaşılır.",
  },
];

interface Props {
  value: DeliveryMethod | null;
  onChange: (m: DeliveryMethod) => void;
  disabled?: boolean;
}

export function DeliveryMethodPicker({ value, onChange, disabled }: Props) {
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="eyebrow mb-2">Teslimat Yöntemi</legend>
      {OPTIONS.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
              isSelected
                ? "border-charcoal bg-ivory"
                : "border-line hover:border-charcoal-300"
            }`}
          >
            <input
              type="radio"
              name="delivery_method"
              value={opt.value}
              checked={isSelected}
              onChange={(e) =>
                onChange(e.target.value as DeliveryMethod)
              }
              className="mt-1 accent-charcoal"
            />
            <div>
              <div className="text-sm font-medium">{opt.title}</div>
              <div className="text-xs text-charcoal-300 mt-0.5 leading-relaxed">
                {opt.description}
              </div>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
}

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  shipping: "Sigortalı Kargo",
  store_pickup: "Mağazadan Teslim",
};
