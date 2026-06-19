/**
 * PATCH /api/presenter/sessions/[id]
 *
 * Sunucu (presenter) oturumun ad / tarih-saat / açıklama alanlarını
 * günceller. Yalnızca PLANNING durumundaki oturum değiştirilebilir
 * (backend 409 atar aksi halde).
 */
import { NextRequest, NextResponse } from "next/server";

import { backendFetch, ApiError } from "@/lib/api";

export async function PATCH(
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
      `/api/v1/presenter/sessions/${params.id}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
        authenticated: true,
        headers: { "Content-Type": "application/json" },
      },
    );
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { detail: err.detail ?? err.message },
        { status: err.status },
      );
    }
    return NextResponse.json({ detail: "Sunucu hatası" }, { status: 500 });
  }
}
