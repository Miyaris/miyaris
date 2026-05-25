import Link from "next/link";

import { backendFetch } from "@/lib/api";
import type { AdminAuctionListItem, AdminAuctionStatus } from "@/lib/types";

import { AuctionActions } from "./AuctionActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Müzayedeler" };

const STATUS_BADGE: Record<
  AdminAuctionStatus,
  { label: string; cls: string }
> = {
  scheduled: {
    label: "Bekliyor",
    cls: "bg-ivory-100 text-charcoal-700 border-charcoal/20",
  },
  live: {
    label: "Canlı",
    cls: "bg-olive/10 text-olive border-olive/40",
  },
  ended: {
    label: "Bitti",
    cls: "bg-ivory-200 text-charcoal-500 border-line",
  },
  completed: {
    label: "Tamamlandı",
    cls: "bg-ivory-200 text-charcoal-500 border-line",
  },
  cancelled: {
    label: "İptal",
    cls: "bg-burgundy/10 text-burgundy border-burgundy/30",
  },
};

async function getAuctions(): Promise<AdminAuctionListItem[]> {
  try {
    return await backendFetch<AdminAuctionListItem[]>(
      "/api/v1/admin/auctions?limit=100",
      { authenticated: true },
    );
  } catch {
    return [];
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatPrice(value: string): string {
  // Backend Decimal'i string olarak gönderir; binlik ayracıyla TL formatla
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(num);
}

export default async function AdminAuctionsPage() {
  const auctions = await getAuctions();
  const scheduledCount = auctions.filter((a) => a.status === "scheduled").length;
  const liveCount = auctions.filter((a) => a.status === "live").length;

  return (
    <div>
      <header className="mb-10 border-b border-line pb-6">
        <span className="eyebrow text-brass-dark">Yönetim</span>
        <div className="flex items-baseline justify-between mt-3">
          <h1 className="font-display text-4xl">Müzayedeler</h1>
          <div className="text-sm text-charcoal-500 tabular-nums space-x-4">
            <span>{liveCount} canlı</span>
            <span>·</span>
            <span>{scheduledCount} bekliyor</span>
          </div>
        </div>
        <p className="mt-4 text-sm text-charcoal-500 max-w-2xl leading-relaxed">
          Aktif (bekleyen + canlı) müzayedeler. <strong>Bu Hafta&apos;ya
          Çek</strong> butonu bir sonraki haftaya schedule edilmiş bir
          müzayedeyi içinde bulunduğumuz haftaya taşır ve anında canlı yapar
          — geç katılım onayları için.
        </p>
      </header>

      {auctions.length === 0 ? (
        <div className="py-24 text-center text-charcoal-300 eyebrow">
          Aktif müzayede yok
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
                  Pencere
                </th>
                <th className="eyebrow py-4 px-2 font-normal text-right hidden md:table-cell">
                  Fiyat
                </th>
                <th className="eyebrow py-4 px-2 font-normal">Durum</th>
                <th className="eyebrow py-4 px-2 font-normal text-right">
                  Aksiyon
                </th>
              </tr>
            </thead>
            <tbody>
              {auctions.map((a) => {
                const badge = STATUS_BADGE[a.status];
                return (
                  <tr
                    key={a.id}
                    className="border-t border-line hover:bg-ivory-50/50 transition-colors"
                  >
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 flex-shrink-0 bg-ivory-200 overflow-hidden">
                          {a.primary_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.primary_image_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="font-display text-base truncate">
                            {a.brand} {a.model}
                          </div>
                          <div className="text-xs text-charcoal-300 tabular-nums truncate">
                            Ref. {a.reference_number} · {a.bid_count} teklif
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-2 hidden md:table-cell">
                      <div className="text-sm">{a.seller_name}</div>
                      <div className="text-xs text-charcoal-300 truncate max-w-[200px]">
                        {a.seller_email}
                      </div>
                    </td>
                    <td className="py-4 px-2 text-xs hidden lg:table-cell tabular-nums">
                      <div className="text-charcoal-700">
                        {formatDateTime(a.starts_at)}
                      </div>
                      <div className="text-charcoal-300">
                        → {formatDateTime(a.ends_at)}
                      </div>
                    </td>
                    <td className="py-4 px-2 text-right tabular-nums hidden md:table-cell">
                      <div className="text-sm">{formatPrice(a.current_price)}</div>
                      {a.current_price !== a.starting_price && (
                        <div className="text-xs text-charcoal-300">
                          başlangıç: {formatPrice(a.starting_price)}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-2">
                      <span
                        className={`inline-block text-xs tracking-wider uppercase border px-2 py-1 ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <AuctionActions auctionId={a.id} status={a.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 text-xs text-charcoal-300">
        <Link
          href="/auctions"
          className="hover:text-brass border-b border-current pb-0.5"
        >
          Halka açık müzayede listesini görüntüle →
        </Link>
      </div>
    </div>
  );
}
