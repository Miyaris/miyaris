/**
 * Sunucu-tarafı backend istemcisi.
 *
 * Bu modül SADECE Server Component'lerde ve Route Handler'larda kullanılmalı —
 * httpOnly cookie'yi okumak için `next/headers`'a ihtiyaç var, browser'da çalışmaz.
 *
 * İstemci component'lerinden API'a ulaşmak için Next.js route handler'ları
 * (örn. /api/auth/login) proxy görevi görüyor.
 */
import { cookies } from "next/headers";

// Backend URL — server-side fetch için. Sırasıyla:
//   1) BACKEND_API_URL  (Vercel server-only env, public değildir)
//   2) NEXT_PUBLIC_API_URL (hem server hem client'tan okunabilen public env)
//   3) localhost fallback (yerel dev)
// NOT: Bu modül yalnızca server bağlamında çalışır (next/headers cookie'leri
// için), ama NEXT_PUBLIC_API_URL'a da düşmesi tek bir Vercel env değişkeniyle
// kurulumu kolaylaştırır.
const BACKEND_URL =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";
const ACCESS_COOKIE = "miyaris_access";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

interface FetchOptions extends RequestInit {
  /** false ise access token cookie'sini eklemeye çalışmaz (public endpoint için) */
  authenticated?: boolean;
}

export async function backendFetch<T>(
  path: string,
  { authenticated = false, headers, ...init }: FetchOptions = {},
): Promise<T> {
  const finalHeaders = new Headers(headers);
  finalHeaders.set("Content-Type", "application/json");

  if (authenticated) {
    const token = cookies().get(ACCESS_COOKIE)?.value;
    if (token) {
      finalHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: finalHeaders,
    cache: "no-store", // auction verisi sürekli değişiyor, ISR/SSG uygun değil
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* JSON değilse default detail */
    }
    throw new ApiError(res.status, detail);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const ACCESS_TOKEN_COOKIE = ACCESS_COOKIE;
export const REFRESH_TOKEN_COOKIE = "miyaris_refresh";
