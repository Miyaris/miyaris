"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Backend enumeration leak'ini engellemek için her zaman aynı 200 dönüyor;
  // bu yüzden başarılı submit sonrası tek bir teyit ekranı gösteriyoruz.
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.detail ?? "Talep işlenemedi");
        return;
      }
      setSubmittedEmail(email);
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  if (submittedEmail) {
    return (
      <div className="border border-line bg-ivory-50 p-8 text-center">
        <span className="eyebrow text-brass-dark">Talep Alındı</span>
        <h2 className="font-display text-2xl mt-4 mb-4">
          E-postanızı kontrol edin
        </h2>
        <p className="text-sm text-charcoal-700 leading-relaxed">
          Eğer <strong>{submittedEmail}</strong> adresi sistemimizde
          kayıtlıysa, kısa süre içinde size bir şifre sıfırlama bağlantısı
          gönderilecektir. Bağlantı bir saat boyunca geçerlidir.
        </p>
        <p className="text-xs text-charcoal-300 mt-6 leading-relaxed">
          Mail kutunuzda görmüyorsanız spam veya tanıtım sekmesini de
          kontrol edin. Hesap kayıtlı değilse, güvenlik gereği aynı teyit
          mesajını gösteriyoruz fakat e-posta gönderilmez.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <Input
        name="email"
        type="email"
        label="E-posta"
        autoComplete="email"
        required
        hint="Hesabınızda kayıtlı olan adres"
      />

      {error && (
        <div className="text-sm text-burgundy border-l-2 border-burgundy pl-3">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
      </Button>
    </form>
  );
}
