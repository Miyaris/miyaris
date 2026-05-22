import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

export async function POST(request: Request) {
  let payload: { email?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Geçersiz JSON" }, { status: 400 });
  }

  if (!payload.email) {
    return NextResponse.json({ detail: "E-posta zorunlu" }, { status: 400 });
  }

  try {
    const data = await backendFetch<{ message: string }>(
      "/api/v1/auth/forgot-password",
      {
        method: "POST",
        body: JSON.stringify({ email: payload.email }),
      },
    );
    return NextResponse.json(data);
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
