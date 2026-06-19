"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PresenterSessionDetail } from "@/lib/types";

/**
 * Oturum bilgilerini düzenleme formu.
 *
 * Açılan modal içinde ad / tarih-saat / açıklama düzenlenebilir. Yalnızca
 * PLANNING durumundaki oturumlar için açık. LIVE veya ENDED oturumda buton
 * görünmez (üst componentte gizlenir).
 *
 * Tarih-saat: HTML datetime-local input. Gönderilirken UTC ISO'ya çevrilir
 * (backend tz-aware bekler).
 */
export function EditSessionForm({ session }: { session: PresenterSessionDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(session.name);
  const [scheduledLocal, setScheduledLocal] = useState(
    isoToLocalInput(session.scheduled_at),
  );
  const [description, setDescription] = useState(session.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const payload: Record<string, string> = {};
      if (name.trim() !== session.name) payload.name = name.trim();
      const newIso = localInputToIso(scheduledLocal);
      if (newIso !== session.scheduled_at) payload.scheduled_at = newIso;
      const newDesc = description.trim();
      if (newDesc !== (session.description ?? "")) {
        payload.description = newDesc;
      }

      if (Object.keys(payload).length === 0) {
        setOpen(false);
        return;
      }

      const res = await fetch(`/api/presenter/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.detail ?? "Kaydedilemedi");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs tracking-[0.3em] uppercase text-brass-dark hover:text-brass border-b border-brass/40 pb-0.5"
      >
        Saat ve Bilgileri Düzenle
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm"
          onClick={() => !pending && setOpen(false)}
        >
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="bg-ivory border border-line max-w-lg w-full p-8 shadow-xl"
          >
            <p className="text-[10px] tracking-[0.4em] uppercase text-brass-dark mb-3">
              Oturum Düzenle
            </p>
            <h2 className="font-display text-3xl text-charcoal mb-6 leading-tight">
              Saat ve Bilgileri Güncelle
            </h2>

            <p className="text-xs text-charcoal-500 mb-6 leading-relaxed border-l-2 border-brass/40 pl-3 py-1 bg-brass/5">
              Yalnızca planlama aşamasında düzenlenebilir. Oturum canlıya alındıktan
              sonra saatini değiştirmek katılımcı deneyimini bozar.
            </p>

            <div className="space-y-5">
              <label className="block">
                <span className="text-[10px] tracking-[0.3em] uppercase text-charcoal-500 mb-2 block">
                  Oturum Adı
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={3}
                  maxLength={160}
                  disabled={pending}
                  className="block w-full border border-line bg-ivory-100 px-4 py-3 text-base focus:outline-none focus:border-brass-dark transition-colors disabled:opacity-50"
                />
              </label>

              <label className="block">
                <span className="text-[10px] tracking-[0.3em] uppercase text-charcoal-500 mb-2 block">
                  Başlangıç Tarihi ve Saati
                </span>
                <input
                  type="datetime-local"
                  value={scheduledLocal}
                  onChange={(e) => setScheduledLocal(e.target.value)}
                  required
                  disabled={pending}
                  className="block w-full border border-line bg-ivory-100 px-4 py-3 text-base focus:outline-none focus:border-brass-dark transition-colors disabled:opacity-50 tabular-nums"
                />
              </label>

              <label className="block">
                <span className="text-[10px] tracking-[0.3em] uppercase text-charcoal-500 mb-2 block">
                  Açıklama (opsiyonel)
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  disabled={pending}
                  placeholder="Oturum hakkında kısa bir tanıtım, koleksiyon teması..."
                  className="block w-full border border-line bg-ivory-100 px-4 py-3 text-base focus:outline-none focus:border-brass-dark transition-colors disabled:opacity-50 resize-none"
                />
              </label>
            </div>

            {error && (
              <p className="text-sm text-burgundy border-l-2 border-burgundy pl-3 py-1 mt-5">
                {error}
              </p>
            )}

            <div className="mt-8 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="text-xs tracking-[0.3em] uppercase text-charcoal-500 hover:text-charcoal disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={pending}
                className="bg-charcoal hover:bg-charcoal-700 text-ivory px-8 py-3 text-xs tracking-[0.3em] uppercase disabled:opacity-50"
              >
                {pending ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

// ============================================================================
// Tarih-saat dönüşümü
// ============================================================================
//
// datetime-local input "YYYY-MM-DDTHH:mm" formatında local saat alır/verir.
// Backend tz-aware ISO ister (örn: "2026-06-25T14:30:00+03:00" veya UTC "Z").
//
// İçeri (ISO → local): tarayıcının zaman dilimi olan değer formatına çevir.
// Dışarı (local → ISO): tarayıcı local'i UTC'ye çevirip "Z" ile ekle.

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function localInputToIso(local: string): string {
  if (!local) return "";
  return new Date(local).toISOString();
}
