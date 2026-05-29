import { NextResponse } from "next/server";

import { ApiError, backendFetch } from "@/lib/api";

/**
 * Kayıt proxy — sadece backend'e POST forward. **Otomatik login YAPMA**:
 * kullanıcı henüz e-posta doğrulamamış (is_verified=false), backend login
 * isteğini reddeder ve hata kayıt başarısız gibi görünür. Onun yerine
 * frontend başarılı kayıttan sonra `/check-email` sayfasına yönlendirir;
 * kullanıcı maildeki linke tıklayınca is_verified=true olur, ardından
 * normal login akışı işler.
 *
 * Body: backend `UserCreate` ile aynı — first_name, last_name, birth_year,
 * email, password, phone, tc_kimlik_no, mersis_no.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Geçersiz JSON" }, { status: 400 });
  }

  try {
    const user = await backendFetch("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return NextResponse.json(user, { status: 201 });
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
