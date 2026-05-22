"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Props {
  token: string;
}

export function ResetPasswordForm({ token }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const newPassword = String(fd.get("new_password") ?? "");
    const confirm = String(fd.get("confirm_password") ?? "");

    if (newPassword.length < 8) {
      setError("Şifreniz en az 8 karakter olmalı");
      return;
    }
    if (newPassword !== confirm) {
      setError("Şifreler eşleşmiyor");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.detail ?? "Şifre güncellenemedi");
        return;
      }
      setSuccess(true);
      // 3 saniye sonra giriş sayfasına yönlendir
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="border border-brass/40 bg-brass/5 p-8 text-center">
        <span className="eyebrow text-brass-dark">Başarılı</span>
        <h2 className="font-display text-2xl mt-4 mb-4">
          Şifreniz Güncellendi
        </h2>
        <p className="text-sm text-charcoal-700 leading-relaxed">
          Yeni şifrenizle artık giriş yapabilirsiniz. Giriş sayfasına
          yönlendiriliyorsunuz...
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="text-xs uppercase tracking-widest text-brass hover:text-charcoal border-b border-current pb-0.5"
          >
            Hemen Giriş Yap
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <Input
        name="new_password"
        type="password"
        label="Yeni Şifre"
        autoComplete="new-password"
        required
        minLength={8}
        hint="En az 8 karakter"
      />
      <Input
        name="confirm_password"
        type="password"
        label="Yeni Şifre (Tekrar)"
        autoComplete="new-password"
        required
        minLength={8}
      />

      {error && (
        <div className="text-sm text-burgundy border-l-2 border-burgundy pl-3">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Güncelleniyor..." : "Şifreyi Güncelle"}
      </Button>

      <p className="text-xs text-charcoal-300 text-center leading-relaxed">
        Bağlantı bir saat içinde geçerliliğini yitirir. Süresi dolduysa
        yeni bir sıfırlama bağlantısı talep etmeniz gerekir.
      </p>
    </form>
  );
}
