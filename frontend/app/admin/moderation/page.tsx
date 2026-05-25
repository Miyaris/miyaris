import Link from "next/link";

import { AIStatusIndicator } from "@/components/account/AIStatusIndicator";
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

// Karar verilmiş saat statüleri için badge stilleri
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: {
    label: "Aktif",
    cls: "bg-olive/10 text-olive border-olive/30",
  },
  rejected: {
    label: "Reddedildi",
    cls: "bg-burgundy/10 text-burgundy border-burgundy/30",
  },
};

type Tab = "pending" | "decided";

async function getWatches(tab: Tab): Promise<AdminWatchListItem[]> {
  const path =
    tab === "decided"
      ? "/api/v1/admin/watches/decided?limit=100"
      : "/api/v1/admin/watches/pending?limit=100";
  try {
    return await backendFetch<AdminWatchListItem[]>(path, {
      authenticated: true,
    });
  } catch {
    return [];
  }
}

export default async function ModerationQueuePage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const tab: Tab = searchParams?.tab === "decided" ? "decided" : "pending";
  const watches = await getWatches(tab);

  return (
    <div>
      <header className="mb-8 border-b border-line pb-6">
        <span className="eyebrow text-brass-dark">Yönetim</span>
        <div className="flex items-baseline justify-between mt-3">
          <h1 className="font-display text-4xl">Moderasyon</h1>
          <span className="text-sm text-charcoal-500 tabular-nums">
            {watches.length}{" "}
            {tab === "decided" ? "kararlı ilan" : "bekleyen ilan"}
          </span>
        </div>
      </header>

      {/* Sekme şeridi */}
      <div className="flex gap-1 -mt-2 mb-8 border-b border-line">
        <TabLink
          href="/admin/moderation"
          label="Bekleyen Kuyruk"
          active={tab === "pending"}
        />
        <TabLink
          href="/admin/moderation?tab=decided"
          label="Geçmiş Moderasyon"
          active={tab === "decided"}
        />
      </div>

      {watches.length === 0 ? (
        <div className="py-24 text-center text-charcoal-300 eyebrow">
          {tab === "decided" ? "Henüz karar verilmiş ilan yok" : "Kuyruk boş"}
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
                {tab === "decided" ? (
                  <th className="eyebrow py-4 px-2 font-normal hidden md:table-cell">
                    Karar
                  </th>
                ) : (
                  <th className="eyebrow py-4 px-2 font-normal hidden md:table-cell">
                    AI
                  </th>
                )}
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
                    {tab === "decided" ? (
                      <StatusBadge status={w.status} />
                    ) : (
                      <AIStatusIndicator status={w.ai_processing_status} />
                    )}
                  </td>
                  <td className="py-4 px-2 text-right">
                    <Link
                      href={`/admin/moderation/${w.id}`}
                      className="text-xs tracking-widest uppercase border-b border-charcoal pb-0.5 hover:text-brass hover:border-brass transition-colors"
                    >
                      {tab === "decided" ? "Görüntüle →" : "İncele →"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TabLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "px-5 py-3 text-xs tracking-widest uppercase border-b-2 -mb-px transition-colors",
        active
          ? "border-brass text-brass"
          : "border-transparent text-charcoal-500 hover:text-charcoal hover:border-charcoal/30",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const badge = STATUS_BADGE[status] ?? {
    label: status,
    cls: "bg-ivory-100 text-charcoal-500 border-line",
  };
  return (
    <span
      className={`inline-block text-xs tracking-wider uppercase border px-2 py-1 ${badge.cls}`}
    >
      {badge.label}
    </span>
  );
}
