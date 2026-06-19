import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AuctionForm } from "@/app/sell/auction/new/AuctionForm";
import { Container } from "@/components/shared/Container";
import { ApiError, backendFetch } from "@/lib/api";
import type { WatchOwnerDetail, WatchStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Müzayedeye Çıkar" };

const STATUS_LABELS: Record<WatchStatus, string> = {
  draft: "Taslak",
  pending_review: "İnceleniyor",
  pending_pre_expertise: "Ön Ekspertiz Bekliyor",
  active: "Aktif",
  awaiting_expertise: "Ekspertiz Bekliyor",
  sold: "Satıldı",
  rejected: "Reddedildi",
};

async function getWatch(id: string): Promise<WatchOwnerDetail | null> {
  try {
    return await backendFetch<WatchOwnerDetail>(`/api/v1/watches/me/${id}`, {
      authenticated: true,
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
      return null;
    }
    throw e;
  }
}

export default async function PlanAuctionPage({
  searchParams,
}: {
  searchParams: { watch?: string };
}) {
  const watchId = searchParams.watch;
  if (!watchId) redirect("/account/listings");

  const watch = await getWatch(watchId);
  if (!watch) notFound();

  // Yalnızca ekspertizi onaylanmış (active) saatler müzayedeye çıkartılabilir.
  if (watch.status !== "active") {
    return (
      <Container size="narrow" className="py-24 text-center">
        <span className="eyebrow">Müzayedeye Çıkarılamaz</span>
        <h1 className="font-display text-3xl mt-4 mb-6">
          Saatiniz henüz hazır değil
        </h1>
        <p className="text-charcoal-500 mb-8 leading-relaxed">
          Müzayedeye çıkabilmek için saatin anlaşmalı mağaza ekspertizinden
          geçmiş ve onaylanmış olması gerekiyor. Mevcut durum:{" "}
          <strong>{STATUS_LABELS[watch.status] ?? watch.status}</strong>
        </p>
        <Link
          href={`/account/listings/${watch.id}`}
          className="inline-block border border-charcoal px-6 py-3 text-sm tracking-widest uppercase hover:bg-charcoal hover:text-ivory transition-colors"
        >
          İlana Dön
        </Link>
      </Container>
    );
  }

  return (
    <Container size="narrow" className="py-16">
      <Link
        href={`/account/listings/${watch.id}`}
        className="text-xs tracking-widest uppercase text-charcoal-500 hover:text-brass border-b border-current pb-0.5"
      >
        ← İlana dön
      </Link>

      <div className="mt-8 mb-12">
        <span className="eyebrow">Müzayede & Hemen Al</span>
        <h1 className="font-display text-4xl mt-3">
          {watch.brand} {watch.model}
        </h1>
        <p className="text-charcoal-500 mt-2 tabular-nums">
          Ref. {watch.reference_number}
          {watch.year && ` · ${watch.year}`}
        </p>
      </div>

      <AuctionForm
        watchId={watch.id}
        valuationMin={watch.latest_valuation?.estimated_value_min ?? null}
        valuationMax={watch.latest_valuation?.estimated_value_max ?? null}
      />
    </Container>
  );
}
