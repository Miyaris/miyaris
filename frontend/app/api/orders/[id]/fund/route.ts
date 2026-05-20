import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";
import type { EscrowDetail } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    /* no body OK */
  }

  try {
    const result = await backendFetch<EscrowDetail>(
      `/api/v1/orders/${params.id}/fund`,
      {
        method: "POST",
        body: JSON.stringify(payload ?? {}),
        authenticated: true,
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
