import Link from "next/link";

import { Container } from "@/components/shared/Container";

import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Yeni Şifre Belirle" };

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = (searchParams.token ?? "").trim();

  if (!token) {
    return (
      <Container size="narrow" className="py-24 text-center">
        <span className="eyebrow text-burgundy">Geçersiz Link</span>
        <h1 className="font-display text-4xl mt-4 mb-6">
          Sıfırlama Linki Bulunamadı
        </h1>
        <p className="text-charcoal-700 leading-relaxed max-w-md mx-auto">
          Bu sayfa yalnızca size gönderilen şifre sıfırlama e-postasındaki
          bağlantı üzerinden açılabilir. Yeni bir sıfırlama bağlantısı talep
          edebilirsiniz.
        </p>
        <div className="mt-10">
          <Link
            href="/forgot-password"
            className="inline-block px-8 py-3 text-xs uppercase tracking-[0.2em] bg-charcoal text-cream hover:bg-charcoal/90"
          >
            Yeni Bağlantı Talep Et
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container size="narrow" className="py-24">
      <div className="text-center mb-12">
        <span className="eyebrow">Yeni Şifre</span>
        <h1 className="font-display text-4xl mt-4">Şifrenizi Yenileyin</h1>
        <p className="text-sm text-charcoal-500 mt-4 max-w-md mx-auto leading-relaxed">
          Hesabınız için yeni bir şifre belirleyin. Güvenliğiniz için
          tahmin edilmesi zor bir şifre seçin.
        </p>
      </div>
      <ResetPasswordForm token={token} />
    </Container>
  );
}
