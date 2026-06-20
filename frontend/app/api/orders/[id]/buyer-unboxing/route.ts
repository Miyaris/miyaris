/**
 * POST /api/orders/[id]/buyer-unboxing
 *
 * Alıcı paket açma videosu + mühür durumu beyan eder. seal_intact false
 * ise backend Güvenli Kasa'yı İTİRAZ EDİLDİ durumuna çevirir; admin iade
 * akışını başlatır.
 */
import { NextRequest, NextResponse } from "next/server";

import { backendFetch, ApiError } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Geçersiz istek gövdesi" }, { status: 400 });
  }
  try {
    const updated = await backendFetch(
      `/api/v1/orders/${params.id}/buyer-unboxing`,
      {
        method: "POST",
        body: JSON.stringify(body),
        authenticated: true,
        headers: { "Content-Type": "application/json" },
      },
    );
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { detail: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json({ detail: "Sunucu hatası" }, { status: 500 });
  }
}
