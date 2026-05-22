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
  metadataBase: new URL("https://miyaris.com"),
  title: {
    default: "Miyaris | Lüks Saat Pazaryeri & Bağımsız Ekspertiz",
    template: "%s | Miyaris",
  },
  description:
    "Türkiye'nin en seçkin dijital lüks saat pazarı. Güvenilir ekspertiz, sertifikalı saatler ve şeffaf satıcı komisyonları ile güvenli alışverişin adresi miyaris.com.",
  keywords: [
    "lüks saat",
    "saat müzayedesi",
    "sertifikalı saat",
    "saat ekspertizi",
    "ikinci el lüks saat",
    "Rolex",
    "Patek Philippe",
    "Audemars Piguet",
    "Türkiye lüks saat pazarı",
    "Miyaris",
  ],
  authors: [{ name: "Miyaris" }],
  creator: "Miyaris",
  publisher: "Miyaris",
  alternates: {
    canonical: "https://miyaris.com",
  },
  // Favicon — app/icon.svg ve app/apple-icon.svg dosyaları zaten Next.js
  // konvansiyonu gereği otomatik picked-up. Bunu explicit yazmak hem cross-
  // browser uyumluluğunu artırır hem de production'da `<link rel="icon">`
  // tag'inin garantili çıkmasını sağlar (bazı build pipeline'larda dosya-
  // tabanlı keşif sessizce atlanabiliyor).
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "https://miyaris.com",
    siteName: "Miyaris",
    title: "Miyaris | Lüks Saat Pazaryeri & Bağımsız Ekspertiz",
    description:
      "Türkiye'nin en seçkin dijital lüks saat pazarı. Güvenilir ekspertiz, sertifikalı saatler ve şeffaf satıcı komisyonları ile güvenli alışverişin adresi miyaris.com.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Miyaris | Lüks Saat Pazaryeri & Bağımsız Ekspertiz",
    description:
      "Türkiye'nin en seçkin dijital lüks saat pazarı. Güvenilir ekspertiz, sertifikalı saatler ve şeffaf satıcı komisyonları ile güvenli alışverişin adresi miyaris.com.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
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
