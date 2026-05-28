"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FileUploader } from "@/components/shared/FileUploader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { PresenterShowcase, WatchCondition } from "@/lib/types";

/**
 * Yeni Showcase formu — saat + müzayede tek POST.
 *
 * Tasarım:
 *  - Tek scroll'da minimum gerekli alanlar; ekspertiz yok, AI yok.
 *  - Müzayede zamanı: native `datetime-local` (kullanıcı yerel saatte
 *    seçer, biz ISO 8601 + offset olarak gönderiyoruz).
 *  - Süre: dakika preset'leri (15 / 30 / 60 / 120) + custom input.
 *  - En az 1 fotoğraf zorunlu; maks 12.
 *  - Submit başarılı → /presenter/live/[auctionId]'e yönlendir.
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
  starts_at: string; // datetime-local format: "YYYY-MM-DDTHH:mm"
  duration_minutes: number;
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

const DURATION_PRESETS = [15, 30, 60, 120] as const;

/** "YYYY-MM-DDTHH:mm" → ISO 8601 + tz offset (yerel saat dilimini ekler).
 *  Tarayıcının `Date` parser'ı `datetime-local` string'i yerel saat olarak
 *  yorumlar; biz onu UTC offset'iyle serileştiriyoruz. */
function localInputToISOWithOffset(localValue: string): string {
  if (!localValue) return "";
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return "";
  // Date.toISOString() UTC veriyor — bizim Pydantic validator'ı tz-aware
  // ISO bekliyor, UTC ISO da geçerli. Direkt kullanıyoruz.
  return date.toISOString();
}

