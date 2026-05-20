import Link from "next/link";
import { notFound } from "next/navigation";

import { FundButton } from "@/app/account/orders/[id]/FundButton";
import {
  DELIVERY_LABELS,
} from "@/components/account/DeliveryMethodPicker";
import { EscrowStatusBadge } from "@/components/account/EscrowStatusBadge";
import { EscrowTimeline } from "@/components/account/EscrowTimeline";
import {
  InvoiceSummary,
  PAYMENT_LABELS,
} from "@/components/account/PaymentMethodPicker";
import { Container } from "@/components/shared/Container";
import { ApiError, backendFetch } from "@/lib/api";
import { formatUSD } from "@/lib/format";
import type { EscrowDetail } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sipariş Detayı" };

async function getOrder(id: string): Promise<EscrowDetail | null> {
  try {
    return await backendFetch<EscrowDetail>(`/api/v1/orders/${id}`, {
      authenticated: true,
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
      return null;
    }
    throw e;
  }
}

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const order = await getOrder(params.id);
  if (!order) notFound();

  return (
    <Container className="py-12">
      <Link
        href="/account/orders"
        className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-brass border-b border-current pb-0.5"
      >
        ← Siparişlerim
      </Link>

      <div className="mt-8 grid lg:grid-cols-12 gap-12">
        <div className="lg:col-span-5 space-y-6">
          <div className="aspect-square bg-ivory-200 overflow-hidden">
            {order.watch_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={order.watch_image_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>

          <div>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <span className="eyebrow">{order.watch_brand}</span>
                <h1 className="font-display text-3xl mt-2">
                  {order.watch_model}
                </h1>
              </div>
              <EscrowStatusBadge status={order.status} />
            </div>
            <p className="text-charcoal-500 tabular-nums">
              Ref. {order.watch_reference}
            </p>
          </div>

          <dl className="border-y border-line divide-y divide-line">
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-charcoal-300 tracking-wide">Satıcı</dt>
              <dd className="text-charcoal-700 font-medium">
                {order.seller_name}
              </dd>
            </div>
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-charcoal-300 tracking-wide">Sipariş No</dt>
              <dd className="text-charcoal-700 font-medium tabular-nums text-xs">
                {order.id.slice(0, 8)}
              </dd>
            </div>
            {order.delivery_method && (
              <div className="flex justify-between py-3 text-sm">
                <dt className="text-charcoal-300 tracking-wide">
                  Teslimat Yöntemi
                </dt>
                <dd className="text-charcoal-700 font-medium">
                  {DELIVERY_LABELS[order.delivery_method]}
                </dd>
              </div>
            )}
            {order.payment_method && (
              <div className="flex justify-between py-3 text-sm">
                <dt className="text-charcoal-300 tracking-wide">Ödeme</dt>
                <dd className="text-charcoal-700 font-medium">
                  {PAYMENT_LABELS[order.payment_method]}
                </dd>
              </div>
            )}
          </dl>

          {/* Fatura — ödeme yapıldıktan sonra görünür */}
          {order.payment_method && (
            <div>
              <span className="eyebrow mb-3 block">Fatura Özeti</span>
              <InvoiceSummary
                listedPrice={order.amount}
                discountAmount={order.discount_amount}
                paymentMethod={order.payment_method}
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-7 space-y-8">
          {order.status === "pending_payment" && (
            <FundButton escrowId={order.id} amount={order.amount} />
          )}

          <div>
            <h2 className="font-display text-xl mb-4">Süreç</h2>
            <EscrowTimeline
              current={order.status}
              listingType={order.watch_listing_type}
            />
          </div>
        </div>
      </div>
    </Container>
  );
}
