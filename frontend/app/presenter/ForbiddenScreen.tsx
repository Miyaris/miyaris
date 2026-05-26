import Link from "next/link";

/**
 * Yetkisiz kullanıcılar için 403 ekranı.
 *
 * Server-rendered, tek dosya — Container'a sarmıyoruz çünkü presenter
 * rotası tam ekran çalışacak ve aynı palette devamlılığı istiyoruz.
 * Kullanıcının e-postası gösterilir ki "yanlış hesapla mı giriş yaptım?"
 * sorusunun cevabı bir bakışta okunsun.
 */
export function ForbiddenScreen({ userEmail }: { userEmail: string }) {
  return (
    <main className="min-h-screen bg-ivory flex items-center justify-center px-6">
      <div className="max-w-xl w-full text-center">
        <p className="eyebrow text-burgundy mb-6">403 — Erişim Reddedildi</p>

        <h1 className="font-display text-5xl text-charcoal mb-6 leading-tight">
          Bu sayfaya erişim
          <br />
          yetkiniz bulunmuyor.
        </h1>

        <p className="text-charcoal-500 leading-relaxed mb-2">
          Canlı müzayede sunucu paneli yalnızca yetkilendirilmiş
          mezatçılar için açıktır.
        </p>
        <p className="text-charcoal-500 leading-relaxed mb-12">
          Yetki talebi için Miyaris ekibiyle iletişime geçin.
        </p>

        <div className="inline-flex items-center gap-2 text-xs tracking-widest uppercase text-charcoal-300 mb-12">
          <span className="w-1.5 h-1.5 rounded-full bg-charcoal-300" />
          <span>Giriş yapan hesap: {userEmail}</span>
        </div>

        <div className="flex items-center justify-center gap-6">
          <Link
            href="/"
            className="text-xs tracking-widest uppercase text-charcoal-700 border border-charcoal px-6 py-3 hover:bg-charcoal hover:text-ivory transition-colors"
          >
            Anasayfa
          </Link>
          <Link
            href="/auctions"
            className="text-xs tracking-widest uppercase text-brass-dark border-b border-brass/40 pb-0.5 hover:text-brass"
          >
            Müzayedeleri Gör →
          </Link>
        </div>
      </div>
    </main>
  );
}
