/**
 * POST /api/orders/[id]/seller-seal-photo
 *
 * Satıcı kurcalama izi gösteren mühürlü kutu fotoğrafını yükler. Önce
 * /api/upload üzerinden Vercel Blob'a yüklenmiş olur; dönen kalıcı URL
 * burada backend'e POST edilir.
 */
import { NextRequest, NextResponse } from "next/server";

import { backendFetch, ApiError } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Geçersiz istek gövdesi" }, { status: 400 });
  }
  try {
    const updated = await backendFetch(
      `/api/v1/orders/${params.id}/seller-seal-photo`,
      {
        method: "POST",
        body: JSON.stringify(body),
        authenticated: true,
        headers: { "Content-Type": "application/json" },
      },
    );
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { detail: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json({ detail: "Sunucu hatası" }, { status: 500 });
  }
}
