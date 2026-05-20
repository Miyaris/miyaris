import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";
import type { WatchPublic } from "@/lib/types";

/**
 * Miyaris Mağaza — DIRECT_SALE saat için satın alma proxy'si.
 *
 * Slug → watch_id çevirimini sunucu tarafında yaparız ki frontend POST
 * payload'unda sadece teslimat/ödeme bilgilerini taşısın. Backend
 * `/api/v1/watches/{id}/buy` çağrılır; cookie auth backendFetch ile geçer.
 */
export async function POST(
  request: Request,
  { params }: { params: { slug: string } },
) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Geçersiz JSON" }, { status: 400 });
  }

  try {
    // Slug → id
    const watch = await backendFetch<WatchPublic>(
      `/api/v1/watches/by-slug/${encodeURIComponent(params.slug)}`,
    );

    const escrow = await backendFetch<unknown>(
      `/api/v1/watches/${watch.id}/buy`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        authenticated: true,
      },
    );
    return NextResponse.json(escrow, { status: 201 });
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
