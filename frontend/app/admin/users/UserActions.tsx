"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Kullanıcı satırı için admin override aksiyonları.
 *
 * İki aksiyon var:
 *   - KYC onayla / KYC geri çek — NVI_VERIFICATION_ENABLED=false iken kayıt
 *     olmuş kullanıcılar otomatik kyc_verified=False; bu da $3000+ teklif
 *     vermelerini bloklar. Admin elle override eder.
 *   - Presenter yetkisi ver / geri çek — `/presenter/*` canlı müzayede
 *     sunucu paneline erişim. Rol'den bağımsız; kullanıcının rolü buyer/
 *     seller/expert/admin olabilir, hala presenter olabilir.
 *
 * Tüm confirm flow inline — modal yok. Aynı anda yalnızca bir aksiyon
 * confirming olabilir (state tek slot).
 */
type Pending = "kyc" | "presenter" | null;

export function UserActions({
  userId,
  kycVerified,
  isPresenter,
}: {
  userId: string;
  kycVerified: boolean;
  isPresenter: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [confirming, setConfirming] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(
    which: "kyc" | "presenter",
    path: string,
    body: Record<string, boolean>,
  ): Promise<void> {
    setError(null);
    setPending(which);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "İşlem başarısız");
        return;
      }
      setConfirming(null);
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(null);
    }
  }

  // ---- Confirm satırları ----------------------------------------------------
  if (confirming === "kyc") {
    return (
      <ConfirmRow
        message={kycVerified ? "KYC geri çekilsin mi?" : "KYC onaylansın mı?"}
        confirmLabel={kycVerified ? "Geri Çek" : "Onayla"}
        accent={kycVerified ? "burgundy" : "olive"}
        pending={pending === "kyc"}
        error={error}
        onCancel={() => {
          setConfirming(null);
          setError(null);
        }}
        onConfirm={() =>
          run("kyc", `/api/admin/users/${userId}/set-kyc`, {
            kyc_verified: !kycVerified,
          })
        }
      />
    );
  }

  if (confirming === "presenter") {
    return (
      <ConfirmRow
        message={
          isPresenter
            ? "Presenter yetkisi geri çekilsin mi?"
            : "Presenter yetkisi verilsin mi?"
        }
        confirmLabel={isPresenter ? "Geri Çek" : "Yetki Ver"}
        accent={isPresenter ? "burgundy" : "brass"}
        pending={pending === "presenter"}
        error={error}
        onCancel={() => {
          setConfirming(null);
          setError(null);
        }}
        onConfirm={() =>
          run("presenter", `/api/admin/users/${userId}/set-presenter`, {
            is_presenter: !isPresenter,
          })
        }
      />
    );
  }

  // ---- İdle durum: iki buton yan yana ---------------------------------------
  return (
    <div className="inline-flex items-center gap-3 justify-end">
      <button
        type="button"
        onClick={() => setConfirming("kyc")}
        className={`text-xs tracking-widest uppercase border-b pb-0.5 ${
          kycVerified
            ? "text-charcoal-500 hover:text-burgundy border-charcoal/20 hover:border-burgundy"
            : "text-olive hover:text-olive border-olive/40"
        }`}
      >
        {kycVerified ? "KYC Çek" : "KYC Onayla"}
      </button>
      <span className="text-charcoal-300">·</span>
      <button
        type="button"
        onClick={() => setConfirming("presenter")}
        className={`text-xs tracking-widest uppercase border-b pb-0.5 ${
          isPresenter
            ? "text-charcoal-500 hover:text-burgundy border-charcoal/20 hover:border-burgundy"
            : "text-brass-dark hover:text-brass border-brass/40"
        }`}
      >
        {isPresenter ? "Presenter Çek" : "Presenter Ver"}
      </button>
    </div>
  );
}

function ConfirmRow({
  message,
  onCancel,
  onConfirm,
  pending,
  accent,
  confirmLabel,
  error,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  accent: "brass" | "burgundy" | "olive";
  confirmLabel: string;
  error: string | null;
}) {
  const accentCls =
    accent === "brass"
      ? "text-brass-dark border-brass/40 hover:text-brass"
      : accent === "olive"
        ? "text-olive border-olive/40 hover:text-olive"
        : "text-burgundy border-burgundy/40 hover:text-burgundy";
  return (
    <div className="flex items-center gap-3 justify-end">
      <span className="text-xs text-charcoal-500">{message}</span>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="text-xs tracking-widest uppercase text-charcoal-300 hover:text-charcoal"
      >
        Vazgeç
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={pending}
        className={`text-xs tracking-widest uppercase border-b pb-0.5 ${accentCls}`}
      >
        {pending ? "..." : confirmLabel}
      </button>
      {error && (
        <span className="text-xs text-burgundy max-w-[180px] truncate">
          {error}
        </span>
      )}
    </div>
  );
}
