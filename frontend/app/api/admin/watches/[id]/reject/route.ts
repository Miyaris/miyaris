import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Geçersiz JSON" }, { status: 400 });
  }

  try {
    const result = await backendFetch(
      `/api/v1/admin/watches/${params.id}/reject`,
      {
        method: "POST",
        body: JSON.stringify(payload),
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
