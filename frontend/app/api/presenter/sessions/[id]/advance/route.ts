import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const result = await backendFetch(
      `/api/v1/presenter/sessions/${params.id}/advance`,
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
