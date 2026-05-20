import { OrderCard } from "@/components/account/OrderCard";
import { Container } from "@/components/shared/Container";
import { backendFetch } from "@/lib/api";
import type { EscrowListItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Satışlarım" };

async function getMySales(): Promise<EscrowListItem[]> {
  try {
    return await backendFetch<EscrowListItem[]>("/api/v1/sales/me", {
      authenticated: true,
    });
  } catch {
    return [];
  }
}

export default async function SalesPage() {
  const sales = await getMySales();

  return (
    <Container className="py-16">
      <header className="mb-12 border-b border-line pb-6">
        <span className="eyebrow">Hesabım</span>
        <h1 className="font-display text-4xl mt-3">Satışlarım</h1>
        <p className="text-charcoal-500 text-sm mt-2">
          Müzayede ve Hemen Al ile satılan saatlerinizin emanet süreçleri.
        </p>
      </header>

      {sales.length === 0 ? (
        <div className="py-24 text-center text-charcoal-300 eyebrow">
          Henüz tamamlanmış bir satışınız yok
        </div>
      ) : (
        <div>
          {sales.map((s) => (
            <OrderCard
              key={s.id}
              item={s}
              perspective="seller"
              basePath="/account/sales"
            />
          ))}
        </div>
      )}
    </Container>
  );
}
