import Link from "next/link";

import { ListingCard } from "@/components/account/ListingCard";
import { Container } from "@/components/shared/Container";
import { backendFetch } from "@/lib/api";
import type { WatchPublic } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "İlanlarım" };

async function getMyWatches(): Promise<WatchPublic[]> {
  try {
    return await backendFetch<WatchPublic[]>("/api/v1/watches/me", {
      authenticated: true,
    });
  } catch {
    return [];
  }
}

export default async function MyListingsPage() {
  const watches = await getMyWatches();

  return (
    <Container className="py-16">
      <header className="flex items-baseline justify-between mb-12 border-b border-line pb-6">
        <div>
          <span className="eyebrow">Hesabım</span>
          <h1 className="font-display text-4xl mt-3">İlanlarım</h1>
        </div>
        <Link
          href="/sell-watch"
          className="inline-block bg-charcoal text-ivory px-6 py-3 text-sm tracking-widest uppercase hover:bg-charcoal-700 transition-colors"
        >
          + Yeni İlan
        </Link>
      </header>

      {watches.length === 0 ? (
        <div className="py-24 text-center">
          <p className="eyebrow mb-6">Henüz ilanınız yok</p>
          <Link
            href="/sell-watch"
            className="inline-block border border-charcoal px-8 py-4 text-sm tracking-widest uppercase hover:bg-charcoal hover:text-ivory transition-colors"
          >
            İlk Saatinizi Listeleyin
          </Link>
        </div>
      ) : (
        <div>
          {watches.map((w) => (
            <ListingCard key={w.id} watch={w} />
          ))}
        </div>
      )}
    </Container>
  );
}
