import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";
import type { AuctionPublic } from "@/lib/types";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Geçersiz JSON" }, { status: 400 });
  }

  try {
    const auction = await backendFetch<AuctionPublic>("/api/v1/auctions", {
      method: "POST",
      body: JSON.stringify(payload),
      authenticated: true,
    });
    return NextResponse.json(auction, { status: 201 });
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
