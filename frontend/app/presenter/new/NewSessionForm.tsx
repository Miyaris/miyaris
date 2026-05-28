"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { PresenterSessionListItem } from "@/lib/types";

/**
 * Yeni Oturum formu — sadece meta (ad, başlangıç saati, açıklama).
 *
 * Saatler oturum oluştuktan sonra detay sayfasında eklenir. Submit
 * başarılı olunca otomatik /presenter/sessions/[id] sayfasına yönlenir;
 * oradan saat ekleme akışı devam eder.
 */

function nextRoundedQuarter(): string {
  const now = new Date();
  const ms = 15 * 60 * 1000;
  const rounded = new Date(Math.ceil(now.getTime() / ms) * ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${rounded.getFullYear()}-${pad(rounded.getMonth() + 1)}-${pad(rounded.getDate())}` +
    `T${pad(rounded.getHours())}:${pad(rounded.getMinutes())}`
  );
}

function localInputToISO(localValue: string): string {
  if (!localValue) return "";
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

export function NewSessionForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scheduledAt, setScheduledAt] = useState(nextRoundedQuarter());
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const iso = localInputToISO(scheduledAt);
    if (!iso) {
      setError("Başlangıç saati geçersiz");
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

      <div>
        <label className="text-xs tracking-widest uppercase text-charcoal-500 mb-2 block">
          Başlangıç (yerel saat)
        </label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
          className="w-full bg-white border border-line px-4 py-3 text-sm tabular-nums focus:border-brass focus:outline-none"
        />
        <p className="mt-1 text-[11px] text-charcoal-300 leading-relaxed">
          Oturum public sayfada bu tarihte planlanmış olarak görünür.
          Canlıya almak için manuel "Yayına Başla" butonuna basacaksın.
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
