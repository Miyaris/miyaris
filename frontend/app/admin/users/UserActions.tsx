"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Kullanıcı satırı için admin override aksiyonları — kompakt dropdown UI.
 *
 * Tek "Yönet ▾" butonu satırda yer alır; tıklanınca dropdown menü açılır.
 * Aksiyon seçilince inline confirm satırına dönüşür. Dropdown click-outside
 * veya escape ile kapanır.
 *
 * Aksiyonlar:
 *   - KYC onayla / KYC geri çek
 *   - Presenter yetkisi ver / geri çek
 *   - Pasifleştir / Aktif Et (soft delete, geri alınabilir)
 *   - Sil (hard delete, bid/escrow varsa 409)
 */
type Action = "kyc" | "presenter" | "active" | "delete";

export function UserActions({
  userId,
  kycVerified,
  isPresenter,
  isActive,
}: {
  userId: string;
  kycVerified: boolean;
  isPresenter: boolean;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [confirming, setConfirming] = useState<Action | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click-outside ile menüyü kapat
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [menuOpen]);

  async function postAction(
    which: Action,
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

  async function deleteUser(): Promise<void> {
    setError(null);
    setPending("delete");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.detail ?? "Silme başarısız");
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

  // ---- Confirm satırları (menü kapanır, aksiyona göre inline confirm) ----
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
          postAction("kyc", `/api/admin/users/${userId}/set-kyc`, {
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
          postAction("presenter", `/api/admin/users/${userId}/set-presenter`, {
            is_presenter: !isPresenter,
          })
        }
      />
    );
  }

  if (confirming === "active") {
    return (
      <ConfirmRow
        message={
          isActive
            ? "Hesap pasifleştirilsin mi? (Kullanıcı giriş yapamaz)"
            : "Hesap yeniden aktif edilsin mi?"
        }
        confirmLabel={isActive ? "Pasifleştir" : "Aktif Et"}
        accent={isActive ? "burgundy" : "olive"}
        pending={pending === "active"}
        error={error}
        onCancel={() => {
          setConfirming(null);
          setError(null);
        }}
        onConfirm={() =>
          postAction("active", `/api/admin/users/${userId}/set-active`, {
            is_active: !isActive,
          })
        }
      />
    );
  }

  if (confirming === "delete") {
    return (
      <ConfirmRow
        message="Hesap kalıcı silinecek. Geri alınamaz. Emin misin?"
        confirmLabel="Kalıcı Sil"
        accent="burgundy"
        pending={pending === "delete"}
        error={error}
        onCancel={() => {
          setConfirming(null);
          setError(null);
        }}
        onConfirm={deleteUser}
      />
    );
  }

  // ---- Idle: "Yönet ▾" butonu + dropdown -----------------------------------
  return (
    <div className="relative inline-block text-right" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="text-xs tracking-widest uppercase text-charcoal-700 border border-line px-4 py-2 hover:border-charcoal hover:bg-ivory-50 transition-colors"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        Yönet <span className="text-charcoal-300 ml-1">▾</span>
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-20 min-w-[200px] bg-white border border-line shadow-md"
        >
          <MenuItem
            label={kycVerified ? "KYC Geri Çek" : "KYC Onayla"}
            tone={kycVerified ? "muted" : "olive"}
            onClick={() => {
              setMenuOpen(false);
              setConfirming("kyc");
            }}
          />
          <MenuItem
            label={isPresenter ? "Presenter Geri Çek" : "Presenter Yetki Ver"}
            tone={isPresenter ? "muted" : "brass"}
            onClick={() => {
              setMenuOpen(false);
              setConfirming("presenter");
            }}
          />
          <MenuItem
            label={isActive ? "Pasifleştir" : "Aktif Et"}
            tone={isActive ? "muted" : "olive"}
            onClick={() => {
              setMenuOpen(false);
              setConfirming("active");
            }}
          />
          <div className="border-t border-line" />
          <MenuItem
            label="Hesabı Sil"
            tone="burgundy"
            onClick={() => {
              setMenuOpen(false);
              setConfirming("delete");
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: "muted" | "olive" | "brass" | "burgundy";
  onClick: () => void;
}) {
  const toneCls =
    tone === "olive"
      ? "text-olive hover:bg-olive/5"
      : tone === "brass"
        ? "text-brass-dark hover:bg-brass/5"
        : tone === "burgundy"
          ? "text-burgundy hover:bg-burgundy/5"
          : "text-charcoal-700 hover:bg-ivory-50";
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`block w-full text-left text-xs tracking-widest uppercase px-4 py-3 transition-colors ${toneCls}`}
    >
      {label}
    </button>
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
    <div className="flex items-center gap-3 justify-end flex-wrap">
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
