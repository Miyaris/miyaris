import { LoginForm } from "@/app/(auth)/login/LoginForm";
import { Container } from "@/components/shared/Container";

export const metadata = { title: "Giriş Yap" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <Container size="narrow" className="py-24">
      <div className="text-center mb-16">
        <span className="eyebrow">Hoş geldiniz</span>
        <h1 className="font-display text-4xl mt-4">Giriş Yap</h1>
      </div>
      <LoginForm next={searchParams.next ?? "/"} />
      <p className="text-center mt-8 text-sm text-charcoal-500">
        Henüz hesabınız yok mu?{" "}
        <a
          href="/register"
          className="text-charcoal underline-offset-4 hover:text-brass hover:underline"
        >
          Üye olun
        </a>
      </p>
    </Container>
  );
}
