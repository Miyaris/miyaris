"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FileUploader } from "@/components/shared/FileUploader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { WatchCondition } from "@/lib/types";

/**
 * Saat lot'u ekleme formu — kompakt, sidebar'a sığacak şekilde.
 *
 * Submit başarılı olduğunda router.refresh() ile parent sayfa güncellenir,
 * yeni eklenen lot listede belirir.
 */
interface FormState {
  brand: string;
  model: string;
  reference_number: string;
  year: string;
  condition: WatchCondition;
  description: string;
  serial_number: string;
  box_papers: boolean;
  image_urls: string[];
  starting_price: string;
  min_bid_increment: string;
  reserve_price: string;
  buy_it_now_price: string;
}

const CONDITION_LABELS: Record<WatchCondition, string> = {
  new: "Sıfır",
  mint: "Mint",
  excellent: "Mükemmel",
  good: "İyi",
  fair: "Orta",
};

const INITIAL: FormState = {
  brand: "",
  model: "",
  reference_number: "",
  year: String(new Date().getFullYear()),
  condition: "excellent",
  description: "",
  serial_number: "",
  box_papers: false,
  image_urls: [],
  starting_price: "",
  min_bid_increment: "50",
  reserve_price: "",
  buy_it_now_price: "",
};

export function AddLotForm({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [data, setData] = useState<FormState>(INITIAL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((p) => ({ ...p, [key]: value }));
  }

  function addImage(url: string) {
    setData((p) =>
      p.image_urls.length >= 12
        ? p
        : { ...p, image_urls: [...p.image_urls, url] },
    );
  }

  function removeImage(idx: number) {
    setData((p) => ({
      ...p,
      image_urls: p.image_urls.filter((_, i) => i !== idx),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (data.image_urls.length === 0) {
      setError("En az 1 fotoğraf yükleyin");
      return;
    }
    if (!data.starting_price || Number(data.starting_price) <= 0) {
      setError("Başlangıç fiyatı 0'dan büyük olmalı");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        brand: data.brand.trim(),
        model: data.model.trim(),
        reference_number: data.reference_number.trim(),
        year: Number(data.year),
        condition: data.condition,
        description: data.description.trim(),
        serial_number: data.serial_number.trim() || null,
        box_papers: data.box_papers,
        image_urls: data.image_urls,
        starting_price: data.starting_price,
        min_bid_increment: data.min_bid_increment || "50",
        reserve_price: data.reserve_price || null,
        buy_it_now_price: data.buy_it_now_price || null,
      };

      const res = await fetch(
        `/api/presenter/sessions/${sessionId}/lots`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = await res.json();
      if (!res.ok) {
        setError(result.detail ?? "Saat eklenemedi");
        return;
      }
      setSuccessMsg(`${payload.brand} ${payload.model} eklendi`);
      // Form'u sıfırla — saat ekleme akışı tekrarlanabilir
      setData(INITIAL);
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Marka"
          value={data.brand}
          onChange={(e) => update("brand", e.target.value)}
          required
        />
        <Input
          label="Model"
          value={data.model}
          onChange={(e) => update("model", e.target.value)}
          required
        />
      </div>
      <Input
        label="Referans No"
        value={data.reference_number}
        onChange={(e) => update("reference_number", e.target.value)}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Yıl"
          type="number"
          value={data.year}
          onChange={(e) => update("year", e.target.value)}
          min={1900}
          required
        />
        <div>
          <label className="text-xs tracking-widest uppercase text-charcoal-500 mb-2 block">
            Durum
          </label>
          <select
            value={data.condition}
            onChange={(e) =>
              update("condition", e.target.value as WatchCondition)
            }
            className="w-full bg-white border border-line px-3 py-3 text-sm focus:border-brass focus:outline-none"
          >
            {(Object.keys(CONDITION_LABELS) as WatchCondition[]).map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={data.box_papers}
          onChange={(e) => update("box_papers", e.target.checked)}
          className="w-4 h-4 accent-brass-dark"
        />
        <span className="text-charcoal-700">Kutu + evrak mevcut</span>
      </label>

      <div>
        <label className="text-xs tracking-widest uppercase text-charcoal-500 mb-2 block">
          Açıklama
        </label>
        <textarea
          value={data.description}
          onChange={(e) => update("description", e.target.value)}
          rows={3}
          minLength={20}
          required
          className="w-full bg-white border border-line px-3 py-2 text-sm focus:border-brass focus:outline-none resize-none"
          placeholder="Saatin durumu, geçmişi..."
        />
      </div>

      <div>
        <p className="text-xs tracking-widest uppercase text-charcoal-500 mb-2">
          Fotoğraflar ({data.image_urls.length}/12)
        </p>
        {data.image_urls.length < 12 && (
          <FileUploader
            accept="image/*"
            multiple
            label="Foto ekle"
            onUploaded={addImage}
            capture="environment"
          />
        )}
        {data.image_urls.length > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {data.image_urls.map((url, idx) => (
              <div key={url} className="relative aspect-square bg-ivory-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-charcoal/80 text-ivory text-xs hover:bg-burgundy"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Başlangıç ($)"
          type="number"
          value={data.starting_price}
          onChange={(e) => update("starting_price", e.target.value)}
          min={1}
          required
        />
        <Input
          label="Min. Artış ($)"
          type="number"
          value={data.min_bid_increment}
          onChange={(e) => update("min_bid_increment", e.target.value)}
          min={1}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Rezerv ($)"
          type="number"
          value={data.reserve_price}
          onChange={(e) => update("reserve_price", e.target.value)}
          min={1}
        />
        <Input
          label="Hemen Al ($)"
          type="number"
          value={data.buy_it_now_price}
          onChange={(e) => update("buy_it_now_price", e.target.value)}
          min={1}
        />
      </div>

      {error && (
        <p className="text-xs text-burgundy border-l-2 border-burgundy pl-3 leading-relaxed">
          {error}
        </p>
      )}
      {successMsg && (
        <p className="text-xs text-olive border-l-2 border-olive pl-3 leading-relaxed">
          {successMsg}
        </p>
      )}

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Ekleniyor..." : "Saati Oturuma Ekle"}
      </Button>
    </form>
  );
}
