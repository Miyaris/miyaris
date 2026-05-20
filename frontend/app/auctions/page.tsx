import { AuctionGrid } from "@/components/auctions/AuctionGrid";
import { Container } from "@/components/shared/Container";
import { backendFetch } from "@/lib/api";
import type { AuctionListItem, AuctionStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const FILTERS: { value: AuctionStatus | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "live", label: "Canlı" },
  { value: "scheduled", label: "Yakında" },
  { value: "ended", label: "Sona Erdi" },
];

interface SearchParams {
  status?: string;
  brand?: string;
}

async function getAuctions(params: SearchParams): Promise<AuctionListItem[]> {
  const query = new URLSearchParams();
  if (params.status && params.status !== "all") {
    query.set("status_filter", params.status);
  }
  if (params.brand) query.set("brand", params.brand);
  query.set("limit", "60");

  try {
    return await backendFetch<AuctionListItem[]>(
      `/api/v1/auctions?${query.toString()}`,
    );
  } catch {
    return [];
  }
}

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const auctions = await getAuctions(searchParams);
  const activeStatus = searchParams.status ?? "all";

  return (
    <Container className="py-16">
      <header className="mb-12">
        <span className="eyebrow">Haftalık Müzayede</span>
        <h1 className="font-display text-5xl mt-4">Müzayedeler</h1>
        <p className="text-charcoal-500 mt-4 max-w-2xl leading-relaxed">
          Partner mağaza ekspertizinden geçmiş saatlerin canlı açık
          artırmaları. Pazartesi başlar, Pazar akşamı kapanır.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-12 border-b border-line pb-6">
        {FILTERS.map((f) => {
          const isActive = activeStatus === f.value;
          const href =
            f.value === "all" ? "/auctions" : `/auctions?status=${f.value}`;
          return (
            <a
              key={f.value}
              href={href}
              className={`px-5 py-2 text-xs tracking-widest uppercase transition-colors ${
                isActive
                  ? "bg-charcoal text-ivory"
                  : "text-charcoal-500 hover:text-charcoal"
              }`}
            >
              {f.label}
            </a>
          );
        })}
      </div>

      <AuctionGrid auctions={auctions} />
    </Container>
  );
}
