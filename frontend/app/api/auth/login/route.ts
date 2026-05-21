import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";
import { setSessionCookies, type TokenPair } from "@/lib/session";

export async function POST(request: Request) {
  let payload: { email?: string; password?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Geçersiz JSON" }, { status: 400 });
  }

  if (!payload.email || !payload.password) {
    return NextResponse.json(
      { detail: "E-posta ve şifre zorunlu" },
      { status: 400 },
    );
  }

  try {
    const tokens = await backendFetch<TokenPair>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
      }),
    });
    setSessionCookies(tokens);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json(
        { detail: e.message, code: e.code },
        { status: e.status },
      );
    }
    return NextResponse.json(
      { detail: "Beklenmeyen bir hata oluştu" },
      { status: 500 },
    );
  }
}
