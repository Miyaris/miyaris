"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FileUploader } from "@/components/shared/FileUploader";
import { Button } from "@/components/ui/Button";
import type { AuthenticityVerdict } from "@/lib/types";

interface VerdictOption {
  value: AuthenticityVerdict;
  label: string;
  effect: string;
  destructive?: boolean;
}

const VERDICT_OPTIONS: VerdictOption[] = [
  {
    value: "authentic",
    label: "Orijinal — Partner Mağaza Onaylı",
    effect: "Saat onaylanır; Müzayede ve Miyaris Mağaza için yayına hazır olur.",
  },
  {
    value: "service_parts",
    label: "Orijinal — Servis Parçalı",
    effect: "Saat onaylanır (servis notu eklenir) ve yayına alınır.",
  },
  {
    value: "inconclusive",
    label: "Karar Verilemedi",
    effect: "İlan reddedilir; ek inceleme talep edilir.",
  },
  {
    value: "not_authentic",
    label: "SAHTE — Satıcı Hesabı Süresiz Askıya Alınır",
    effect:
      "İlan reddedilir ve satıcının hesabı kalıcı olarak askıya alınır. " +
      "Bu işlem geri alınamaz; emin olmadıkça seçmeyin.",
    destructive: true,
  },
];

export function CertificateForm({ watchId }: { watchId: string }) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<AuthenticityVerdict>("authentic");
  const [notes, setNotes] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!pdfUrl) {
      setError("Ekspertiz belgesi yüklenmeden form gönderilemez");
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/admin/watches/${watchId}/certificate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdict,
          notes: notes.trim(),
          pdf_url: pdfUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Ekspertiz onayı kaydedilemedi");
        return;
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  const selected = VERDICT_OPTIONS.find((v) => v.value === verdict)!;
  const isDestructive = selected.destructive === true;

  return (
    <form
      onSubmit={onSubmit}
      className="border border-line p-6 bg-ivory-50 space-y-6"
    >
      <div>
        <span className="eyebrow text-charcoal mb-1 block">
          Ekspertiz Onayı (Partner Mağaza Teyidi)
        </span>
        <p className="text-xs text-charcoal-300 leading-relaxed">
          Anlaşmalı saatçi partnerinden fiziksel inceleme sonucu geldikten
          sonra bu formu doldurun. Saatin durumu otomatik olarak güncellenir;
          onay alana kadar saat müzayedeye çıkamaz.
        </p>
      </div>

      <div>
        <span className="eyebrow block mb-3">Partner Mağaza Verdict</span>
        <div className="space-y-2">
          {VERDICT_OPTIONS.map((opt) => {
            const isSelected = verdict === opt.value;
            const tone = opt.destructive
              ? isSelected
                ? "border-burgundy bg-burgundy/10"
                : "border-burgundy/30 hover:border-burgundy"
              : isSelected
                ? "border-charcoal bg-ivory"
                : "border-line hover:border-charcoal-300";
            return (
              <label
                key={opt.value}
                className={`flex items-start gap-3 cursor-pointer p-3 border transition-colors ${tone}`}
              >
                <input
                  type="radio"
                  name="verdict"
                  value={opt.value}
                  checked={isSelected}
                  onChange={(e) =>
                    setVerdict(e.target.value as AuthenticityVerdict)
                  }
                  className={`mt-1 ${opt.destructive ? "accent-burgundy" : "accent-charcoal"}`}
                />
                <div>
                  <div
                    className={`text-sm font-medium ${
                      opt.destructive ? "text-burgundy" : ""
                    }`}
                  >
                    {opt.label}
                  </div>
                  <div className="text-xs text-charcoal-300 mt-0.5 leading-relaxed">
                    {opt.effect}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <span className="eyebrow block mb-2">
          Ekspertiz Raporu Notları
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          required
          minLength={10}
          placeholder="Partner ekspert notları: hareket numarası, kasanın durumu, müdahale belirtileri, parça orijinalliği, kutu/kağıt uyumu..."
          className="block w-full border border-line p-3 text-sm bg-transparent focus:outline-none focus:border-brass transition-colors leading-relaxed"
        />
      </div>

      <div>
        <span className="eyebrow block mb-2">Ekspertiz Belgesi</span>
        <p className="text-xs text-charcoal-300 mb-3 leading-relaxed">
          Partner mağaza tarafından imzalanmış ekspertiz raporunu yükleyin —
          PDF veya fotoğraf olabilir. Telefondan çekip doğrudan
          ekleyebilirsiniz.
        </p>
        {pdfUrl ? (
          <div className="flex items-center justify-between gap-3 border border-line bg-ivory-50 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-brass-dark tracking-widest uppercase">
                Yüklendi
              </p>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-charcoal-700 hover:text-brass underline-offset-4 hover:underline truncate block"
              >
                {pdfUrl.split("/").pop() ?? "Belge"}
              </a>
            </div>
            <button
              type="button"
              onClick={() => setPdfUrl("")}
              className="text-xs uppercase tracking-widest text-charcoal-500 hover:text-burgundy border border-line px-3 py-1.5"
            >
              Değiştir
            </button>
          </div>
        ) : (
          <FileUploader
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
            label="Ekspertiz Belgesini Yükle"
            onUploaded={(url) => setPdfUrl(url)}
          />
        )}
        {/* Backend hâlâ pdf_url field'ı bekliyor — submit'te bu state gönderilir */}
        <input type="hidden" name="pdf_url" value={pdfUrl} />
      </div>

      {error && (
        <div className="text-sm text-burgundy border-l-2 border-burgundy pl-3">
          {error}
        </div>
      )}

      {isDestructive && (
        <div className="border-2 border-burgundy bg-burgundy/5 p-4 text-sm text-burgundy leading-relaxed">
          <strong className="block mb-1">⚠ Sahtecilik Müeyyidesi</strong>
          Bu seçim onaylandığında satıcının hesabı{" "}
          <strong>süresiz olarak askıya alınır</strong>, sisteme giriş yapamaz
          ve yeni ilan oluşturamaz. İşlem kalıcıdır. Sahteciliğin partner
          mağaza ekspertizinde kesin tespit edildiğinden emin olunuz.
        </div>
      )}

      <Button
        type="submit"
        size="md"
        disabled={pending}
        className={`w-full ${isDestructive ? "!bg-burgundy hover:!bg-burgundy/80" : ""}`}
      >
        {pending
          ? "Kaydediliyor..."
          : isDestructive
            ? "SAHTE — Hesabı Askıya Al & Reddet"
            : `Ekspertiz Onayını Kaydet — "${selected.label}"`}
      </Button>
    </form>
  );
}
