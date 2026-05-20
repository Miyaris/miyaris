"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import type { EscrowStatus } from "@/lib/types";

interface ActionConfig {
  action: string;
  label: string;
  description: string;
  nextStatus: string;
  destructive?: boolean;
}

const NEXT_ACTION: Record<EscrowStatus, ActionConfig | null> = {
  pending_payment: null, // Buyer'ın ödeme yapması gerekir
  funded: {
    action: "mark-received",
    label: "Saat Miyaris'e Ulaştı",
    description: "Saat fiziksel olarak ofise geldi → doğrulama başlasın",
    nextStatus: "Doğrulamada",
  },
  awaiting_authentication: {
    action: "authenticate",
    label: "Doğrulamayı Tamamla",
    description: "Uzman incelemesi bitti, orijinallik onaylandı",
    nextStatus: "Doğrulandı",
  },
  authenticated: {
    action: "mark-shipped",
    label: "Alıcıya Gönder",
    description: "Sigortalı kargo etiketi oluştur ve teslim al",
    nextStatus: "Kargoda",
  },
  shipped_to_buyer: {
    action: "mark-delivered",
    label: "Teslim Onayı",
    description: "Kargo alıcıya teslim edildi (kargo şirketi onayı)",
    nextStatus: "Teslim Edildi",
  },
  delivered: {
    action: "release",
    label: "Parayı Satıcıya Aktar",
    description: "Emanetteki tutarı satıcının banka hesabına gönder",
    nextStatus: "Tamamlandı",
  },
  released: null,
  refunded: null,
  disputed: null,
};

interface Props {
  escrowId: string;
  status: EscrowStatus;
}

export function StateActions({ escrowId, status }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = NEXT_ACTION[status];
  const canRefund =
    status !== "released" &&
    status !== "refunded" &&
    status !== "disputed";

  async function trigger(action: string) {
    if (
      action === "refund" &&
      !confirm("Bu işlem para iadesini başlatır. Emin misiniz?")
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/escrow/${escrowId}/${action}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "İşlem başarısız");
        return;
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  if (!next && !canRefund) {
    return (
      <div className="border border-line bg-ivory-50 p-6">
        <span className="eyebrow mb-2 block">İşlem Tamamlandı</span>
        <p className="text-sm text-charcoal-500">
          Bu escrow için yapılacak başka bir aksiyon yok.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {next && (
        <div className="border border-line bg-ivory-50 p-6 space-y-3">
          <span className="eyebrow text-brass-dark">Sıradaki Adım</span>
          <h3 className="font-display text-xl">{next.label}</h3>
          <p className="text-sm text-charcoal-500 leading-relaxed">
            {next.description}
          </p>
          <p className="text-xs text-charcoal-300">
            Onaylanırsa durum: <strong>{next.nextStatus}</strong>
          </p>
          <Button
            onClick={() => trigger(next.action)}
            disabled={pending}
            className="w-full"
          >
            {pending ? "İşleniyor..." : next.label}
          </Button>
        </div>
      )}

      {canRefund && (
        <div className="border border-burgundy/30 p-4 bg-burgundy/5">
          <button
            onClick={() => trigger("refund")}
            disabled={pending}
            className="w-full text-xs tracking-widest uppercase text-burgundy hover:text-burgundy/80 py-2 disabled:opacity-50"
          >
            Para İadesi Başlat
          </button>
        </div>
      )}

      {error && (
        <div className="text-sm text-burgundy border-l-2 border-burgundy pl-3">
          {error}
        </div>
      )}
    </div>
  );
}
