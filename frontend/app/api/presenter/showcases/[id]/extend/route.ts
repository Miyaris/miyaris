import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

/**
 * Presenter: müzayedeye +saniye ekle.
 * Body: { seconds?: number } — default 30.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let body: { seconds?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Body opsiyonel — boş gövde geçerli
  }

  const seconds =
    typeof body.seconds === "number" && body.seconds > 0
      ? Math.min(600, Math.floor(body.seconds))
      : 30;

  try {
    const result = await backendFetch(
      `/api/v1/presenter/showcases/${params.id}/extend`,
      {
        method: "POST",
        authenticated: true,
        body: JSON.stringify({ seconds }),
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
