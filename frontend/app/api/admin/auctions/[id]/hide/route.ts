import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

/**
 * Admin: müzayedeyi sayfadan gizle (soft-hide).
 * Public listelerden ve detay sayfasından kaybolur; admin 'Gizli' sekmesinde
 * görür ve istenirse geri getirir. Teklif/escrow korunur.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const result = await backendFetch(
      `/api/v1/admin/auctions/${params.id}/hide`,
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
