import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

/**
 * Admin: kullanıcıyı DB'den kalıcı sil (hard delete).
 *
 * Backend FK koruması: bid geçmişi veya aktif escrow varsa 409 döner.
 * Test hesaplarını temizlemek için tasarlandı.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await backendFetch(`/api/v1/admin/users/${params.id}`, {
      method: "DELETE",
      authenticated: true,
    });
    return new NextResponse(null, { status: 204 });
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
