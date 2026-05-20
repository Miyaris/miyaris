"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";

export function RejectForm({ watchId }: { watchId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/watches/${watchId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Red başarısız");
        return;
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-xs tracking-widest uppercase text-charcoal-500 hover:text-burgundy border border-line py-3 transition-colors"
      >
        Sertifikasız Reddet
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-burgundy/30 p-6 bg-burgundy/5 space-y-4"
    >
      <div>
        <span className="eyebrow text-burgundy block mb-1">
          Sertifikasız Red
        </span>
        <p className="text-xs text-charcoal-500 leading-relaxed">
          Saatin fiziksel olarak gelmemesi, duplicate ilan veya operasyonel
          sebepler için. Sertifika çıkartılmaz.
        </p>
      </div>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        required
        minLength={10}
        placeholder="Red sebebi (en az 10 karakter)..."
        className="block w-full border border-burgundy/30 p-3 text-sm bg-transparent focus:outline-none focus:border-burgundy transition-colors"
      />

      {error && (
        <div className="text-sm text-burgundy border-l-2 border-burgundy pl-3">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setReason("");
            setError(null);
          }}
          disabled={pending}
          className="flex-1 text-xs tracking-widest uppercase text-charcoal-500 hover:text-charcoal py-3"
        >
          İptal
        </button>
        <Button
          type="submit"
          size="md"
          disabled={pending}
          className="flex-1 !bg-burgundy hover:!bg-burgundy/80"
        >
          {pending ? "..." : "Reddet"}
        </Button>
      </div>
    </form>
  );
}
