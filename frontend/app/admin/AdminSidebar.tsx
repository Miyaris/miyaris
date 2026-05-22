"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin/moderation", label: "Moderasyon" },
  { href: "/admin/escrow", label: "Güvenli Kasa" },
  { href: "/admin/users", label: "Kullanıcılar" },
];

export function AdminSidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <div className="border-l-2 border-brass/40 pl-5 mb-6">
        <span className="eyebrow text-brass-dark block">Yönetim</span>
        <h2 className="font-display text-2xl mt-1 leading-tight">Panel</h2>
      </div>
      <nav className="flex flex-col">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "text-sm tracking-wide py-3 px-4 -ml-4 transition-colors border-l-2",
                active
                  ? "text-brass border-brass bg-brass/5"
                  : "text-charcoal-700 border-transparent hover:text-brass hover:border-brass/40",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
