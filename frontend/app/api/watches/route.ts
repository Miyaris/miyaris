import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";
import type { WatchPublic } from "@/lib/types";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Geçersiz JSON" }, { status: 400 });
  }

  try {
    const watch = await backendFetch<WatchPublic>("/api/v1/watches", {
      method: "POST",
      body: JSON.stringify(payload),
      authenticated: true,
    });
    return NextResponse.json(watch, { status: 201 });
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
