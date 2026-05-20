import Link from "next/link";

import { AIStatusIndicator } from "@/components/account/AIStatusIndicator";
import { Container } from "@/components/shared/Container";
import { backendFetch } from "@/lib/api";
import type { AdminWatchListItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moderasyon Kuyruğu" };

const CONDITION_LABELS: Record<string, string> = {
  new: "Sıfır",
  mint: "Mint",
  excellent: "Mükemmel",
  good: "İyi",
  fair: "Orta",
};

async function getPending(): Promise<AdminWatchListItem[]> {
  try {
    return await backendFetch<AdminWatchListItem[]>(
      "/api/v1/admin/watches/pending?limit=100",
      { authenticated: true },
    );
  } catch {
    return [];
  }
}

export default async function ModerationQueuePage() {
  const watches = await getPending();

  return (
    <Container className="py-12">
      <header className="mb-10 border-b border-line pb-6">
        <span className="eyebrow text-brass-dark">Yönetim</span>
        <div className="flex items-baseline justify-between mt-3">
          <h1 className="font-display text-4xl">Moderasyon Kuyruğu</h1>
          <span className="text-sm text-charcoal-500 tabular-nums">
            {watches.length} bekleyen ilan
          </span>
        </div>
      </header>

      {watches.length === 0 ? (
        <div className="py-24 text-center text-charcoal-300 eyebrow">
          Kuyruk boş
        </div>
      ) : (
        <div className="border-y border-line">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="eyebrow py-4 px-2 font-normal">Saat</th>
                <th className="eyebrow py-4 px-2 font-normal hidden md:table-cell">
                  Satıcı
                </th>
                <th className="eyebrow py-4 px-2 font-normal hidden lg:table-cell">
                  Kondisyon
                </th>
                <th className="eyebrow py-4 px-2 font-normal hidden md:table-cell">
                  AI
                </th>
                <th className="eyebrow py-4 px-2 font-normal text-right">
                  Aksiyon
                </th>
              </tr>
            </thead>
            <tbody>
              {watches.map((w) => (
                <tr
                  key={w.id}
                  className="border-t border-line hover:bg-ivory-50/50 transition-colors"
                >
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 flex-shrink-0 bg-ivory-200 overflow-hidden">
                        {w.primary_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={w.primary_image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="font-display text-base truncate">
                          {w.brand} {w.model}
                        </div>
                        <div className="text-xs text-charcoal-300 tabular-nums truncate">
                          Ref. {w.reference_number}
                          {w.year ? ` · ${w.year}` : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-2 hidden md:table-cell">
                    <div className="text-sm">{w.seller_name}</div>
                    <div className="text-xs text-charcoal-300 truncate max-w-[200px]">
                      {w.seller_email}
                    </div>
                  </td>
                  <td className="py-4 px-2 text-sm hidden lg:table-cell">
                    {CONDITION_LABELS[w.condition] ?? w.condition}
                  </td>
                  <td className="py-4 px-2 hidden md:table-cell">
                    <AIStatusIndicator status={w.ai_processing_status} />
                  </td>
                  <td className="py-4 px-2 text-right">
                    <Link
                      href={`/admin/moderation/${w.id}`}
                      className="text-xs tracking-widest uppercase border-b border-charcoal pb-0.5 hover:text-brass hover:border-brass transition-colors"
                    >
                      İncele →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
