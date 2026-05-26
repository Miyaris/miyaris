import Link from "next/link";

import { NewShowcaseForm } from "./NewShowcaseForm";

export const metadata = { title: "Yeni Showcase" };

export default function PresenterNewPage() {
  return (
    <main className="min-h-screen bg-ivory">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <header className="mb-10 border-b border-line pb-6">
          <Link
            href="/presenter"
            className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-charcoal"
          >
            ← Sunucu Paneli
          </Link>
          <h1 className="font-display text-4xl mt-4">Yeni Canlı Müzayede</h1>
          <p className="mt-3 text-sm text-charcoal-500 max-w-xl leading-relaxed">
            Ürün bilgileri + müzayede penceresi tek formda. Yayın saatini
            kendin belirle, sürenin sonunda canlı sunucu ekranı üzerinden
            yönet.
          </p>
        </header>
        <NewShowcaseForm />
      </div>
    </main>
  );
}
