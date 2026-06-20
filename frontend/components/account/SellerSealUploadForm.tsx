"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Satıcı kargo öncesi kurcalama izi gösteren mühürlü kutu fotoğrafı
 * yükleme akışı.
 *
 * İki adım:
 *  1. Dosya seç → /api/upload → Vercel Blob'a kaydedilir, kalıcı URL döner
 *  2. URL'i /api/orders/[id]/seller-seal-photo'ya POST → escrow güncellenir
 *
 * Tekrar yükleme izinli (üzerine yazılır). Fotoğraf görünür durumda olunca
 * "yenile" düğmesi ile yeni bir fotoğraf yüklenebilir.
 */
export function SellerSealUploadForm({
  escrowId,
  existingPhotoUrl,
}: {
  escrowId: string;
  existingPhotoUrl: string | null;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replaceMode, setReplaceMode] = useState(!existingPhotoUrl);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setPending(true);

    try {
      // 1) Vercel Blob'a yükle
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });
      const upData = await upRes.json().catch(() => ({}));
      if (!upRes.ok) {
        setError(upData?.detail ?? "Yükleme başarısız");
        return;
      }
      const photoUrl: string = upData.url;

      // 2) Backend'e bildir
      const beRes = await fetch(
        `/api/orders/${escrowId}/seller-seal-photo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo_url: photoUrl }),
        },
      );
      const beData = await beRes.json().catch(() => ({}));
      if (!beRes.ok) {
        setError(beData?.detail ?? "Kaydetme başarısız");
        return;
      }
      setFile(null);
      setReplaceMode(false);
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  // Yükleme yapılmış ve değiştirme modu kapalıysa: önizleme + yenile düğmesi
  if (existingPhotoUrl && !replaceMode) {
    return (
      <div className="border border-line bg-ivory p-5">
        <p className="text-[10px] tracking-[0.4em] uppercase text-brass-dark mb-3">
          Mühürlü Kutu Fotoğrafı
        </p>
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={existingPhotoUrl}
            alt="Mühürlü kutu"
            className="w-32 h-32 object-cover border border-line bg-ivory-200"
          />
          <div className="flex-1">
            <p className="text-sm text-charcoal leading-relaxed">
              Fotoğraf yüklendi. Alıcının paket açma sürecinde mühür
              karşılaştırması için saklanıyor.
            </p>
            <button
              type="button"
              onClick={() => setReplaceMode(true)}
              className="mt-3 text-xs tracking-[0.3em] uppercase text-brass-dark hover:text-brass border-b border-brass/40 pb-0.5"
            >
              Yeniden Yükle
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="border border-line bg-ivory p-5">
      <p className="text-[10px] tracking-[0.4em] uppercase text-brass-dark mb-3">
        Mühürlü Kutu Fotoğrafı
      </p>
      <p className="text-sm text-charcoal-700 leading-relaxed mb-4">
        Saati kargoya vermeden önce, kutuya kurcalama izi gösteren mühürü
        uygula. Mührün ve kutunun fotoğrafını çek, aşağıdaki düğmeyle yükle.
        Alıcı paketi açarken mühür durumunu beyan eder; kırıksa iade akışı
        otomatik tetiklenir.
      </p>

      <div className="flex items-center gap-4 flex-wrap">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={pending}
            className="block w-full text-sm text-charcoal-700
              file:mr-4 file:py-2 file:px-4 file:border file:border-line
              file:bg-ivory-100 file:text-xs file:tracking-widest file:uppercase
              file:text-charcoal hover:file:bg-ivory-200
              disabled:opacity-50"
          />
        </label>
        {file && (
          <button
            type="submit"
            disabled={pending}
            className="bg-charcoal hover:bg-charcoal-700 text-ivory px-6 py-2.5 text-xs tracking-[0.3em] uppercase disabled:opacity-50"
          >
            {pending ? "Yükleniyor..." : "Fotoğrafı Yükle"}
          </button>
        )}
        {existingPhotoUrl && replaceMode && !file && (
          <button
            type="button"
            onClick={() => setReplaceMode(false)}
            className="text-xs tracking-[0.3em] uppercase text-charcoal-500 hover:text-charcoal"
          >
            Vazgeç
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-burgundy border-l-2 border-burgundy pl-3 py-1">
          {error}
        </p>
      )}
    </form>
  );
}
