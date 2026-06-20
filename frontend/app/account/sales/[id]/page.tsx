import Link from "next/link";
import { notFound } from "next/navigation";

import { DELIVERY_LABELS } from "@/components/account/DeliveryMethodPicker";
import { EscrowStatusBadge } from "@/components/account/EscrowStatusBadge";
import { EscrowTimeline } from "@/components/account/EscrowTimeline";
import { PAYMENT_LABELS } from "@/components/account/PaymentMethodPicker";
import { SellerSealUploadForm } from "@/components/account/SellerSealUploadForm";
import { Container } from "@/components/shared/Container";
import { ApiError, backendFetch } from "@/lib/api";
import { formatUSD } from "@/lib/format";
import type { EscrowDetail } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Satış Detayı" };

async function getSale(id: string): Promise<EscrowDetail | null> {
  try {
    // Buyer ve seller için aynı endpoint — kendi escrow'unu getirir
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

export default async function SaleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const sale = await getSale(params.id);
  if (!sale) notFound();

  // EFT indirimi varsa: alıcı (amount - discount) ödedi.
  // Platform komisyonu post-discount tutardan kesiliyor (escrow_service).
  // Satıcının eline geçecek tutar: effective_paid - platform_fee
  const effectivePaid =
    parseFloat(sale.amount) - parseFloat(sale.discount_amount);
  const sellerNet = effectivePaid - parseFloat(sale.platform_fee);

  return (
    <Container className="py-12">
      <Link
        href="/account/sales"
        className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-brass border-b border-current pb-0.5"
      >
        ← Satışlarım
      </Link>

      <div className="mt-8 grid lg:grid-cols-12 gap-12">
        <div className="lg:col-span-5 space-y-6">
          <div className="aspect-square bg-ivory-200 overflow-hidden">
            {sale.watch_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sale.watch_image_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>

          <div>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <span className="eyebrow">{sale.watch_brand}</span>
                <h1 className="font-display text-3xl mt-2">
                  {sale.watch_model}
                </h1>
              </div>
              <EscrowStatusBadge status={sale.status} />
            </div>
            <p className="text-charcoal-500 tabular-nums">
              Ref. {sale.watch_reference}
            </p>
          </div>

          <dl className="border-y border-line divide-y divide-line">
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-charcoal-300 tracking-wide">Alıcı</dt>
              <dd className="text-charcoal-700 font-medium">
                {sale.buyer_name}
              </dd>
            </div>
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-charcoal-300 tracking-wide">Standart Fiyat</dt>
              <dd className="text-charcoal-700 font-medium tabular-nums">
                {formatUSD(sale.amount)}
              </dd>
            </div>
            {parseFloat(sale.discount_amount) > 0 && (
              <div className="flex justify-between py-3 text-sm">
                <dt className="text-olive tracking-wide">
                  −%2.5 Özel Havale İndirimi
                </dt>
                <dd className="text-olive font-medium tabular-nums">
                  −{formatUSD(sale.discount_amount)}
                </dd>
              </div>
            )}
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-charcoal-300 tracking-wide">
                Platform Komisyonu (%5)
              </dt>
              <dd className="text-charcoal-500 font-medium tabular-nums">
                −{formatUSD(sale.platform_fee)}
              </dd>
            </div>
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-charcoal-700 tracking-wide font-medium">
                Size Aktarılacak
              </dt>
              <dd className="text-charcoal font-display tabular-nums">
                {formatUSD(sellerNet)}
              </dd>
            </div>
            {sale.delivery_method && (
              <div className="flex justify-between py-3 text-sm">
                <dt className="text-charcoal-300 tracking-wide">
                  Teslimat Yöntemi
                </dt>
                <dd className="text-charcoal-700 font-medium">
                  {DELIVERY_LABELS[sale.delivery_method]}
                </dd>
              </div>
            )}
            {sale.payment_method && (
              <div className="flex justify-between py-3 text-sm">
                <dt className="text-charcoal-300 tracking-wide">
                  Alıcının Ödeme Şekli
                </dt>
                <dd className="text-charcoal-700 font-medium">
                  {PAYMENT_LABELS[sale.payment_method]}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="lg:col-span-7 space-y-8">
          <div className="border border-line bg-ivory-50 p-6">
            <span className="eyebrow text-charcoal mb-2 block">
              Yapmanız Gerekenler
            </span>
            <p className="text-sm text-charcoal-700 leading-relaxed">
              Saati orijinal kutu ve kağıtlarıyla birlikte Miyaris ofisimize
              gönderin. Adres ve kargo etiketi 24 saat içinde e-postanıza
              ulaşacak. Saatin doğrulanmasının ardından ödeme banka hesabınıza
              aktarılacak.
            </p>
          </div>

          {/* Sahtekarlik onleme: muhurlu kutu fotografi yukleme.
              Yalniz para yatirildiktan ve akis kapanmadan once izinli. */}
          {sale.status !== "pending_payment" &&
            sale.status !== "released" &&
            sale.status !== "refunded" && (
              <SellerSealUploadForm
                escrowId={sale.id}
                existingPhotoUrl={sale.seller_seal_photo_url}
              />
            )}

          <div>
            <h2 className="font-display text-xl mb-4">Süreç</h2>
            <EscrowTimeline
              current={sale.status}
              listingType={sale.watch_listing_type}
            />
          </div>
        </div>
      </div>
    </Container>
  );
}