function nextRoundedQuarter(): string {
  const now = new Date();
  // 15 dakikalık dilime yuvarla → sonraki 15dk
  const ms = 15 * 60 * 1000;
  const rounded = new Date(Math.ceil(now.getTime() / ms) * ms);
  // datetime-local: "YYYY-MM-DDTHH:mm" (saniye + tz YOK)
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${rounded.getFullYear()}-${pad(rounded.getMonth() + 1)}-${pad(rounded.getDate())}` +
    `T${pad(rounded.getHours())}:${pad(rounded.getMinutes())}`
  );
}

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
  starts_at: nextRoundedQuarter(),
  duration_minutes: 30,
  starting_price: "",
  min_bid_increment: "50",
  reserve_price: "",
  buy_it_now_price: "",
};

export function NewShowcaseForm() {
  const router = useRouter();
  const [data, setData] = useState<FormState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function addImage(url: string) {
    setData((prev) =>
      prev.image_urls.length >= 12
        ? prev
        : { ...prev, image_urls: [...prev.image_urls, url] },
    );
  }

  function removeImage(idx: number) {
    setData((prev) => ({
      ...prev,
      image_urls: prev.image_urls.filter((_, i) => i !== idx),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side temel validasyon — backend yine kontrol eder
    if (data.image_urls.length === 0) {
      setError("En az 1 fotoğraf yükleyin");
      return;
    }
    if (!data.starts_at) {
      setError("Başlangıç saatini seçin");
      return;
    }
    if (!data.starting_price || Number(data.starting_price) <= 0) {
      setError("Başlangıç fiyatı 0'dan büyük olmalı");
      return;
    }

    const startsIso = localInputToISOWithOffset(data.starts_at);
    if (!startsIso) {
      setError("Başlangıç saati geçersiz");
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
        starts_at: startsIso,
        duration_minutes: data.duration_minutes,
        starting_price: data.starting_price,
        min_bid_increment: data.min_bid_increment || "50",
        reserve_price: data.reserve_price || null,
        buy_it_now_price: data.buy_it_now_price || null,
      };

      const res = await fetch("/api/presenter/showcases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.detail ?? "Yayın oluşturulamadı");
        return;
      }
      const created = result as PresenterShowcase;
      router.push(`/presenter/live/${created.auction_id}`);
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-12">
      {/* ----- Saat bilgileri ----- */}
      <section>
        <h2 className="eyebrow text-brass-dark mb-4">Saat Bilgileri</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input
            label="Marka"
            value={data.brand}
            onChange={(e) => update("brand", e.target.value)}
            required
            maxLength={80}
          />
          <Input
            label="Model"
            value={data.model}
            onChange={(e) => update("model", e.target.value)}
            required
            maxLength={120}
          />
          <Input
            label="Referans No"
            value={data.reference_number}
            onChange={(e) => update("reference_number", e.target.value)}
            required
            maxLength={60}
          />
          <Input
            label="Yıl"
            type="number"
            value={data.year}
            onChange={(e) => update("year", e.target.value)}
            min={1900}
            max={new Date().getFullYear() + 1}
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
              className="w-full bg-white border border-line px-4 py-3 text-sm focus:border-brass focus:outline-none"
            >
              {(Object.keys(CONDITION_LABELS) as WatchCondition[]).map((c) => (
                <option key={c} value={c}>
                  {CONDITION_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Seri No (opsiyonel)"
            value={data.serial_number}
            onChange={(e) => update("serial_number", e.target.value)}
            maxLength={80}
          />
          <label className="flex items-center gap-3 cursor-pointer text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={data.box_papers}
              onChange={(e) => update("box_papers", e.target.checked)}
              className="w-4 h-4 accent-brass-dark"
            />
            <span className="text-charcoal-700">Kutu + evrak mevcut</span>
          </label>
          <div className="md:col-span-2">
            <label className="text-xs tracking-widest uppercase text-charcoal-500 mb-2 block">
              Açıklama
            </label>
            <textarea
              value={data.description}
              onChange={(e) => update("description", e.target.value)}
              rows={4}
              minLength={20}
              maxLength={4000}
              required
              className="w-full bg-white border border-line px-4 py-3 text-sm focus:border-brass focus:outline-none resize-none"
              placeholder="Saatin durumu, geçmişi, özellikleri..."
            />
          </div>
        </div>
      </section>

      {/* ----- Fotoğraflar ----- */}
      <section>
        <h2 className="eyebrow text-brass-dark mb-4">
          Fotoğraflar ({data.image_urls.length}/12)
        </h2>
        {data.image_urls.length < 12 && (
          <FileUploader
            accept="image/*"
            multiple
            label="Fotoğraf seç veya çek"
            onUploaded={addImage}
            capture="environment"
          />
        )}
        {data.image_urls.length > 0 && (
          <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-3">
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
                  className="absolute top-1 right-1 w-6 h-6 bg-charcoal/80 text-ivory text-xs hover:bg-burgundy transition-colors"
                  aria-label="Kaldır"
                >
                  ×
                </button>
                {idx === 0 && (
                  <span className="absolute bottom-1 left-1 text-[9px] tracking-widest uppercase bg-brass/90 text-charcoal px-1.5 py-0.5">
                    Ana
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ----- Müzayede penceresi ----- */}
      <section>
        <h2 className="eyebrow text-brass-dark mb-4">Müzayede Penceresi</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-xs tracking-widest uppercase text-charcoal-500 mb-2 block">
              Başlangıç (yerel saat)
            </label>
            <input
              type="datetime-local"
              value={data.starts_at}
              onChange={(e) => update("starts_at", e.target.value)}
              required
              className="w-full bg-white border border-line px-4 py-3 text-sm tabular-nums focus:border-brass focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-charcoal-300 leading-relaxed">
              Şimdi veya geçmiş seçersen müzayede anında canlıya geçer.
            </p>
          </div>
          <div>
            <label className="text-xs tracking-widest uppercase text-charcoal-500 mb-2 block">
              Süre (dakika)
            </label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {DURATION_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => update("duration_minutes", m)}
                  className={`text-xs tracking-widest uppercase px-3 py-2 border transition-colors ${
                    data.duration_minutes === m
                      ? "bg-charcoal text-ivory border-charcoal"
                      : "bg-white border-line text-charcoal-700 hover:border-charcoal"
                  }`}
                >
                  {m} dk
                </button>
              ))}
            </div>
            <input
              type="number"
              value={data.duration_minutes}
              onChange={(e) =>
                update(
                  "duration_minutes",
                  Math.max(5, Math.min(240, Number(e.target.value) || 30)),
                )
              }
              min={5}
              max={240}
              className="w-full bg-white border border-line px-4 py-3 text-sm tabular-nums focus:border-brass focus:outline-none"
            />
          </div>

          <Input
            label="Başlangıç Fiyatı (USD)"
            type="number"
            value={data.starting_price}
            onChange={(e) => update("starting_price", e.target.value)}
            min={1}
            step={1}
            required
          />
          <Input
            label="Min. Artış (USD)"
            type="number"
            value={data.min_bid_increment}
            onChange={(e) => update("min_bid_increment", e.target.value)}
            min={1}
            step={1}
          />
          <Input
            label="Rezerv Fiyat (opsiyonel)"
            type="number"
            value={data.reserve_price}
            onChange={(e) => update("reserve_price", e.target.value)}
            min={1}
            step={1}
          />
          <Input
            label="Hemen Al Fiyatı (opsiyonel)"
            type="number"
            value={data.buy_it_now_price}
            onChange={(e) => update("buy_it_now_price", e.target.value)}
            min={1}
            step={1}
          />
        </div>
      </section>

      {error && (
        <p className="text-sm text-burgundy border-l-2 border-burgundy pl-4 leading-relaxed">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4 pt-6 border-t border-line">
        <Button type="submit" disabled={busy}>
          {busy ? "Yayınlanıyor..." : "Yayına Al"}
        </Button>
        <a
          href="/presenter"
          className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-charcoal"
        >
          Vazgeç
        </a>
      </div>
    </form>
  );
}
