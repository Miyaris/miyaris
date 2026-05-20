import { RegisterForm } from "@/app/(auth)/register/RegisterForm";
import { Container } from "@/components/shared/Container";

export const metadata = { title: "Üye Ol" };

export default function RegisterPage() {
  return (
    <Container size="narrow" className="py-24">
      <div className="text-center mb-16">
        <span className="eyebrow">Miyaris'e katıl</span>
        <h1 className="font-display text-4xl mt-4">Üye Ol</h1>
      </div>
      <RegisterForm />
      <p className="text-center mt-8 text-sm text-charcoal-500">
        Zaten hesabınız var mı?{" "}
        <a
          href="/login"
          className="text-charcoal underline-offset-4 hover:text-brass hover:underline"
        >
          Giriş yapın
        </a>
      </p>
    </Container>
  );
}
