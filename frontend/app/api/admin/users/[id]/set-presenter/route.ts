import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

/**
 * Admin override: kullanıcının is_presenter bayrağını set'le.
 *
 * Body: { is_presenter: boolean }
 *
 * Presenter yetkili kullanıcılar `/presenter/*` canlı müzayede sunucu
 * paneline erişebilir. Rol'den bağımsız bir yetki; admin paneli üzerinden
 * tek-tıkla verilir veya geri çekilir.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let body: { is_presenter?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "Geçersiz JSON gövdesi" },
      { status: 400 },
    );
  }
  if (typeof body.is_presenter !== "boolean") {
    return NextResponse.json(
      { detail: "is_presenter alanı boolean olmalı" },
      { status: 400 },
    );
  }

  try {
    const result = await backendFetch(
      `/api/v1/admin/users/${params.id}/set-presenter`,
      {
        method: "POST",
        authenticated: true,
        body: JSON.stringify({ is_presenter: body.is_presenter }),
      },
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ detail: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { detail: "Beklenmeyen bir hata oluştu" },
      { status: 500 },
    );
  }
}
