"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";

/**
 * Kararı verilmiş bir saati ekspertiz kuyruğuna geri al.
 *
 * Görünür yan etki uyarıları:
 *   - Sertifika silinecek (yeniden çıkarılabilir)
 *   - Sahtecilik banı varsa satıcı re-aktive edilecek
 *   - Saat tekrar PENDING_REVIEW kuyruğunda görünecek
 */
export function RevertForm({
  watchId,
  currentStatus,
  hasCertificate,
}: {
  watchId: string;
  currentStatus: string;
  hasCertificate: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onRevert() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/watches/${watchId}/revert`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Geri alma başarısız");
        return;
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  const statusLabel = currentStatus === "active" ? "Aktif" : "Reddedildi";

  if (!confirming) {
    return (
      <div className="border border-line bg-ivory-50 p-6 space-y-4">
        <div>
          <span className="eyebrow mb-2 block">Karar verildi</span>
          <p className="text-sm text-charcoal-700">
            Bu saat şu anda{" "}
            <strong className="text-charcoal">{statusLabel}</strong>{" "}
            durumunda. Karar değişikliği için ekspertiz kuyruğuna geri
            alabilirsin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full text-xs tracking-widest uppercase text-charcoal-700 hover:text-brass border border-charcoal/40 hover:border-brass py-3 transition-colors"
        >
          Kararı Geri Al
        </button>
      </div>
    );
  }

  return (
    <div className="border border-brass/40 bg-brass/5 p-6 space-y-4">
      <div>
        <span className="eyebrow text-brass-dark mb-2 block">
          Karar geri alınacak
        </span>
        <p className="text-sm text-charcoal-700 leading-relaxed">
          Saat <strong>{statusLabel}</strong> durumundan{" "}
          <strong>Bekleyen Kuyruk</strong>&apos;a geri çekilecek. Yan etkiler:
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-charcoal-700">
          {hasCertificate && (
            <li className="flex gap-2">
              <span className="text-brass-dark">·</span>
              <span>Mevcut sertifika silinecek (yeniden çıkarılabilir)</span>
            </li>
          )}
          <li className="flex gap-2">
            <span className="text-brass-dark">·</span>
            <span>
              Sahtecilik banı varsa satıcı hesabı yeniden aktive edilecek
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-brass-dark">·</span>
            <span>Saat yeniden moderasyon kuyruğunda görünecek</span>
          </li>
        </ul>
      </div>

      {error && (
        <div className="text-sm text-burgundy border-l-2 border-burgundy pl-3">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={pending}
          className="flex-1 text-xs tracking-widest uppercase text-charcoal-500 hover:text-charcoal py-3"
        >
          Vazgeç
        </button>
        <Button
          type="button"
          size="md"
          disabled={pending}
          onClick={onRevert}
          className="flex-1 !bg-brass hover:!bg-brass-dark"
        >
          {pending ? "..." : "Onayla ve Geri Al"}
        </Button>
      </div>
    </div>
  );
}
