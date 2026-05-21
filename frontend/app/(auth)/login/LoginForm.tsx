"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type LoginError =
  | { kind: "generic"; message: string }
  | { kind: "email_not_verified"; message: string; email: string };

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<LoginError | null>(null);
  const [pending, setPending] = useState(false);
  // resend-verification ikincil state'i: idle / sending / sent / failed
  const [resendStatus, setResendStatus] = useState<
    "idle" | "sending" | "sent" | "failed"
  >("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResendStatus("idle");
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: fd.get("password"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.code === "email_not_verified") {
          setError({
            kind: "email_not_verified",
            message: data.detail ?? "E-posta adresiniz henüz doğrulanmadı.",
            email,
          });
        } else {
          setError({
            kind: "generic",
            message: data?.detail ?? "Giriş başarısız",
          });
        }
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError({ kind: "generic", message: "Bağlantı hatası" });
    } finally {
      setPending(false);
    }
  }

  async function resendVerification(email: string) {
    if (!email) return;
    setResendStatus("sending");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResendStatus(res.ok ? "sent" : "failed");
    } catch {
      setResendStatus("failed");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <Input
        name="email"
        type="email"
        label="E-posta"
        autoComplete="email"
        required
      />
      <Input
        name="password"
        type="password"
        label="Şifre"
        autoComplete="current-password"
        required
      />

      {error?.kind === "generic" && (
        <div className="text-sm text-burgundy border-l-2 border-burgundy pl-3">
          {error.message}
        </div>
      )}

      {error?.kind === "email_not_verified" && (
        <div className="border border-brass/40 bg-brass/5 p-4 space-y-3">
          <p className="text-sm text-charcoal-700 leading-relaxed">
            {error.message}
          </p>
          {resendStatus === "sent" ? (
            <p className="text-xs text-charcoal-500">
              Yeni doğrulama linki gönderildi. Lütfen e-postanızı kontrol edin.
            </p>
          ) : resendStatus === "failed" ? (
            <p className="text-xs text-burgundy">
              Tekrar gönderim başarısız oldu. Birkaç dakika sonra tekrar deneyin.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => resendVerification(error.email)}
              disabled={resendStatus === "sending"}
              className="text-xs uppercase tracking-wider text-brass hover:text-charcoal underline-offset-4 hover:underline disabled:opacity-50"
            >
              {resendStatus === "sending"
                ? "Gönderiliyor..."
                : "Doğrulama linkini tekrar gönder"}
            </button>
          )}
        </div>
      )}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Giriş yapılıyor..." : "Giriş Yap"}
      </Button>
    </form>
  );
}
