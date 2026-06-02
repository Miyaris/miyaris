import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

/**
 * Admin: kullanıcıyı pasifleştir / aktif et (soft delete).
 * Body: { is_active: boolean }
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let body: { is_active?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "Geçersiz JSON gövdesi" },
      { status: 400 },
    );
  }
  if (typeof body.is_active !== "boolean") {
    return NextResponse.json(
      { detail: "is_active alanı boolean olmalı" },
      { status: 400 },
    );
  }
  try {
    const result = await backendFetch(
      `/api/v1/admin/users/${params.id}/set-active`,
      {
        method: "POST",
        authenticated: true,
        body: JSON.stringify({ is_active: body.is_active }),
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
