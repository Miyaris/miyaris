"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    try {
      const birthYearStr = fd.get("birth_year") as string | null;
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: fd.get("email"),
          password: fd.get("password"),
          first_name: (fd.get("first_name") as string | null)?.trim(),
          last_name: (fd.get("last_name") as string | null)?.trim(),
          birth_year: birthYearStr ? parseInt(birthYearStr, 10) : null,
          phone: fd.get("phone") || null,
          tc_kimlik_no: (fd.get("tc_kimlik_no") as string | null)?.trim(),
          mersis_no:
            (fd.get("mersis_no") as string | null)?.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Kayıt başarısız");
        return;
      }
      // Yeni kullanıcı doğrudan ana sayfaya yönlendirilir — site vitrini
      // (öne çıkan saatler + güven sütunları) lüks alışveriş hissiyatını
      // sıfırdan koruyor; bonus olarak henüz e-postasını doğrulamamış
      // kullanıcı login akışına geri girmek zorunda kalmasın diye giriş
      // ekranı yerine ana sayfa.
      router.push("/");
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setPending(false);
    }
  }

  const currentYear = new Date().getFullYear();

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Ad / Soyad — yan yana grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Input
          name="first_name"
          label="Ad"
          autoComplete="given-name"
          required
          minLength={2}
          maxLength={80}
          hint="Nüfus cüzdanınızdaki yazımıyla aynı"
        />
        <Input
          name="last_name"
          label="Soyad"
          autoComplete="family-name"
          required
          minLength={2}
          maxLength={80}
          hint="Nüfus cüzdanınızdaki yazımıyla aynı"
        />
      </div>

      <Input
        name="email"
        type="email"
        label="E-posta"
        autoComplete="email"
        required
      />
      <Input
        name="phone"
        type="tel"
        label="Telefon (opsiyonel)"
        autoComplete="tel"
      />
      <Input
        name="password"
        type="password"
        label="Şifre"
        autoComplete="new-password"
        required
        minLength={8}
        hint="En az 8 karakter"
      />

      {/* KYC bölümü — yasal düzenleme + NVİ devlet doğrulaması */}
      <div className="border-t border-line pt-8 space-y-6">
        <div>
          <span className="eyebrow text-brass-dark block mb-2">
            Kimlik Doğrulaması (NVİ)
          </span>
          <p className="text-xs text-charcoal-500 leading-relaxed">
            Yasal düzenlemeler gereği güvenli ve şeffaf işlem için kimlik
            bilgileriniz zorunludur. Girdiğiniz bilgiler{" "}
            <strong>Nüfus ve Vatandaşlık İşleri (NVİ) devlet sistemi</strong>{" "}
            üzerinden gerçek zamanlı doğrulanır; eşleşmediği takdirde kayıt
            tamamlanmaz. Bilgileriniz şifreli olarak saklanır.
          </p>
        </div>

        <Input
          name="tc_kimlik_no"
          type="text"
          inputMode="numeric"
          pattern="[1-9][0-9]{10}"
          label="T.C. Kimlik Numarası"
          autoComplete="off"
          required
          minLength={11}
          maxLength={11}
          hint="11 haneli, 0 ile başlayamaz"
        />

        <Input
          name="birth_year"
          type="number"
          inputMode="numeric"
          label="Doğum Yılı"
          autoComplete="bday-year"
          required
          min={1900}
          max={currentYear}
          placeholder="1990"
          hint="NVİ doğrulaması için zorunlu — sadece yıl (örn. 1990)"
        />

        <Input
          name="mersis_no"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{16}"
          label="MERSİS Numarası (kurumsal — opsiyonel)"
          autoComplete="off"
          minLength={16}
          maxLength={16}
          hint="Kurumsal satıcılar için 16 haneli MERSİS no"
        />
      </div>

      {error && (
        <div className="text-sm text-burgundy border-l-2 border-burgundy pl-3 leading-relaxed">
          {error}
        </div>
      )}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "NVİ Doğrulaması Yapılıyor..." : "Hesap Oluştur"}
      </Button>
    </form>
  );
}
