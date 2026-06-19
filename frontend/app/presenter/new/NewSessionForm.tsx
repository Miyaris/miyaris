"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { PresenterSessionListItem } from "@/lib/types";

/**
 * Yeni Oturum formu — sadece meta (ad, başlangıç tarihi, saat, açıklama).
 *
 * Native `datetime-local` input tarayıcının sistem diline göre AM/PM veya
 * 24 saatlik format gösteriyordu. Onun yerine ayrı widget'lar:
 *   - Tarih için `<input type="date">` (tarayıcının kendi takvimi, lang="tr"
 *     hint'i ile Türkçe gün adları öncelikli)
 *   - Saat için Türkçe etiketli `<select>` (00:00 - 23:45, 15 dk dilim)
 *
 * Form submit'te tarih + saat birleştirilip ISO 8601'e çevrilip backend'e
 * gönderiliyor.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" — sonraki çeyrek saatten itibaren */
function nextQuarter(): { date: string; time: string } {
  const now = new Date();
  const ms = 15 * 60 * 1000;
  const rounded = new Date(Math.ceil(now.getTime() / ms) * ms);
  const date = `${rounded.getFullYear()}-${pad(rounded.getMonth() + 1)}-${pad(rounded.getDate())}`;
  const time = `${pad(rounded.getHours())}:${pad(rounded.getMinutes())}`;
  return { date, time };
}

/** 00:00, 00:15, 00:30, ..., 23:45 — 24 saatlik format */
const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      out.push(`${pad(h)}:${pad(m)}`);
    }
  }
  return out;
})();

/** Tarih + saat'i ISO 8601'e çevir (yerel saat → UTC). */
function buildISO(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return "";
  }
  const d = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

/** "30 Mayıs 2026, Cuma · 15:00" — preview için. */
function formatPreview(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) return "—";
  const iso = buildISO(dateStr, timeStr);
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NewSessionForm() {
  const router = useRouter();
  const init = useMemo(nextQuarter, []);
  const [name, setName] = useState("");
  const [date, setDate] = useState(init.date);
  const [time, setTime] = useState(init.time);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = formatPreview(date, time);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const iso = buildISO(date, time);
    if (!iso) {
      setError("Başlangıç tarihi/saati geçersiz");
      return;
    }
    if (name.trim().length < 3) {
      setError("Oturum adı en az 3 karakter olmalı");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/presenter/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          scheduled_at: iso,
          description: description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Oturum oluşturulamadı");
        return;
      }
      const created = data as PresenterSessionListItem;
      router.push(`/presenter/sessions/${created.id}`);
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Input
        label="Oturum Adı"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Örn. Cuma Akşamı Vintage Müzayedesi"
        required
        minLength={3}
        maxLength={160}
      />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
        <div>
          <label className="text-xs tracking-widest uppercase text-charcoal-500 mb-2 block">
            Tarih
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full bg-white border border-line px-4 py-3 text-sm tabular-nums focus:border-brass focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs tracking-widest uppercase text-charcoal-500 mb-2 block">
            Saat
          </label>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            className="w-full bg-white border border-line px-4 py-3 text-sm tabular-nums focus:border-brass focus:outline-none"
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Türkçe formatlı önizleme — kullanıcı seçimi net doğrulayabilir */}
      <div className="border-l-2 border-brass/40 bg-brass/5 px-4 py-3">
        <p className="text-[10px] tracking-widest uppercase text-brass-dark mb-1">
          Planlanan Başlangıç
        </p>
        <p className="text-sm text-charcoal-700 tabular-nums">{preview}</p>
        <p className="mt-1 text-[11px] text-charcoal-300 leading-relaxed">
          Oturum herkese açık sayfada bu tarihte planlanmış olarak görünür. Canlıya
          almak için "Yayına Başla" butonuna basacaksın.
        </p>
      </div>

      <div>
        <label className="text-xs tracking-widest uppercase text-charcoal-500 mb-2 block">
          Açıklama (opsiyonel)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Oturum hakkında bilgi — hangi marka odaklı, kaç saat..."
          className="w-full bg-white border border-line px-4 py-3 text-sm focus:border-brass focus:outline-none resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-burgundy border-l-2 border-burgundy pl-4 leading-relaxed">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4 pt-6 border-t border-line">
        <Button type="submit" disabled={busy}>
          {busy ? "Oluşturuluyor..." : "Oturumu Aç"}
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
