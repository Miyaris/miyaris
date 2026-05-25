import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

/**
 * Admin override: kullanıcının kyc_verified bayrağını set'le.
 *
 * Body: { kyc_verified: boolean }
 *
 * NVI doğrulaması kapalı iken kayıt olmuş kullanıcılar `kyc_verified=False`
 * ile oluşur ve $3000+ teklif veremezler. Bu proxy, admin panelinden tek
 * tıkla True/False yapabilmek için kullanılır.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let body: { kyc_verified?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "Geçersiz JSON gövdesi" },
      { status: 400 },
    );
  }
  if (typeof body.kyc_verified !== "boolean") {
    return NextResponse.json(
      { detail: "kyc_verified alanı boolean olmalı" },
      { status: 400 },
    );
  }

  try {
    const result = await backendFetch(
      `/api/v1/admin/users/${params.id}/set-kyc`,
      {
        method: "POST",
        authenticated: true,
        body: JSON.stringify({ kyc_verified: body.kyc_verified }),
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
