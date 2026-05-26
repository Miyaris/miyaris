import { PresenterDashboard } from "./PresenterDashboard";

export const metadata = { title: "Canlı Müzayede Sunucusu" };

/**
 * Canlı Müzayede Sunucu Paneli (Presenter Dashboard).
 *
 * Bu sayfa yalnızca `is_presenter=true` kullanıcılar için renderlanır —
 * guard `app/presenter/layout.tsx` içinde server-side yapılır. Sayfaya
 * doğrudan istek yapan yetkisiz biri layout aşamasında ForbiddenScreen
 * görür, bu component'a hiç ulaşmaz.
 *
 * Şu aşamada WebSocket entegrasyonu YOK; veriler local state ile mock
 * akışta beslenir. Yapı production'a hazır — mock akışı useAuctionStream
 * benzeri bir hook ile değiştirmek tek satırlık iş olacak.
 */
export default function PresenterPage() {
  return <PresenterDashboard />;
}
