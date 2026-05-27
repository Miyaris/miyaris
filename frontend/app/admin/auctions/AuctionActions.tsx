"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AdminAuctionStatus } from "@/lib/types";

/**
 * Bir müzayede satırı için admin aksiyonları:
 *   - "Bu Hafta'ya Çek" — sadece SCHEDULED için geç katılım
 *   - "İptal" — SCHEDULED + LIVE için (override)
 *   - "Kaldır" / "Geri Getir" — soft-hide toggle (her statüde geçerli)
 *
 * Aynı anda yalnızca bir aksiyon `confirming` olabilir. Tüm confirm flow
 * inline — modal yok. Hata mesajı satır sonunda inline gösterilir.
 */
type Pending = "move" | "cancel" | "hide" | null;

export function AuctionActions({
  auctionId,
  status,
  isHidden,
}: {
  auctionId: string;
  status: AdminAuctionStatus;
  isHidden: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [confirming, setConfirming] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction(action: Pending, path: string): Promise<void> {
    if (action === null) return;
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

  // ---- Confirm satırları --------------------------------------------------
  if (confirming === "move") {
    return (
      <ConfirmRow
        message="Bu haftanın penceresine taşı?"
        confirmLabel="Taşı"
        accent="brass"
        pending={pending === "move"}
        error={error}
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
      />
    );
  }

  if (confirming === "cancel") {
    return (
      <ConfirmRow
        message="Bu müzayede iptal edilsin mi?"
        confirmLabel="İptal Et"
        accent="burgundy"
        pending={pending === "cancel"}
        error={error}
        onCancel={() => {
          setConfirming(null);
          setError(null);
        }}
        onConfirm={() =>
          runAction("cancel", `/api/admin/auctions/${auctionId}/cancel`)
        }
      />
    );
  }

  if (confirming === "hide") {
    return (
      <ConfirmRow
        message={
          isHidden
            ? "Müzayede yayına geri getirilsin mi?"
            : "Müzayede sayfadan kaldırılsın mı?"
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
          runAction(
            "hide",
            `/api/admin/auctions/${auctionId}/${isHidden ? "unhide" : "hide"}`,
          )
        }
      />
    );
  }

  // ---- İdle durum: aksiyon butonları --------------------------------------
  return (
    <div className="flex items-center gap-3 justify-end flex-wrap">
      {/* Sadece SCHEDULED için "Bu Hafta'ya Çek" — LIVE zaten bu hafta */}
      {status === "scheduled" && !isHidden && (
        <button
          type="button"
          onClick={() => setConfirming("move")}
          className="text-xs tracking-widest uppercase text-brass-dark hover:text-brass border-b border-brass/40 pb-0.5"
        >
          Bu Hafta'ya Çek
        </button>
      )}
      {/* İptal sadece SCHEDULED/LIVE için */}
      {(status === "scheduled" || status === "live") && !isHidden && (
        <button
          type="button"
          onClick={() => setConfirming("cancel")}
          className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-burgundy border-b border-charcoal/20 hover:border-burgundy pb-0.5"
        >
          İptal
        </button>
      )}
      {/* Kaldır/Geri Getir — her durum için geçerli */}
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
  accent: "brass" | "burgundy" | "olive";
  confirmLabel: string;
  error: string | null;
}) {
  const accentCls =
    accent === "brass"
      ? "text-brass-dark border-brass/40 hover:text-brass"
      : accent === "olive"
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
