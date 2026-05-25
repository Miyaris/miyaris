"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AdminAuctionStatus } from "@/lib/types";

/**
 * Bir müzayede satırı için iki aksiyon:
 *   - "Bu Hafta'ya Çek" — geç katılım: müzayedeyi bu haftanın penceresine
 *     taşır, starts_at geçmişte ise anında LIVE'a çekilir.
 *   - "İptal" — admin override iptal (LIVE müzayedeleri de iptal edebilir).
 *
 * Her ikisi de inline confirm flow — modal yok. Hata mesajı bileşenin
 * altında inline gösterilir, router.refresh() ile sayfa yeniden yüklenir.
 */
export function AuctionActions({
  auctionId,
  status,
}: {
  auctionId: string;
  status: AdminAuctionStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"move" | "cancel" | null>(null);
  const [confirming, setConfirming] = useState<"move" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction(
    action: "move" | "cancel",
    path: string,
  ): Promise<void> {
    setError(null);
    setPending(action);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "İşlem başarısız");
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

  // SCHEDULED / LIVE harici aksiyon yok — read-only satır
  if (status !== "scheduled" && status !== "live") {
    return null;
  }

  if (confirming === "move") {
    return (
      <ConfirmRow
        message="Bu haftanın penceresine taşı?"
        onCancel={() => {
          setConfirming(null);
          setError(null);
        }}
        onConfirm={() =>
          runAction(
            "move",
            `/api/admin/auctions/${auctionId}/move-to-current-week`,
          )
        }
        pending={pending === "move"}
        accent="brass"
        confirmLabel="Taşı"
        error={error}
      />
    );
  }

  if (confirming === "cancel") {
    return (
      <ConfirmRow
        message="Bu müzayede iptal edilsin mi?"
        onCancel={() => {
          setConfirming(null);
          setError(null);
        }}
        onConfirm={() =>
          runAction("cancel", `/api/admin/auctions/${auctionId}/cancel`)
        }
        pending={pending === "cancel"}
        accent="burgundy"
        confirmLabel="İptal Et"
        error={error}
      />
    );
  }

  return (
    <div className="flex items-center gap-3 justify-end">
      {/* Sadece SCHEDULED için "Bu Hafta'ya Çek" — LIVE zaten bu hafta */}
      {status === "scheduled" && (
        <button
          type="button"
          onClick={() => setConfirming("move")}
          className="text-xs tracking-widest uppercase text-brass-dark hover:text-brass border-b border-brass/40 pb-0.5"
        >
          Bu Hafta'ya Çek
        </button>
      )}
      <button
        type="button"
        onClick={() => setConfirming("cancel")}
        className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-burgundy border-b border-charcoal/20 hover:border-burgundy pb-0.5"
      >
        İptal
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
  accent: "brass" | "burgundy";
  confirmLabel: string;
  error: string | null;
}) {
  const accentCls =
    accent === "brass"
      ? "text-brass-dark border-brass/40 hover:text-brass"
      : "text-burgundy border-burgundy/40 hover:text-burgundy";
  return (
    <div className="flex items-center gap-3 justify-end">
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
