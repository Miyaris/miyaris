import Link from "next/link";

import { backendFetch } from "@/lib/api";
import type { AdminPresenterSessionListItem } from "@/lib/types";

import { SessionActions } from "./SessionActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sunucu Oturumları" };

type Tab = "active" | "past" | "hidden";

const TAB_META: Record<Tab, { label: string; description: string }> = {
  active: {
    label: "Aktif",
    description:
      "Hazırlanıyor + canlı oturumlar. 'Kaldır' herkese açık sayfadan gizler, 'İptal' sunucunun oturumunu durdurur.",
  },
  past: {
    label: "Geçmiş",
    description:
      "Bitmiş veya iptal edilmiş oturumlar. Gizlenerek arşivlenebilir; lot kayıtları ve satışlar korunur.",
  },
  hidden: {
    label: "Gizli",
    description:
      "Herkese açık sayfadan kaldırılmış oturumlar. 'Geri Getir' ile yeniden listeye alınır.",
  },
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PLANNING: {
    label: "Hazırlanıyor",
    cls: "border-charcoal/20 text-charcoal-700 bg-ivory-100",
  },
  LIVE: {
    label: "Canlı",
    cls: "border-olive/40 text-olive bg-olive/10",
  },
  ENDED: {
    label: "Bitti",
    cls: "border-line text-charcoal-500 bg-ivory-200",
  },
  CANCELLED: {
    label: "İptal",
    cls: "border-burgundy/30 text-burgundy bg-burgundy/10",
  },
};

async function getSessions(
  tab: Tab,
): Promise<AdminPresenterSessionListItem[]> {
  try {
    return await backendFetch<AdminPresenterSessionListItem[]>(
      `/api/v1/admin/sessions?tab=${tab}&limit=100`,
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

function resolveTab(raw: string | undefined): Tab {
  if (raw === "past" || raw === "hidden") return raw;
  return "active";
}

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = resolveTab(searchParams?.tab);
  const sessions = await getSessions(tab);

  return (
    <div>
      <header className="mb-8 border-b border-line pb-6">
        <span className="eyebrow text-brass-dark">Yönetim</span>
        <div className="flex items-baseline justify-between mt-3 gap-4 flex-wrap">
          <h1 className="font-display text-4xl">Sunucu Oturumları</h1>
          <div className="text-sm text-charcoal-500 tabular-nums">
            {sessions.length} kayıt
          </div>
        </div>
        <p className="mt-4 text-sm text-charcoal-500 max-w-2xl leading-relaxed">
          {TAB_META[tab].description}
        </p>
      </header>

      <nav className="flex items-center gap-1 mb-8 border-b border-line">
        {(Object.keys(TAB_META) as Tab[]).map((t) => (
          <TabLink key={t} target={t} active={t === tab} />
        ))}
      </nav>

      {sessions.length === 0 ? (
        <div className="py-24 text-center text-charcoal-300 eyebrow">
          {tab === "active"
            ? "Aktif oturum yok"
            : tab === "past"
              ? "Geçmiş oturum yok"
              : "Gizlenmiş oturum yok"}
        </div>
      ) : (
        <div className="border-y border-line">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="eyebrow py-4 px-2 font-normal">Oturum</th>
                <th className="eyebrow py-4 px-2 font-normal hidden md:table-cell">
                  Sunucu
                </th>
                <th className="eyebrow py-4 px-2 font-normal hidden lg:table-cell">
                  Saat
                </th>
                <th className="eyebrow py-4 px-2 font-normal">Durum</th>
                <th className="eyebrow py-4 px-2 font-normal text-right">
                  Aksiyon
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const badge = STATUS_LABEL[s.status] ?? {
                  label: s.status,
                  cls: "",
                };
                return (
                  <tr
                    key={s.id}
                    className="border-t border-line hover:bg-ivory-50/50 transition-colors"
                  >
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 flex-shrink-0 bg-ivory-200 overflow-hidden">
                          {s.cover_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.cover_image_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="font-display text-base truncate">
                            {s.name}
                          </div>
                          <div className="text-xs text-charcoal-300 tabular-nums truncate">
                            {s.lot_count} saat
                            {s.description ? ` · ${s.description.slice(0, 40)}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-2 hidden md:table-cell">
                      <div className="text-sm">{s.presenter_name}</div>
                      <div className="text-xs text-charcoal-300 truncate max-w-[200px]">
                        {s.presenter_email}
                      </div>
                    </td>
                    <td className="py-4 px-2 text-xs hidden lg:table-cell tabular-nums">
                      <div className="text-charcoal-700">
                        {formatDateTime(s.scheduled_at)}
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`inline-block text-xs tracking-wider uppercase border px-2 py-1 ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                        {s.is_hidden && (
                          <span className="inline-block text-[10px] tracking-widest uppercase border px-2 py-0.5 border-burgundy/30 text-burgundy bg-burgundy/5">
                            Gizli
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <SessionActions
                        sessionId={s.id}
                        status={s.status}
                        isHidden={s.is_hidden}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TabLink({ target, active }: { target: Tab; active: boolean }) {
  return (
    <Link
      href={`/admin/sessions?tab=${target}`}
      className={`px-4 py-3 text-xs tracking-widest uppercase border-b-2 -mb-px transition-colors ${
        active
          ? "border-brass text-brass-dark"
          : "border-transparent text-charcoal-500 hover:text-charcoal"
      }`}
    >
      {TAB_META[target].label}
    </Link>
  );
}
