import { Container } from "@/components/shared/Container";

import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Şifremi Unuttum" };

export default function ForgotPasswordPage() {
  return (
    <Container size="narrow" className="py-24">
      <div className="text-center mb-12">
        <span className="eyebrow">Hesap Erişimi</span>
        <h1 className="font-display text-4xl mt-4">Şifremi Unuttum</h1>
        <p className="text-sm text-charcoal-500 mt-4 max-w-md mx-auto leading-relaxed">
          Hesabınıza bağlı e-posta adresinizi yazın. Kısa süre içinde size
          özel, bir saat geçerli bir şifre sıfırlama bağlantısı gönderelim.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center mt-10 text-sm text-charcoal-500">
        Şifrenizi hatırladınız mı?{" "}
        <a
          href="/login"
          className="text-charcoal underline-offset-4 hover:text-brass hover:underline"
        >
          Giriş sayfasına dön
        </a>
      </p>
    </Container>
  );
}
