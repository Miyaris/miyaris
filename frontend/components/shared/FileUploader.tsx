"use client";

import { useId, useRef, useState } from "react";

interface Props {
  /** Hangi MIME tipleri kabul edilsin */
  accept: string;
  /** Birden fazla dosya seçimi */
  multiple?: boolean;
  /** Mobile cihazlarda direkt kamera açılsın mı? */
  capture?: "user" | "environment";
  /** Buton metni */
  label: string;
  /** Yükleme bittikten sonra tetiklenir; backend'in döndüğü her URL için bir kez */
  onUploaded: (url: string) => void;
  /** Sürüm/disabled */
  disabled?: boolean;
}

/**
 * Premium dosya yükleme komponenti.
 *   - Click → native dosya seçici (Mac/Windows file picker, mobile foto/galeri)
 *   - Mobil cihazlarda `capture` set'liyse kamera direkt açılır
 *   - Drag & drop desktop'ta çalışır
 *   - Yükleme sırasında progress + hata feedback'i
 *
 * Seçilen her dosya tek tek `/api/upload`'a POST edilir, dönen `url` değeri
 * `onUploaded` callback'i ile parent'a verilir.
 */
export function FileUploader({
  accept,
  multiple = false,
  capture,
  label,
  onUploaded,
  disabled,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function uploadOne(file: File): Promise<void> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.detail ?? "Yükleme başarısız");
    }
    if (typeof data?.url !== "string") {
      throw new Error("Sunucu geçersiz cevap döndü");
    }
    onUploaded(data.url);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const list = Array.from(files);
      // Sırayla yükle — Vercel Blob paralelde 5+ istekte rate-limit verebilir,
      // ayrıca sıralı yükleme önceki sıranın korunmasını sağlar.
      for (const file of list) {
        await uploadOne(file);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bir hata oluştu";
      setError(msg);
    } finally {
      setBusy(false);
      // Aynı dosyayı tekrar seçebilmek için input'u resetle
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled || busy) return;
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          "flex flex-col items-center justify-center gap-2 cursor-pointer",
          "border-2 border-dashed py-8 px-6 text-center transition-colors",
          dragOver
            ? "border-brass bg-brass/5"
            : "border-line bg-ivory-50 hover:border-charcoal-300",
          (disabled || busy) && "opacity-60 cursor-not-allowed",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          capture={capture}
          disabled={disabled || busy}
          onChange={(e) => handleFiles(e.target.files)}
          className="sr-only"
        />
        <span className="eyebrow text-brass-dark">
          {busy ? "Yükleniyor..." : label}
        </span>
        <span className="text-xs text-charcoal-500 leading-relaxed max-w-xs">
          Dosyaları buraya sürükleyin veya seçmek için tıklayın. Telefondan
          fotoğraf çekip ekleyebilirsiniz.
        </span>
      </label>
      {error && (
        <p className="mt-3 text-xs text-burgundy border-l-2 border-burgundy pl-3 leading-relaxed">
          {error}
        </p>
      )}
    </div>
  );
}
