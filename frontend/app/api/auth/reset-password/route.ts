import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

export async function POST(request: Request) {
  let payload: { token?: string; new_password?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Geçersiz JSON" }, { status: 400 });
  }

  if (!payload.token || !payload.new_password) {
    return NextResponse.json(
      { detail: "Token ve yeni şifre zorunlu" },
      { status: 400 },
    );
  }

  try {
    const data = await backendFetch<{ email: string; message: string }>(
      "/api/v1/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({
          token: payload.token,
          new_password: payload.new_password,
        }),
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
