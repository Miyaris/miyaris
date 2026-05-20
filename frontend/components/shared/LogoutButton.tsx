"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
    router.push("/");
  }

  return (
    <button
      onClick={handleLogout}
      disabled={pending}
      className="text-sm tracking-wide text-charcoal-300 hover:text-charcoal transition-colors disabled:opacity-50"
    >
      Çıkış
    </button>
  );
}
