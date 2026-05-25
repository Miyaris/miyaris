"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Kullanıcı satırı için admin override aksiyonları.
 *
 * Şu an tek aksiyon: KYC onayla / KYC geri çek. NVI_VERIFICATION_ENABLED=false
 * iken kayıt olmuş kullanıcılar otomatik `kyc_verified=False` olarak gelir;
 * bu da $3000+ teklif vermelerini bloklar. Admin elle override eder.
 *
 * Confirm flow inline — modal yok. Hata mesajı satırın sonuna yazılır.
 */
export function UserActions({
  userId,
  kycVerified,
}: {
  userId: string;
  kycVerified: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleKyc(): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/set-kyc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kyc_verified: !kycVerified }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "İşlem başarısız");
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-3 justify-end">
        <span className="text-xs text-charcoal-500">
          {kycVerified ? "KYC geri çekilsin mi?" : "KYC onaylansın mı?"}
        </span>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={pending}
          className="text-xs tracking-widest uppercase text-charcoal-300 hover:text-charcoal"
        >
          Vazgeç
        </button>
        <button
          type="button"
          onClick={toggleKyc}
          disabled={pending}
          className={`text-xs tracking-widest uppercase border-b pb-0.5 ${
            kycVerified
              ? "text-burgundy border-burgundy/40 hover:text-burgundy"
              : "text-olive border-olive/40 hover:text-olive"
          }`}
        >
          {pending ? "..." : kycVerified ? "Geri Çek" : "Onayla"}
        </button>
        {error && (
          <span className="text-xs text-burgundy max-w-[180px] truncate">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={`text-xs tracking-widest uppercase border-b pb-0.5 ${
        kycVerified
          ? "text-charcoal-500 hover:text-burgundy border-charcoal/20 hover:border-burgundy"
          : "text-brass-dark hover:text-brass border-brass/40"
      }`}
    >
      {kycVerified ? "KYC Geri Çek" : "KYC Onayla"}
    </button>
  );
}
