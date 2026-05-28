import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

/** POST — oturuma saat lot'u ekle. */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "Geçersiz JSON gövdesi" },
      { status: 400 },
    );
  }
  try {
    const result = await backendFetch(
      `/api/v1/presenter/sessions/${params.id}/lots`,
      {
        method: "POST",
        authenticated: true,
        body: JSON.stringify(body),
      },
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
