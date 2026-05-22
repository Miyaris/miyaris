"use client";

import { useState } from "react";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      // Önce backend'e POST at — Set-Cookie header'ı access + refresh
      // cookie'lerini siler. Hatada bile sayfayı yine yenilemeye devam et
      // (kullanıcı "çıktım" sandıktan sonra hâlâ giriş yapılı görünmesin).
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Network hatası bile olsa devam — alttaki hard reload her durumda
      // session'ı temizler.
    }
    // Hard reload: `router.refresh()` + `router.push()` bu akışta yetmiyor
    // çünkü Next.js layout'u Server Component ve `getCurrentUser()` zaten
    // cache'lenmiş cookie değerini okuyor. Tam sayfa yenileme tarayıcının
    // çerezsiz yeni request atmasını ve TÜM server bileşenlerinin sıfırdan
    // render olmasını garanti eder.
    window.location.href = "/";
  }

  return (
    <button
      onClick={handleLogout}
      disabled={pending}
      className="text-sm tracking-wide text-charcoal-300 hover:text-charcoal transition-colors disabled:opacity-50"
    >
      {pending ? "Çıkış yapılıyor..." : "Çıkış"}
    </button>
  );
}
