import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";

import { Footer } from "@/components/shared/Footer";
import { Header } from "@/components/shared/Header";
import { getCurrentUser } from "@/lib/session";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Miyaris — Lüks Saat Müzayede & Hemen Al Platformu",
    template: "%s — Miyaris",
  },
  description:
    "Türkiye'nin sertifikalı lüks saat pazarı. Haftalık müzayede veya Hemen Al, fiziksel orijinallik kontrolü, sigortalı kasa, güvenli emanet hesabı.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layout'ta auth durumunu çekip Header'a iletiyoruz.
  // Server Component olduğu için cookie'ye erişim güvenli.
  const user = await getCurrentUser();

  return (
    <html lang="tr" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-ivory text-charcoal flex flex-col">
        <Header user={user} />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
