import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

const ALLOWED_ACTIONS = new Set([
  "mark-received",
  "authenticate",
  "mark-shipped",
  "mark-delivered",
  "release",
  "refund",
]);

export async function POST(
  _request: Request,
  { params }: { params: { id: string; action: string } },
) {
  if (!ALLOWED_ACTIONS.has(params.action)) {
    return NextResponse.json(
      { detail: "Geçersiz aksiyon" },
      { status: 400 },
    );
  }

  try {
    const result = await backendFetch(
      `/api/v1/admin/escrow/${params.id}/${params.action}`,
      {
        method: "POST",
        body: JSON.stringify({}),
        authenticated: true,
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
