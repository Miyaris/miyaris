import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";

import { ForbiddenScreen } from "./ForbiddenScreen";

export const metadata = {
  title: {
    default: "Canlı Müzayede Sunucusu",
    template: "%s | Sunucu Paneli",
  },
};

/**
 * Presenter (canlı müzayede sunucusu) rotasının server-side guard'ı.
 *
 * Üç durum:
 *   1. Giriş yok         → /login?next=/presenter
 *   2. Giriş var, yetki yok → 403 ekranı render edilir (route tutulur)
 *   3. Giriş var + is_presenter → children render edilir
 *
 * Backend `get_current_presenter` dependency'si gelecekteki WebSocket ve
 * action endpoint'lerinde de aynı kontrolü tekrarlar; bu sayede client'tan
 * gelen istekler hem rota seviyesinde hem API seviyesinde korunur.
 */
export default async function PresenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/presenter");
  }

  if (!user.is_presenter) {
    return <ForbiddenScreen userEmail={user.email} />;
  }

  return <>{children}</>;
}
