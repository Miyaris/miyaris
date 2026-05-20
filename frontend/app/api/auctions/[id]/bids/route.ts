import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";
import type { BidPublic } from "@/lib/types";

interface BidPayload {
  amount: string;
  is_proxy?: boolean;
  max_proxy_amount?: string | null;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let payload: BidPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Geçersiz JSON" }, { status: 400 });
  }

  try {
    const bid = await backendFetch<BidPublic>(
      `/api/v1/auctions/${params.id}/bids`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        authenticated: true,
      },
    );
    return NextResponse.json(bid, { status: 201 });
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
