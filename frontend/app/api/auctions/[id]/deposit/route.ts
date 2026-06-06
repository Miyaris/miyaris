import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

/** POST — kaporayı öde (MVP mock; gerçek POS Faz 2). */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const result = await backendFetch(
      `/api/v1/auctions/${params.id}/deposit`,
      { method: "POST", authenticated: true },
    );
    return NextResponse.json(result, { status: 201 });
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
