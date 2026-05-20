/**
 * Session utility'leri — sadece sunucu tarafında çalışır.
 * httpOnly cookie'yi yönetir.
 */
import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, backendFetch } from "@/lib/api";
import type { UserPublic } from "@/lib/types";

const ACCESS_TOKEN_MAX_AGE = 60 * 30; // 30 dk — backend ile uyumlu
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 14; // 14 gün

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export function setSessionCookies(tokens: TokenPair) {
  const jar = cookies();
  const isProd = process.env.NODE_ENV === "production";

  jar.set(ACCESS_TOKEN_COOKIE, tokens.access_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  jar.set(REFRESH_TOKEN_COOKIE, tokens.refresh_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

export function clearSessionCookies() {
  const jar = cookies();
  jar.delete(ACCESS_TOKEN_COOKIE);
  jar.delete(REFRESH_TOKEN_COOKIE);
}

export function isLoggedIn(): boolean {
  return Boolean(cookies().get(ACCESS_TOKEN_COOKIE)?.value);
}

/**
 * Mevcut kullanıcıyı backend'den çek. Token geçersizse null döner
 * — sayfa kullanıcısının session'ı bozuksa redirect mantığı sayfada.
 */
export async function getCurrentUser(): Promise<UserPublic | null> {
  if (!isLoggedIn()) return null;
  try {
    return await backendFetch<UserPublic>("/api/v1/auth/me", {
      authenticated: true,
    });
  } catch {
    return null;
  }
}
