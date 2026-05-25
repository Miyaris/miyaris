import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

/**
 * Admin: müzayedeyi iptal et. Satıcı sahiplik kontrolü atlanır, LIVE
 * müzayede de iptal edilebilir. ENDED/COMPLETED bloklanır.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const result = await backendFetch(
      `/api/v1/admin/auctions/${params.id}/cancel`,
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
