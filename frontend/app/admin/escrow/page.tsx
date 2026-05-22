import Link from "next/link";

import { EscrowStatusBadge } from "@/components/account/EscrowStatusBadge";
import { Container } from "@/components/shared/Container";
import { backendFetch } from "@/lib/api";
import { formatTRY } from "@/lib/format";
import type { EscrowListItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Güvenli Kasa Yönetimi" };

async function getActiveEscrow(): Promise<EscrowListItem[]> {
  try {
    return await backendFetch<EscrowListItem[]>(
      "/api/v1/admin/escrow?limit=200",
      { authenticated: true },
    );
  } catch {
    return [];
  }
}

export default async function AdminEscrowPage() {
  const items = await getActiveEscrow();

  return (
    <Container className="py-12">
      <header className="mb-10 border-b border-line pb-6">
        <span className="eyebrow text-brass-dark">Yönetim</span>
        <div className="flex items-baseline justify-between mt-3">
          <h1 className="font-display text-4xl">Aktif Güvenli Kasa Akışları</h1>
          <span className="text-sm text-charcoal-500 tabular-nums">
            {items.length} açık işlem
          </span>
        </div>
        <p className="text-sm text-charcoal-500 mt-2">
          Tamamlanan ve iade edilen işlemler bu listede gösterilmez.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="py-24 text-center text-charcoal-300 eyebrow">
          Aktif güvenli kasa akışı yok
        </div>
      ) : (
        <div className="border-y border-line">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="eyebrow py-4 px-2 font-normal">Saat</th>
                <th className="eyebrow py-4 px-2 font-normal hidden md:table-cell">
                  Taraflar
                </th>
                <th className="eyebrow py-4 px-2 font-normal hidden lg:table-cell">
                  Tutar
                </th>
                <th className="eyebrow py-4 px-2 font-normal">Durum</th>
                <th className="eyebrow py-4 px-2 font-normal text-right">
                  Aksiyon
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-line hover:bg-ivory-50/50 transition-colors"
                >
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 flex-shrink-0 bg-ivory-200 overflow-hidden">
                        {e.watch_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={e.watch_image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="font-display text-base truncate">
                          {e.watch_brand} {e.watch_model}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-xs text-charcoal-500 hidden md:table-cell">
                    {e.counterparty_name}
                  </td>
                  <td className="py-4 px-2 text-sm tabular-nums hidden lg:table-cell">
                    {formatTRY(e.amount)}
                  </td>
                  <td className="py-4 px-2">
                    <EscrowStatusBadge status={e.status} />
                  </td>
                  <td className="py-4 px-2 text-right">
                    <Link
                      href={`/admin/escrow/${e.id}`}
                      className="text-xs tracking-widest uppercase border-b border-charcoal pb-0.5 hover:text-brass hover:border-brass transition-colors"
                    >
                      Yönet →
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
