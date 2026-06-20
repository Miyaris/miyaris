import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { isLoggedIn } from "@/lib/session";

// Tek bir dosyayı Vercel Blob'a yükler ve public URL döner.
//
// Akış:
//   1. Auth zorunlu — sadece giriş yapmış kullanıcılar upload edebilir
//      (kaynak suistimalini engellemek için).
//   2. multipart/form-data → `file` field'ında dosya beklenir.
//   3. Dosya boyutu / tipi kontrolleri (image_* veya application/pdf).
//   4. Vercel Blob `put()` → public URL döner; bu URL backend'e direkt
//      `image_urls[]` veya `pdf_url` olarak gönderilir.
//
// Production'da BLOB_READ_WRITE_TOKEN env'i Vercel projesinin Storage
// sekmesinden Blob store oluşturulduğunda otomatik enjekte edilir.

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB (60 sn paket açma)

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const ALLOWED_PDF_TYPES = new Set(["application/pdf"]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",   // mov (iPhone)
  "video/webm",
]);

export async function POST(request: Request): Promise<NextResponse> {
  if (!isLoggedIn()) {
    return NextResponse.json(
      { detail: "Bu işlem için giriş gerekli" },
      { status: 401 },
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        detail:
          "Dosya depolaması henüz yapılandırılmamış. Yönetici Vercel " +
          "Blob bağlantısını henüz kurmamış olabilir.",
      },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { detail: "Geçersiz form verisi" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { detail: "Dosya seçilmedi" },
      { status: 400 },
    );
  }

  // Tip + boyut doğrulama
  const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
  const isPdf = ALLOWED_PDF_TYPES.has(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.has(file.type);
  if (!isImage && !isPdf && !isVideo) {
    return NextResponse.json(
      {
        detail:
          "Sadece görsel (JPG, PNG, WEBP, HEIC), PDF veya video (MP4, MOV, WEBM) dosyaları yüklenebilir",
      },
      { status: 415 },
    );
  }
  const maxBytes = isImage
    ? MAX_IMAGE_BYTES
    : isPdf
      ? MAX_PDF_BYTES
      : MAX_VIDEO_BYTES;
  if (file.size > maxBytes) {
    const limitMB = (maxBytes / 1024 / 1024).toFixed(0);
    return NextResponse.json(
      { detail: `Dosya çok büyük (en fazla ${limitMB} MB)` },
      { status: 413 },
    );
  }

  // Vercel Blob'a yükle. Dizin önekini dosya tipine göre seçiyoruz:
  // `watches/`, `certificates/` veya `unboxing/`. Blob panelinde gözle
  // ayırmayı kolaylaştırır.
  const prefix = isPdf
    ? "certificates"
    : isVideo
      ? "unboxing"
      : "watches";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) ||
    "file";

  try {
    const blob = await put(`${prefix}/${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      contentType: file.type,
      size: file.size,
    });
  } catch (err) {
    console.error("[upload] Vercel Blob hatası", err);
    return NextResponse.json(
      { detail: "Dosya yüklenirken bir hata oluştu" },
      { status: 500 },
    );
  }
}
