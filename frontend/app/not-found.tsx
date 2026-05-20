import Link from "next/link";

import { Container } from "@/components/shared/Container";

export default function NotFound() {
  return (
    <Container size="narrow" className="py-32 text-center">
      <span className="eyebrow">404</span>
      <h1 className="font-display text-5xl mt-4 mb-6">Bulunamadı</h1>
      <p className="text-charcoal-500 mb-12">
        Aradığınız sayfa kaldırılmış veya hiç var olmamış olabilir.
      </p>
      <Link
        href="/"
        className="inline-block border border-charcoal px-8 py-4 text-sm tracking-widest uppercase hover:bg-charcoal hover:text-ivory transition-colors"
      >
        Anasayfaya Dön
      </Link>
    </Container>
  );
}
