import { NextResponse, type NextRequest } from "next/server";

import { ACCESS_TOKEN_COOKIE } from "@/lib/api";

/**
 * Auth middleware — login gerektiren rotaları koruyup `/login`'e yönlendirir.
 *
 * httpOnly cookie sadece varlığını sorguluyoruz, içeriğine erişmiyoruz; gerçek
 * doğrulama backend'de `get_current_user` dependency'si tarafından yapılıyor.
 * Bu middleware sadece UX'i güzelleştiriyor (kullanıcı login sayfasına otomatik
 * yönlenir).
 */

const PROTECTED_PREFIXES = ["/sell", "/sell-watch", "/account", "/admin"];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const needsAuth = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const hasToken = request.cookies.has(ACCESS_TOKEN_COOKIE);
  if (hasToken) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", path + (request.nextUrl.search || ""));
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/sell/:path*",
    "/sell-watch/:path*",
    "/sell-watch",
    "/account/:path*",
    "/admin/:path*",
  ],
};
