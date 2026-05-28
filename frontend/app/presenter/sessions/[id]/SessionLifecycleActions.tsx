"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PresenterSessionStatus } from "@/lib/types";

/**
 * Oturum yaşam döngüsü aksiyonları.
 *
 * Yapı:
 *  - PLANNING + en az 1 lot → "Yayına Başla" (start)
 *  - LIVE → "Sunucu Ekranına Git" + "Oturumu Bitir" (end)
 *  - ENDED/CANCELLED → aksiyon yok, mesaj
 *
 * Confirm inline; modal yok.
 */
type Pending = "start" | "end" | null;

export function SessionLifecycleActions({
  sessionId,
  status,
  lotCount,
}: {
  sessionId: string;
  status: PresenterSessionStatus;
  lotCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [confirming, setConfirming] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(which: "start" | "end"): Promise<void> {
    setError(null);
    setPending(which);
    try {
      const res = await fetch(
        `/api/presenter/sessions/${sessionId}/${which}`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.detail ?? "İşlem başarısız");
        return;
      }
      setConfirming(null);
      if (which === "start") {
        router.push(`/presenter/sessions/${sessionId}/live`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(null);
    }
  }

  if (status === "ended" || status === "cancelled") {
    return null;
  }

  if (status === "planning") {
    if (confirming === "start") {
      return (
        <div className="inline-flex items-center gap-4 border border-olive/40 bg-olive/5 px-4 py-3">
          <span className="text-sm text-charcoal-700">
            {lotCount} saat ile canlıya alınsın mı?
          </span>
          <button
            type="button"
            onClick={() => {
              setConfirming(null);
              setError(null);
            }}
            disabled={pending === "start"}
            className="text-xs tracking-widest uppercase text-charcoal-300 hover:text-charcoal"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => call("start")}
            disabled={pending === "start"}
            className="bg-olive text-ivory px-5 py-2 text-xs tracking-widest uppercase hover:bg-olive/90"
          >
            {pending === "start" ? "..." : "Yayına Başla"}
          </button>
          {error && (
            <span className="text-xs text-burgundy">{error}</span>
          )}
        </div>
      );
    }
    return (
      <div>
        <button
          type="button"
          onClick={() => setConfirming("start")}
          disabled={lotCount === 0}
          className="bg-olive text-ivory px-6 py-3 text-xs tracking-widest uppercase hover:bg-olive/90 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Yayına Başla
        </button>
        {lotCount === 0 && (
          <p className="mt-2 text-xs text-charcoal-300">
            En az 1 saat eklemeden canlıya geçilemez
          </p>
        )}
      </div>
    );
  }

  // LIVE
  if (confirming === "end") {
    return (
      <div className="inline-flex items-center gap-4 border border-burgundy/40 bg-burgundy/5 px-4 py-3 flex-wrap">
        <span className="text-sm text-charcoal-700">
          Oturum tamamen kapatılsın mı? Mevcut canlı saat de biter.
        </span>
        <button
          type="button"
          onClick={() => {
            setConfirming(null);
            setError(null);
          }}
          disabled={pending === "end"}
          className="text-xs tracking-widest uppercase text-charcoal-300 hover:text-charcoal"
        >
          Vazgeç
        </button>
        <button
          type="button"
          onClick={() => call("end")}
          disabled={pending === "end"}
          className="bg-burgundy text-ivory px-5 py-2 text-xs tracking-widest uppercase hover:bg-burgundy/90"
        >
          {pending === "end" ? "..." : "Oturumu Bitir"}
        </button>
        {error && <span className="text-xs text-burgundy">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <a
        href={`/presenter/sessions/${sessionId}/live`}
        className="bg-olive text-ivory px-6 py-3 text-xs tracking-widest uppercase hover:bg-olive/90"
      >
        Sunucu Ekranına Git →
      </a>
      <button
        type="button"
        onClick={() => setConfirming("end")}
        className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-burgundy border-b border-charcoal/20 hover:border-burgundy pb-0.5"
      >
        Oturumu Bitir
      </button>
    </div>
  );
}
