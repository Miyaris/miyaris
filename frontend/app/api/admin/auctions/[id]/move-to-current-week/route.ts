import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

/**
 * Admin: müzayedeyi bu haftanın penceresine (Pazartesi 00:00 → Pazar
 * 23:59:59 Europe/Istanbul) çek. starts_at geçmişte ise backend status'u
 * anında LIVE'a alır.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const result = await backendFetch(
      `/api/v1/admin/auctions/${params.id}/move-to-current-week`,
      { method: "POST", authenticated: true },
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
