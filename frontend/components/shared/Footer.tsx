import Link from "next/link";

import { Container } from "@/components/shared/Container";

export function Footer() {
  return (
    <footer className="mt-32 border-t border-line">
      <Container className="py-16 grid md:grid-cols-4 gap-12">
        <div>
          <div className="font-display text-xl mb-4">Miyaris</div>
          <p className="text-sm text-charcoal-500 leading-relaxed max-w-xs">
            Türkiye'nin sertifikalı lüks saat açık artırma platformu. Her parça,
            uzmanlarımız tarafından fiziksel olarak doğrulanır.
          </p>
        </div>

        <FooterColumn
          title="Platform"
          links={[
            { href: "/auctions", label: "Müzayedeler" },
            { href: "/shop", label: "Miyaris Mağaza" },
            { href: "/sell-watch", label: "Saatinizi Satın" },
            { href: "/how-it-works", label: "Nasıl Çalışır" },
          ]}
        />
        <FooterColumn
          title="Güven"
          links={[
            { href: "/authentication", label: "Sertifikasyon Süreci" },
            { href: "/escrow", label: "Emanet Hesabı" },
            { href: "/experts", label: "Uzmanlarımız" },
          ]}
        />
        <FooterColumn
          title="Yasal"
          links={[
            { href: "/terms", label: "Kullanım Koşulları" },
            { href: "/privacy", label: "Gizlilik" },
            { href: "/contact", label: "İletişim" },
          ]}
        />
      </Container>
      <div className="border-t border-line">
        <Container className="py-6 flex justify-between items-center text-xs text-charcoal-300">
          <span>© {new Date().getFullYear()} Miyaris</span>
          <span className="tracking-widest uppercase">İstanbul</span>
        </Container>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h4 className="eyebrow mb-5">{title}</h4>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-charcoal-500 hover:text-brass transition-colors"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
