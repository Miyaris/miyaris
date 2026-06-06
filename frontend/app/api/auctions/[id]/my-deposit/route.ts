import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

/** GET — bu müzayede için kapora durumum (deposit_paid, required_amount). */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const result = await backendFetch(
      `/api/v1/auctions/${params.id}/my-deposit`,
      { authenticated: true },
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
