"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Bir oturum satırı için admin aksiyonları:
 *   - "Kaldır" / "Geri Getir" — herkese açık sayfadan gizle/aç (her statüde geçerli)
 *   - "İptal" — sadece PLANNING + LIVE; oturumu kapatır, mevcut lot da biter
 *
 * Confirm flow inline; modal yok.
 */
type Pending = "hide" | "cancel" | null;

export function SessionActions({
  sessionId,
  status,
  isHidden,
}: {
  sessionId: string;
  status: string;
  isHidden: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [confirming, setConfirming] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  const canCancel = status === "PLANNING" || status === "LIVE";

  async function call(which: "hide" | "cancel", path: string) {
    setError(null);
    setPending(which);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.detail ?? "İşlem başarısız");
        return;
      }
      setConfirming(null);
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(null);
    }
  }

  if (confirming === "hide") {
    return (
      <ConfirmRow
        message={
          isHidden
            ? "Oturum yayına geri getirilsin mi?"
            : "Oturum herkese açık sayfadan kaldırılsın mı?"
        }
        confirmLabel={isHidden ? "Geri Getir" : "Kaldır"}
        accent={isHidden ? "olive" : "burgundy"}
        pending={pending === "hide"}
        error={error}
        onCancel={() => {
          setConfirming(null);
          setError(null);
        }}
        onConfirm={() =>
          call(
            "hide",
            `/api/admin/sessions/${sessionId}/${isHidden ? "unhide" : "hide"}`,
          )
        }
      />
    );
  }

  if (confirming === "cancel") {
    return (
      <ConfirmRow
        message="Oturum iptal edilsin mi? Mevcut canlı saat de biter."
        confirmLabel="İptal Et"
        accent="burgundy"
        pending={pending === "cancel"}
        error={error}
        onCancel={() => {
          setConfirming(null);
          setError(null);
        }}
        onConfirm={() =>
          call("cancel", `/api/admin/sessions/${sessionId}/cancel`)
        }
      />
    );
  }

  return (
    <div className="flex items-center gap-3 justify-end flex-wrap">
      {canCancel && (
        <button
          type="button"
          onClick={() => setConfirming("cancel")}
          className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-burgundy border-b border-charcoal/20 hover:border-burgundy pb-0.5"
        >
          İptal
        </button>
      )}
      <button
        type="button"
        onClick={() => setConfirming("hide")}
        className={`text-xs tracking-widest uppercase border-b pb-0.5 ${
          isHidden
            ? "text-olive hover:text-olive border-olive/40"
            : "text-charcoal-500 hover:text-burgundy border-charcoal/20 hover:border-burgundy"
        }`}
      >
        {isHidden ? "Geri Getir" : "Kaldır"}
      </button>
    </div>
  );
}

function ConfirmRow({
  message,
  onCancel,
  onConfirm,
  pending,
  accent,
  confirmLabel,
  error,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  accent: "burgundy" | "olive";
  confirmLabel: string;
  error: string | null;
}) {
  const accentCls =
    accent === "olive"
      ? "text-olive border-olive/40 hover:text-olive"
      : "text-burgundy border-burgundy/40 hover:text-burgundy";
  return (
    <div className="flex items-center gap-3 justify-end flex-wrap">
      <span className="text-xs text-charcoal-500">{message}</span>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="text-xs tracking-widest uppercase text-charcoal-300 hover:text-charcoal"
      >
        Vazgeç
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={pending}
        className={`text-xs tracking-widest uppercase border-b pb-0.5 ${accentCls}`}
      >
        {pending ? "..." : confirmLabel}
      </button>
      {error && (
        <span className="text-xs text-burgundy max-w-[200px] truncate">
          {error}
        </span>
      )}
    </div>
  );
}
