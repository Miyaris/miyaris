import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";
import { setSessionCookies, type TokenPair } from "@/lib/session";
import type { UserPublic } from "@/lib/types";

interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string | null;
}

export async function POST(request: Request) {
  let payload: RegisterPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Geçersiz JSON" }, { status: 400 });
  }

  try {
    // 1. Hesabı oluştur
    await backendFetch<UserPublic>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // 2. Hemen otomatik giriş yap — kayıt → login akışı pürüzsüz olsun
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
      return NextResponse.json({ detail: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { detail: "Beklenmeyen bir hata oluştu" },
      { status: 500 },
    );
  }
}
