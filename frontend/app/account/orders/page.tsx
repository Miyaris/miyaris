import { OrderCard } from "@/components/account/OrderCard";
import { Container } from "@/components/shared/Container";
import { backendFetch } from "@/lib/api";
import type { EscrowListItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Siparişlerim" };

async function getMyOrders(): Promise<EscrowListItem[]> {
  try {
    return await backendFetch<EscrowListItem[]>("/api/v1/orders/me", {
      authenticated: true,
    });
  } catch {
    return [];
  }
}

export default async function OrdersPage() {
  const orders = await getMyOrders();

  return (
    <Container className="py-16">
      <header className="mb-12 border-b border-line pb-6">
        <span className="eyebrow">Hesabım</span>
        <h1 className="font-display text-4xl mt-3">Siparişlerim</h1>
        <p className="text-charcoal-500 text-sm mt-2">
          Müzayede ve Hemen Al ile satın aldığın saatlerin emanet süreçleri.
        </p>
      </header>

      {orders.length === 0 ? (
        <div className="py-24 text-center text-charcoal-300 eyebrow">
          Henüz tamamlanmış bir alımınız yok
        </div>
      ) : (
        <div>
          {orders.map((o) => (
            <OrderCard
              key={o.id}
              item={o}
              perspective="buyer"
              basePath="/account/orders"
            />
          ))}
        </div>
      )}
    </Container>
  );
}
