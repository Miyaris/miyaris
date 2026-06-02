import Link from "next/link";

import { backendFetch } from "@/lib/api";
import type { AdminUserListResponse } from "@/lib/types";

import { UserActions } from "./UserActions";
import { UserStatusBadge } from "./UserStatusBadge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kullanıcılar" };

const DEFAULT_LIMIT = 20;

const ROLE_LABELS: Record<string, string> = {
  buyer: "Alıcı",
  seller: "Satıcı",
  expert: "Uzman",
  admin: "Yönetici",
};

async function getUsers(
  limit: number,
  offset: number,
): Promise<AdminUserListResponse | null> {
  try {
    return await backendFetch<AdminUserListResponse>(
      `/api/v1/admin/users?limit=${limit}&offset=${offset}`,
      { authenticated: true },
    );
  } catch {
    return null;
  }
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const pageNum = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const limit = DEFAULT_LIMIT;
  const offset = (pageNum - 1) * limit;

  const data = await getUsers(limit, offset);

  if (!data) {
    return (
      <div>
        <header className="mb-10 border-b border-line pb-6">
          <span className="eyebrow text-brass-dark">Yönetim</span>
          <h1 className="font-display text-4xl mt-3">Kullanıcılar</h1>
        </header>
        <div className="py-24 text-center text-charcoal-500">
          Kullanıcı listesi yüklenemedi. Sayfayı yenileyin veya yetki
          ayarlarınızı kontrol edin.
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / limit));
  const showingFrom = data.total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + data.items.length, data.total);

  return (
    <div>
      <header className="mb-10 border-b border-line pb-6">
        <span className="eyebrow text-brass-dark">Yönetim</span>
        <div className="flex items-baseline justify-between mt-3 gap-6 flex-wrap">
          <h1 className="font-display text-4xl">Kullanıcılar</h1>
          <span className="text-sm text-charcoal-500 tabular-nums">
            Toplam <strong className="text-charcoal-700">{data.total}</strong>{" "}
            kayıtlı üye
          </span>
        </div>
        <p className="text-sm text-charcoal-500 mt-2">
          Platforma kayıtlı tüm kullanıcılar — kayıt sırasına göre en yeniden
          en eskiye.
        </p>
      </header>

      {data.items.length === 0 ? (
        <div className="py-24 text-center text-charcoal-300 eyebrow">
          Kayıtlı kullanıcı yok
        </div>
      ) : (
        <>
          <div className="border-y border-line overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="text-left">
                  <th className="eyebrow py-4 px-4 font-normal">İsim</th>
                  <th className="eyebrow py-4 px-4 font-normal">E-posta</th>
                  <th className="eyebrow py-4 px-4 font-normal hidden md:table-cell">
                    Rol
                  </th>
                  <th className="eyebrow py-4 px-4 font-normal hidden lg:table-cell">
                    Kayıt
                  </th>
                  <th className="eyebrow py-4 px-4 font-normal">Durum</th>
                  <th className="eyebrow py-4 px-4 font-normal text-right">
                    Aksiyon
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-line hover:bg-ivory-50/50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="font-display text-base text-charcoal">
                        {u.full_name}
                      </div>
                      <div className="text-[10px] tracking-widest uppercase text-charcoal-300 tabular-nums mt-1">
                        {u.id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-charcoal-700 break-all">
                      {u.email}
                    </td>
                    <td className="py-4 px-4 text-sm text-charcoal-500 hidden md:table-cell">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </td>
                    <td className="py-4 px-4 text-sm tabular-nums text-charcoal-500 hidden lg:table-cell">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="inline-flex flex-wrap gap-1.5">
                        <UserStatusBadge
                          tone={u.is_verified ? "verified" : "pending"}
                          label={u.is_verified ? "Onaylı" : "Onaysız"}
                        />
                        <UserStatusBadge
                          tone={u.kyc_verified ? "verified" : "muted"}
                          label={u.kyc_verified ? "KYC" : "KYC yok"}
                        />
                        {u.is_presenter && (
                          <UserStatusBadge tone="brass" label="Presenter" />
                        )}
                        {!u.is_active && (
                          <UserStatusBadge tone="muted" label="Pasif" />
                        )}
                        {u.role === "admin" && (
                          <UserStatusBadge tone="brass" label="Admin" />
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <UserActions
                        userId={u.id}
                        kycVerified={u.kyc_verified}
                        isPresenter={u.is_presenter}
                        isActive={u.is_active}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-8 text-sm">
            <span className="text-charcoal-500 tabular-nums">
              {showingFrom}–{showingTo} arası, toplam {data.total}
            </span>
            <nav className="flex items-center gap-2">
              <PageLink
                page={pageNum - 1}
                disabled={pageNum <= 1}
                label="← Önceki"
              />
              <span className="text-xs tracking-widest uppercase text-charcoal-500 px-3 tabular-nums">
                Sayfa {pageNum} / {totalPages}
              </span>
              <PageLink
                page={pageNum + 1}
                disabled={pageNum >= totalPages}
                label="Sonraki →"
              />
            </nav>
          </div>
        </>
      )}
    </div>
  );
}

function PageLink({
  page,
  disabled,
  label,
}: {
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="text-xs tracking-widest uppercase text-charcoal-300 border border-line px-4 py-2 cursor-not-allowed select-none">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/admin/users?page=${page}`}
      className="text-xs tracking-widest uppercase text-charcoal-700 border border-charcoal px-4 py-2 hover:bg-charcoal hover:text-ivory transition-colors"
    >
      {label}
    </Link>
  );
}
