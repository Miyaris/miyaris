import Link from "next/link";

import { NewSessionForm } from "./NewSessionForm";

export const metadata = { title: "Yeni Oturum" };

export default function PresenterNewSessionPage() {
  return (
    <main className="min-h-screen bg-ivory">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <header className="mb-10 border-b border-line pb-6">
          <Link
            href="/presenter"
            className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-charcoal"
          >
            ← Sunucu Paneli
          </Link>
          <h1 className="font-display text-4xl mt-4">Yeni Müzayede Oturumu</h1>
          <p className="mt-3 text-sm text-charcoal-500 leading-relaxed">
            Oturuma bir ad ve başlangıç saati ver. Sonraki adımda içine
            istediğin kadar saat ekleyebilirsin. Saatleri ekleme tamamlanınca
            oturumu canlıya alırsın.
          </p>
        </header>
        <NewSessionForm />
      </div>
    </main>
  );
}
