import Link from "next/link";

import { Container } from "@/components/shared/Container";

export const metadata = { title: "E-posta Doğrulama" };
export const dynamic = "force-dynamic";

interface VerifyResult {
  ok: boolean;
  status: number;
  email?: string;
  message?: string;
}

async function verifyTokenServerSide(token: string): Promise<VerifyResult> {
  const BACKEND =
    process.env.BACKEND_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000";
  try {
    const res = await fetch(
      `${BACKEND}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`,
      { method: "GET", cache: "no-store" },
    );
    const body = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      status: res.status,
      email: body?.email,
      message:
        body?.message ??
        (typeof body?.detail === "string"
          ? body.detail
          : body?.detail?.message),
    };
  } catch {
    return { ok: false, status: 0, message: "Sunucuya ulaşılamadı" };
  }
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = (searchParams.token ?? "").trim();

  if (!token) {
    return (
      <Container size="narrow" className="py-24">
        <ResultCard
          variant="error"
          title="Geçersiz Link"
          body="Bu sayfa yalnızca kayıt e-postanızdaki doğrulama linki üzerinden açılabilir. Doğrulama linki olmadan erişim sağlanamaz."
        />
      </Container>
    );
  }

  const result = await verifyTokenServerSide(token);

  if (result.ok) {
    return (
      <Container size="narrow" className="py-24">
        <ResultCard
          variant="success"
          title="E-postanız Doğrulandı"
          body={
            result.email
              ? `${result.email} adresi başarıyla doğrulandı. Artık tüm Miyaris vitrinlerine erişiminiz var. Hoş geldiniz mailimiz de yolda — birkaç dakika içinde kutunuza düşecek.`
              : "E-posta adresiniz başarıyla doğrulandı."
          }
          cta={{ href: "/login", label: "Giriş Yap" }}
        />
      </Container>
    );
  }

  return (
    <Container size="narrow" className="py-24">
      <ResultCard
        variant="error"
        title="Doğrulama Başarısız"
        body={
          result.message ??
          "Bu link geçersiz veya süresi dolmuş olabilir. Lütfen giriş sayfasından yeni bir doğrulama linki talep edin."
        }
        cta={{ href: "/login", label: "Giriş Sayfasına Dön" }}
      />
    </Container>
  );
}

function ResultCard({
  variant,
  title,
  body,
  cta,
}: {
  variant: "success" | "error";
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  const accent = variant === "success" ? "text-brass" : "text-burgundy";
  const eyebrow = variant === "success" ? "Doğrulandı" : "Doğrulanamadı";

  return (
    <div className="text-center">
      <span className={`eyebrow ${accent}`}>{eyebrow}</span>
      <h1 className="font-display text-4xl mt-4 mb-6">{title}</h1>
      <p className="text-charcoal-700 leading-relaxed max-w-xl mx-auto">
        {body}
      </p>
      {cta && (
        <div className="mt-10">
          <Link
            href={cta.href}
            className="inline-block px-8 py-3 text-xs uppercase tracking-[0.2em] bg-charcoal text-cream hover:bg-charcoal/90"
          >
            {cta.label}
          </Link>
        </div>
      )}
    </div>
  );
}
