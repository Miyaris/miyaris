import Link from "next/link";
import { notFound } from "next/navigation";

import { StateActions } from "@/app/admin/escrow/[id]/StateActions";
import { DELIVERY_LABELS } from "@/components/account/DeliveryMethodPicker";
import { EscrowStatusBadge } from "@/components/account/EscrowStatusBadge";
import { EscrowTimeline } from "@/components/account/EscrowTimeline";
import { PAYMENT_LABELS } from "@/components/account/PaymentMethodPicker";
import { Container } from "@/components/shared/Container";
import { ApiError, backendFetch } from "@/lib/api";
import { formatUSD } from "@/lib/format";
import type { EscrowDetail } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Escrow Yönetimi" };

async function getEscrow(id: string): Promise<EscrowDetail | null> {
  try {
    return await backendFetch<EscrowDetail>(`/api/v1/admin/escrow/${id}`, {
      authenticated: true,
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
      return null;
    }
    throw e;
  }
}

export default async function AdminEscrowDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const escrow = await getEscrow(params.id);
  if (!escrow) notFound();

  const effectivePaid =
    parseFloat(escrow.amount) - parseFloat(escrow.discount_amount);
  const sellerNet = effectivePaid - parseFloat(escrow.platform_fee);

  return (
    <Container className="py-12">
      <Link
        href="/admin/escrow"
        className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-brass border-b border-current pb-0.5"
      >
        ← Escrow listesi
      </Link>

      <div className="mt-8 grid lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7 space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="eyebrow">{escrow.watch_brand}</span>
              <h1 className="font-display text-3xl mt-2">
                {escrow.watch_model}
              </h1>
              <p className="text-charcoal-500 tabular-nums mt-2">
                Ref. {escrow.watch_reference}
              </p>
            </div>
            <EscrowStatusBadge status={escrow.status} />
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="border border-line p-6 bg-ivory-50">
              <span className="eyebrow mb-2 block">Alıcı</span>
              <div className="font-display text-lg">{escrow.buyer_name}</div>
              <div className="text-xs text-charcoal-300 tabular-nums mt-1">
                {escrow.buyer_id.slice(0, 8)}
              </div>
            </div>
            <div className="border border-line p-6 bg-ivory-50">
              <span className="eyebrow mb-2 block">Satıcı</span>
              <div className="font-display text-lg">{escrow.seller_name}</div>
              <div className="text-xs text-charcoal-300 tabular-nums mt-1">
                {escrow.seller_id.slice(0, 8)}
              </div>
            </div>
          </div>

          <dl className="border-y border-line divide-y divide-line">
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-charcoal-300 tracking-wide">Standart Fiyat</dt>
              <dd className="text-charcoal-700 font-medium tabular-nums">
                {formatUSD(escrow.amount)}
              </dd>
            </div>
            {parseFloat(escrow.discount_amount) > 0 && (
              <div className="flex justify-between py-3 text-sm">
                <dt className="text-olive tracking-wide">
                  −%2.5 Özel Havale İndirimi
                </dt>
                <dd className="text-olive font-medium tabular-nums">
                  −{formatUSD(escrow.discount_amount)}
                </dd>
              </div>
            )}
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-charcoal-300 tracking-wide">
                Alıcının Ödediği
              </dt>
              <dd className="text-charcoal-700 font-medium tabular-nums">
                {formatUSD(effectivePaid)}
              </dd>
            </div>
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-charcoal-300 tracking-wide">
                Platform Komisyonu
              </dt>
              <dd className="text-charcoal-500 font-medium tabular-nums">
                {formatUSD(escrow.platform_fee)}
              </dd>
            </div>
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-charcoal-700 tracking-wide font-medium">
                Satıcıya Net
              </dt>
              <dd className="text-charcoal font-display tabular-nums">
                {formatUSD(sellerNet)}
              </dd>
            </div>
            {escrow.delivery_method && (
              <div className="flex justify-between py-3 text-sm">
                <dt className="text-charcoal-300 tracking-wide">Teslimat</dt>
                <dd className="text-charcoal-700 font-medium">
                  {DELIVERY_LABELS[escrow.delivery_method]}
                </dd>
              </div>
            )}
            {escrow.payment_method && (
              <div className="flex justify-between py-3 text-sm">
                <dt className="text-charcoal-300 tracking-wide">Ödeme</dt>
                <dd className="text-charcoal-700 font-medium">
                  {PAYMENT_LABELS[escrow.payment_method]}
                </dd>
              </div>
            )}
            {escrow.payment_provider_ref && (
              <div className="flex justify-between py-3 text-sm">
                <dt className="text-charcoal-300 tracking-wide">Ödeme Ref.</dt>
                <dd className="text-charcoal-500 font-mono text-xs">
                  {escrow.payment_provider_ref}
                </dd>
              </div>
            )}
          </dl>

          <div>
            <h2 className="font-display text-xl mb-4">Süreç</h2>
            <EscrowTimeline
              current={escrow.status}
              listingType={escrow.watch_listing_type}
            />
          </div>
        </div>

        <div className="lg:col-span-5">
          <StateActions escrowId={escrow.id} status={escrow.status} />
        </div>
      </div>
    </Container>
  );
}
