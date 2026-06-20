"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { EscrowDetail } from "@/lib/types";

/**
 * Alıcı paket açma videosu + mühür durumu beyan akışı.
 *
 * Adımlar:
 *  1. Paket açma videosu (60 sn, MP4/MOV/WEBM, ≤100 MB) seç
 *  2. Mühür durumunu beyan et (sağlam / kırık)
 *  3. /api/upload üzerinden Vercel Blob'a yükle
 *  4. URL + mühür durumunu backend'e POST et
 *
 * Mühür "kırık" seçilirse iade akışı otomatik tetiklenir; bu nedenle
 * alıcıdan ek onay alınır (geri alınamaz işlem).
 */
export function BuyerUnboxingForm({
  escrow,
}: {
  escrow: EscrowDetail;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [sealIntact, setSealIntact] = useState<boolean | null>(null);
  const [confirmBroken, setConfirmBroken] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingVideo = escrow.buyer_unboxing_video_url;
  const existingSealIntact = escrow.seal_intact;

  // Beyan zaten yapıldıysa: özet kart + yeniden gönderme açıklaması
  if (existingVideo && existingSealIntact !== null) {
    return (
      <div className="border border-line bg-ivory p-5">
        <p className="text-[10px] tracking-[0.4em] uppercase text-brass-dark mb-3">
          Paket Açma Beyanı
        </p>
        <div className="flex items-start gap-4">
          <video
            src={existingVideo}
            controls
            className="w-48 border border-line bg-ivory-200"
            preload="metadata"
          />
          <div className="flex-1">
            {existingSealIntact ? (
              <p className="text-sm text-olive font-medium">
                ✓ Mühür sağlam olarak işaretlendi
              </p>
            ) : (
              <p className="text-sm text-burgundy font-medium">
                ✗ Mühür kırık olarak işaretlendi — itiraz açıldı
              </p>
            )}
            <p className="text-xs text-charcoal-500 leading-relaxed mt-2">
              Beyanınız kayıt altına alındı. Değişiklik gerekiyorsa Miyaris
              destek ekibiyle iletişime geçin.
            </p>
          </div>
        </div>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || sealIntact === null) {
      setError("Lütfen video seçin ve mühür durumunu işaretleyin");
      return;
    }
    // Kırık seçildiyse alıcının onayını iste
    if (sealIntact === false && !confirmBroken) {
      setError(
        'Mühürü "kırık" olarak işaretlemek itiraz açar. Lütfen aşağıdaki onay kutusunu işaretleyin.',
      );
      return;
    }

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
      const videoUrl: string = upData.url;

      // 2) Backend'e bildir
      const beRes = await fetch(
        `/api/orders/${escrow.id}/buyer-unboxing`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            video_url: videoUrl,
            seal_intact: sealIntact,
          }),
        },
      );
      const beData = await beRes.json().catch(() => ({}));
      if (!beRes.ok) {
        setError(beData?.detail ?? "Kaydetme başarısız");
        return;
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  const sellerSealUrl = escrow.seller_seal_photo_url;

  return (
    <form onSubmit={onSubmit} className="border border-line bg-ivory p-5">
      <p className="text-[10px] tracking-[0.4em] uppercase text-brass-dark mb-3">
        Paket Açma Beyanı
      </p>
      <p className="text-sm text-charcoal-700 leading-relaxed mb-4">
        Paketi açarken 60 saniyelik kısa bir video çekin. Mühürün durumunu
        gösteren bir an mutlaka videoda yer almalı. Beyanınız ekspertiz
        sürecinde delil değerindedir.
      </p>

      {sellerSealUrl && (
        <div className="mb-5 p-4 bg-ivory-100 border border-line">
          <p className="text-[10px] tracking-[0.3em] uppercase text-charcoal-500 mb-2">
            Satıcı Tarafından Yüklenen Mühür Fotoğrafı
          </p>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sellerSealUrl}
              alt="Satıcı mühürü"
              className="w-24 h-24 object-cover border border-line"
            />
            <p className="text-xs text-charcoal-700 leading-relaxed flex-1">
              Karşılaştırma için satıcının kargoya verdiği mühür fotoğrafı.
              Paketi açarken eşleştiğinden emin olun.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-5">
        <label className="block">
          <span className="text-[10px] tracking-[0.3em] uppercase text-charcoal-500 mb-2 block">
            Paket Açma Videosu (MP4, MOV veya WEBM, en fazla 100 MB)
          </span>
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={pending}
            className="block w-full text-sm text-charcoal-700
              file:mr-4 file:py-2 file:px-4 file:border file:border-line
              file:bg-ivory-100 file:text-xs file:tracking-widest file:uppercase
              file:text-charcoal hover:file:bg-ivory-200
              disabled:opacity-50"
          />
        </label>

        <div>
          <span className="text-[10px] tracking-[0.3em] uppercase text-charcoal-500 mb-2 block">
            Mühür Durumu
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setSealIntact(true);
                setConfirmBroken(false);
              }}
              disabled={pending}
              className={`text-left p-4 border-2 transition-colors ${
                sealIntact === true
                  ? "border-olive bg-olive/10"
                  : "border-line bg-ivory hover:bg-ivory-100"
              }`}
            >
              <p
                className={`font-medium text-sm ${
                  sealIntact === true ? "text-olive" : "text-charcoal"
                }`}
              >
                Mühür sağlam
              </p>
              <p className="text-xs text-charcoal-500 mt-1 leading-relaxed">
                Kutu kapalı geldi, mühür çıkartılmamış. Akış normal devam eder.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setSealIntact(false)}
              disabled={pending}
              className={`text-left p-4 border-2 transition-colors ${
                sealIntact === false
                  ? "border-burgundy bg-burgundy/10"
                  : "border-line bg-ivory hover:bg-ivory-100"
              }`}
            >
              <p
                className={`font-medium text-sm ${
                  sealIntact === false ? "text-burgundy" : "text-charcoal"
                }`}
              >
                Mühür kırık
              </p>
              <p className="text-xs text-charcoal-500 mt-1 leading-relaxed">
                Mühür bozulmuş, kutu önceden açılmış olabilir. İtiraz açılır.
              </p>
            </button>
          </div>
        </div>

        {sealIntact === false && (
          <label className="flex items-start gap-3 cursor-pointer p-4 border border-burgundy/30 bg-burgundy/5">
            <input
              type="checkbox"
              checked={confirmBroken}
              onChange={(e) => setConfirmBroken(e.target.checked)}
              disabled={pending}
              className="mt-1 shrink-0"
            />
            <span className="text-sm text-charcoal leading-relaxed">
              Mühürün kırık olduğunu beyan ediyorum. Bu beyan itiraz açar,
              geri alınamaz. Miyaris ekspertiz ekibi süreci yönetir; para
              hesaplarda emanette kalır.
            </span>
          </label>
        )}
      </div>

      {error && (
        <p className="mt-5 text-sm text-burgundy border-l-2 border-burgundy pl-3 py-1">
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={pending || !file || sealIntact === null}
          className="bg-charcoal hover:bg-charcoal-700 text-ivory px-8 py-3 text-xs tracking-[0.3em] uppercase disabled:opacity-50"
        >
          {pending ? "Yükleniyor..." : "Beyanı Gönder"}
        </button>
      </div>
    </form>
  );
}
