"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { FileUploader } from "@/components/shared/FileUploader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  TIER_1_LIMIT,
  TIER_1_RATE,
  TIER_2_LIMIT,
  TIER_2_RATE,
  TIER_3_RATE,
  computeTieredCommission,
} from "@/lib/commission";
import { formatUSD } from "@/lib/format";
import type { ListingType, WatchCondition } from "@/lib/types";
import { WATCH_CATALOG, modelsForBrand } from "@/lib/watchCatalog";

interface FormState {
  listing_type: ListingType;
  asking_price: string;
  brand: string;
  model: string;
  reference_number: string;
  year: string;
  serial_number: string;
  condition: WatchCondition;
  box_papers: boolean;
  description: string;
  image_urls: string[];
}

const INITIAL: FormState = {
  listing_type: "auction",
  asking_price: "",
  brand: "",
  model: "",
  reference_number: "",
  year: "",
  serial_number: "",
  condition: "excellent",
  box_papers: false,
  description: "",
  image_urls: [],
};

const CONDITION_LABELS: Record<WatchCondition, string> = {
  new: "Sıfır",
  mint: "Mint",
  excellent: "Mükemmel",
  good: "İyi",
  fair: "Orta",
};

export function SellWatchForm() {
  const router = useRouter();
  const [data, setData] = useState<FormState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function changeBrand(brand: string) {
    setData((d) => ({ ...d, brand, model: "" }));
  }

  function pushImage(url: string) {
    setData((d) => ({ ...d, image_urls: [...d.image_urls, url] }));
  }

  function removeImage(idx: number) {
    setData((d) => ({
      ...d,
      image_urls: d.image_urls.filter((_, i) => i !== idx),
    }));
  }

  const availableModels = modelsForBrand(data.brand);
  const askingPriceNum = parseFloat(data.asking_price);
  const showWidget =
    !Number.isNaN(askingPriceNum) && askingPriceNum > 0;
  const breakdown = useMemo(
    () => computeTieredCommission(showWidget ? askingPriceNum : 0),
    [askingPriceNum, showWidget],
  );

  function validate(): string | null {
    if (!data.brand.trim()) return "Marka zorunlu";
    if (!data.model.trim()) return "Model zorunlu";
    if (!data.reference_number.trim()) return "Referans numarası zorunlu";
    if (!data.year.trim()) return "Üretim yılı zorunlu";
    const y = parseInt(data.year, 10);
    if (Number.isNaN(y) || y < 1900 || y > 2100) {
      return "Geçerli bir yıl giriniz (1900–2100)";
    }
    if (data.description.trim().length < 10) {
      return "Açıklama en az 10 karakter olmalı";
    }
    if (data.listing_type === "direct_sale") {
      if (!data.asking_price.trim() || askingPriceNum <= 0) {
        return "Direkt satış için fiyat zorunludur (> 0)";
      }
    }
    return null;
  }

  async function submit() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setPending(true);

    const cleanedImages = data.image_urls
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    const payload: Record<string, unknown> = {
      brand: data.brand.trim(),
      model: data.model.trim(),
      reference_number: data.reference_number.trim(),
      year: parseInt(data.year, 10),
      serial_number: data.serial_number.trim() || null,
      box_papers: data.box_papers,
      condition: data.condition,
      description: data.description.trim(),
      image_urls: cleanedImages,
      listing_type: data.listing_type,
    };
    if (data.listing_type === "direct_sale") {
      payload.asking_price = askingPriceNum.toFixed(2);
    }

    try {
      const res = await fetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.detail ?? "İlan oluşturulamadı");
        return;
      }
      router.push(`/account/listings/${body.id}?just_created=1`);
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-12">
      <ListingTypeChooser
        value={data.listing_type}
        onChange={(v) => update("listing_type", v)}
      />

      <ExpertiseFlowNotice listingType={data.listing_type} />

      <section className="space-y-8">
        <h2 className="font-display text-2xl">Saat Bilgileri</h2>

        <label className="block">
          <span className="eyebrow block mb-2">Marka</span>
          <select
            value={data.brand}
            onChange={(e) => changeBrand(e.target.value)}
            required
            className="block w-full border-b border-line py-3 text-base bg-transparent focus:outline-none focus:border-brass transition-colors"
          >
            <option value="">Marka seçiniz...</option>
            {WATCH_CATALOG.map((b) => (
              <option key={b.brand} value={b.brand}>
                {b.brand}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="eyebrow block mb-2">Model</span>
          <select
            value={data.model}
            onChange={(e) => update("model", e.target.value)}
            required
            disabled={!data.brand}
            className="block w-full border-b border-line py-3 text-base bg-transparent focus:outline-none focus:border-brass transition-colors disabled:opacity-50"
          >
            <option value="">
              {data.brand ? "Model seçiniz..." : "Önce marka seçin"}
            </option>
            {availableModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <Input
          label="Referans Numarası"
          value={data.reference_number}
          onChange={(e) => update("reference_number", e.target.value)}
          placeholder="Örn: 126610LN"
          required
        />

        <div className="grid grid-cols-2 gap-6">
          <Input
            label="Üretim Yılı"
            type="number"
            min={1900}
            max={2100}
            value={data.year}
            onChange={(e) => update("year", e.target.value)}
            placeholder="2022"
            required
          />
          <Input
            label="Seri Numarası (opsiyonel)"
            value={data.serial_number}
            onChange={(e) => update("serial_number", e.target.value)}
          />
        </div>

        <div>
          <span className="eyebrow block mb-3">Kondisyon</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CONDITION_LABELS) as WatchCondition[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => update("condition", c)}
                className={`px-4 py-2 text-sm tracking-wide border transition-colors ${
                  data.condition === c
                    ? "border-charcoal bg-charcoal text-ivory"
                    : "border-line text-charcoal-500 hover:border-charcoal"
                }`}
              >
                {CONDITION_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.box_papers}
            onChange={(e) => update("box_papers", e.target.checked)}
            className="mt-1 w-4 h-4 accent-charcoal"
          />
          <div>
            <span className="block text-sm font-medium">
              Orijinal kutu ve kağıtlar mevcut
            </span>
            <span className="block text-xs text-charcoal-300 mt-0.5">
              Garanti kartı ve orijinal kutu satış değerini belirgin biçimde
              artırır.
            </span>
          </div>
        </label>

        <div>
          <span className="eyebrow block mb-2">Açıklama</span>
          <textarea
            value={data.description}
            onChange={(e) => update("description", e.target.value)}
            rows={6}
            placeholder="Servis geçmişi, kullanım hikayesi, dikkat çekecek detaylar..."
            className="block w-full border border-line p-4 text-base bg-transparent focus:outline-none focus:border-brass transition-colors"
            required
            minLength={10}
          />
        </div>

        <div>
          <span className="eyebrow block mb-3">Görseller</span>
          <p className="text-xs text-charcoal-300 mb-4 leading-relaxed">
            Birden fazla fotoğraf seçebilirsiniz. İlk yüklenen kapak görseli
            olur. Telefonunuzdan çekip doğrudan ekleyebilirsiniz.
          </p>

          {/* Yüklü görseller — thumbnail grid */}
          {data.image_urls.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
              {data.image_urls.map((url, idx) => (
                <div
                  key={url + idx}
                  className="relative aspect-square border border-line bg-ivory-50 overflow-hidden group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Görsel ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {idx === 0 && (
                    <span className="absolute top-1.5 left-1.5 text-[9px] tracking-widest uppercase bg-charcoal text-ivory px-1.5 py-0.5">
                      Kapak
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center bg-charcoal/80 text-ivory text-xs hover:bg-burgundy transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Görseli kaldır"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {data.image_urls.length < 20 && (
            <FileUploader
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              capture="environment"
              label={
                data.image_urls.length === 0
                  ? "+ İlk Fotoğrafı Ekle"
                  : "+ Yeni Fotoğraf Ekle"
              }
              onUploaded={pushImage}
            />
          )}
          {data.image_urls.length >= 20 && (
            <p className="text-xs text-charcoal-300 mt-2">
              Maksimum 20 görsel limitine ulaştınız.
            </p>
          )}
        </div>
      </section>

      {data.listing_type === "direct_sale" && (
        <section className="space-y-6">
          <h2 className="font-display text-2xl">Fiyatlandırma</h2>
          <Input
            label="İstenen Fiyat (USD)"
            type="number"
            min={1}
            step={1}
            value={data.asking_price}
            onChange={(e) => update("asking_price", e.target.value)}
            placeholder="8500"
            required
            hint="Alıcının ödeyeceği toplam tutar. Kademeli platform komisyonu bu tutardan düşülür."
          />
        </section>
      )}

      <EarningsWidget
        price={showWidget ? askingPriceNum : 0}
        listingType={data.listing_type}
        commission={breakdown.commission}
        net={breakdown.net}
        effectiveRate={breakdown.effectiveRate}
      />

      {error && (
        <div className="text-sm text-burgundy border-l-2 border-burgundy pl-3">
          {error}
        </div>
      )}

      <div className="flex justify-end border-t border-line pt-8">
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Yayınlanıyor..." : "İlanı Yayınla"}
        </Button>
      </div>
    </div>
  );
}

function ListingTypeChooser({
  value,
  onChange,
}: {
  value: ListingType;
  onChange: (v: ListingType) => void;
}) {
  const options: {
    id: ListingType;
    title: string;
    body: string;
  }[] = [
    {
      id: "auction",
      title: "Açık Artırma",
      body:
        "Haftalık müzayedeye katılır. Önce partner mağaza ekspertizinden geçer, sonra Pazartesi başlar.",
    },
    {
      id: "direct_sale",
      title: "Direkt Satış",
      body:
        "Sabit fiyatla anında listelenir. Ekspertiz, alıcı 'Hemen Al' dedikten sonra yapılır.",
    },
  ];
  return (
    <div>
      <span className="eyebrow block mb-4">İlan Tipi</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`text-left p-6 border transition-colors ${
                active
                  ? "border-charcoal bg-charcoal text-ivory"
                  : "border-line hover:border-charcoal"
              }`}
            >
              <span
                className={`block text-xs tracking-widest uppercase mb-2 ${
                  active ? "text-brass" : "text-charcoal-300"
                }`}
              >
                {opt.id === "auction" ? "Müzayede" : "Hemen Al"}
              </span>
              <span className="font-display text-xl block mb-2">
                {opt.title}
              </span>
              <span
                className={`block text-sm leading-relaxed ${
                  active ? "text-ivory-200" : "text-charcoal-500"
                }`}
              >
                {opt.body}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExpertiseFlowNotice({ listingType }: { listingType: ListingType }) {
  if (listingType === "auction") {
    return (
      <div className="border border-line p-6 bg-ivory-50">
        <span className="eyebrow text-brass block mb-2">
          Ön Ekspertiz Zorunlu
        </span>
        <p className="text-sm text-charcoal-700 leading-relaxed">
          Açık artırma ilanlarınız <strong>Ön Ekspertiz</strong> aşamasında
          başlar. Saatinizi partner mağazaya teslim edip uzman onayını
          aldıktan sonra ilan haftalık müzayede planına alınır.
        </p>
      </div>
    );
  }
  return (
    <div className="border border-line p-6 bg-ivory-50">
      <span className="eyebrow text-brass block mb-2">
        Satış Sonrası Ekspertiz
      </span>
      <p className="text-sm text-charcoal-700 leading-relaxed">
        Direkt satış ilanları anında yayına alınır. Alıcı &ldquo;Hemen
        Al&rdquo; dediğinde saat <strong>Ekspertiz Bekliyor</strong>{" "}
        aşamasına geçer; partner mağaza onayından sonra alıcıya kargolanır.
      </p>
    </div>
  );
}

function EarningsWidget({
  price,
  listingType,
  commission,
  net,
  effectiveRate,
}: {
  price: number;
  listingType: ListingType;
  commission: number;
  net: number;
  effectiveRate: number;
}) {
  return (
    <div className="border border-charcoal p-8 bg-ivory">
      <div className="flex items-baseline justify-between mb-6">
        <h3 className="font-display text-2xl">Kazanç Özeti</h3>
        <span className="eyebrow text-charcoal-300">Kademeli Komisyon</span>
      </div>

      {listingType === "auction" && price === 0 ? (
        <p className="text-sm text-charcoal-500 leading-relaxed">
          Açık artırma açılış/rezerv fiyatınızı saat onaylandıktan sonra
          belirleyeceksiniz. Aşağıdaki dilimler tüm satışlarda geçerli olacak.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <Stat
              label="Satış Fiyatı"
              value={formatUSD(price)}
              tone="muted"
            />
            <Stat
              label="Platform Komisyonu"
              value={formatUSD(commission)}
              tone="warning"
            />
            <Stat label="Net Hak Edişiniz" value={formatUSD(net)} tone="hero" />
          </div>
          {price > 0 && (
            <p className="text-xs text-charcoal-300 tracking-wide mb-6">
              Bu satıştaki ortalama komisyon oranınız:{" "}
              <span className="text-charcoal-700 font-medium">
                %{(effectiveRate * 100).toFixed(2)}
              </span>
            </p>
          )}
        </>
      )}

      <div className="border-t border-line pt-6">
        <span className="eyebrow block mb-3">Komisyon Dilimleri</span>
        <ul className="text-sm text-charcoal-700 leading-relaxed space-y-1.5">
          <li className="flex justify-between">
            <span>0 — {formatUSD(TIER_1_LIMIT)}</span>
            <span className="tabular-nums text-charcoal-500">
              %{(TIER_1_RATE * 100).toFixed(1)}
            </span>
          </li>
          <li className="flex justify-between">
            <span>
              {formatUSD(TIER_1_LIMIT + 1)} — {formatUSD(TIER_2_LIMIT)}
            </span>
            <span className="tabular-nums text-charcoal-500">
              %{(TIER_2_RATE * 100).toFixed(1)}
            </span>
          </li>
          <li className="flex justify-between">
            <span>{formatUSD(TIER_2_LIMIT + 1)} +</span>
            <span className="tabular-nums text-charcoal-500">
              %{(TIER_3_RATE * 100).toFixed(1)}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "muted" | "warning" | "hero";
}) {
  const toneClass = {
    muted: "text-charcoal-500",
    warning: "text-burgundy",
    hero: "text-charcoal font-display text-2xl",
  }[tone];
  return (
    <div>
      <span className="block text-[10px] tracking-widest uppercase text-charcoal-300 mb-1">
        {label}
      </span>
      <span className={`block tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}
