import Link from "next/link";

import { Container } from "@/components/shared/Container";
import { LogoutButton } from "@/components/shared/LogoutButton";
import type { UserPublic } from "@/lib/types";

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/auctions", label: "Müzayedeler" },
  { href: "/shop", label: "Miyaris Mağaza" },
  { href: "/sell-watch", label: "Saat Sat" },
  { href: "/how-it-works", label: "Nasıl Çalışır" },
];

export function Header({ user }: { user: UserPublic | null }) {
  return (
    <header className="border-b border-line bg-ivory/80 backdrop-blur-sm sticky top-0 z-40">
      <Container className="flex items-center justify-between h-20">
        <Link
          href="/"
          className="font-display text-2xl tracking-tight text-charcoal hover:text-brass transition-colors"
        >
          Miyaris
        </Link>

        <nav className="hidden md:flex items-center gap-10">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm tracking-wide text-charcoal-700 hover:text-brass transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-6">
          {user ? (
            <>
              {(user.role === "admin" || user.role === "expert") && (
                // Tek link: Moderasyon. Güvenli Kasa + Kullanıcılar artık
                // AdminSidebar'dan erişiliyor — header'da yer açmak için.
                <div className="hidden sm:flex items-center gap-4">
                  <Link
                    href="/admin/moderation"
                    className="text-xs tracking-widest uppercase text-brass-dark hover:text-brass border-b border-brass/30 pb-0.5"
                  >
                    Moderasyon
                  </Link>
                </div>
              )}
              {user.is_presenter && (
                // Presenter yetkisi olan hesaplara canlı sunucu paneline
                // direkt giriş kısayolu — brass renkli, ayırt edici.
                <Link
                  href="/presenter"
                  className="hidden sm:inline-block text-xs tracking-widest uppercase text-brass-dark hover:text-brass border-b border-brass/30 pb-0.5"
                >
                  Sunucu Paneli
                </Link>
              )}
              <Link
                href="/account/bids"
                className="text-sm text-charcoal-700 hover:text-brass transition-colors hidden md:inline"
              >
                Tekliflerim
              </Link>
              <Link
                href="/account/orders"
                className="text-sm text-charcoal-700 hover:text-brass transition-colors hidden lg:inline"
              >
                Siparişlerim
              </Link>
              <Link
                href="/account/listings"
                className="text-sm text-charcoal-700 hover:text-brass transition-colors hidden sm:inline"
              >
                {user.full_name}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm tracking-wide text-charcoal-700 hover:text-brass transition-colors"
              >
                Giriş
              </Link>
              <Link
                href="/register"
                className="text-sm tracking-wide border border-charcoal px-5 py-2 hover:bg-charcoal hover:text-ivory transition-colors"
              >
                Üye Ol
              </Link>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}
