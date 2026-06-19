import Link from "next/link";

import { Container } from "@/components/shared/Container";

export const metadata = { title: "E-postanı Doğrula" };
export const dynamic = "force-dynamic";

/**
 * Kayıt başarısı sonrası iniş ekranı.
 *
 * Tasarım kararları:
 *  - Kırmızı uyarı/error stilinden uzak; altın aksan ile lüks/davetkâr ton.
 *  - "Kayıt başarısız" hissi vermemesi için NO error icon, NO burgundy.
 *  - Kullanıcının baktığı e-posta adresini geri yansıt (URL'den alır), "hangi
 *    kutuya bakmam gerekiyor?" sorusunu cevaplasin.
 *  - Sonraki aksiyon: kullanıcı e-postasındaki linke tıklayacak, bu sayfanın
 *    "iş bitti, beklemedeyim" mesajı vermesi yeter. Login butonu da var (link
 *    geldiğinde gerek olmasa bile mental flow için kapı açık).
 */
export default function CheckEmailPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const email = (searchParams.email ?? "").trim();

  return (
    <Container size="narrow" className="py-24">
      <div className="text-center">
        <span className="eyebrow text-brass">Hesabın Hazır</span>
        <h1 className="font-display text-4xl mt-4 mb-6">
          E-postanı kontrol et
        </h1>

        <p className="text-charcoal-700 leading-relaxed max-w-xl mx-auto mb-4">
          Hesabın başarıyla oluşturuldu. Doğrulama linkini içeren bir e-posta
          {email ? (
            <>
              {" "}
              <strong className="text-charcoal">{email}</strong> adresine
              gönderdik.
            </>
          ) : (
            <> e-posta adresine gönderdik.</>
          )}
        </p>

        <p className="text-charcoal-500 leading-relaxed max-w-xl mx-auto">
          Mailde gelen{" "}
          <strong className="text-charcoal-700">"E-postamı Doğrula"</strong>{" "}
          butonuna tıkladıktan sonra Miyaris'in tüm vitrinlerine, müzayedelere
          ve Güvenli Kasa akışına erişim açılır.
        </p>

        {/* Bilgi kutucuğu — altın aksan, kırmızı yok */}
        <div className="mt-12 max-w-md mx-auto border-l-2 border-brass/40 bg-brass/5 px-6 py-5 text-left">
          <p className="text-xs tracking-widest uppercase text-brass-dark mb-2">
            Maile birkaç dakika içinde ulaşmazsa
          </p>
          <ul className="text-sm text-charcoal-700 leading-relaxed space-y-1.5 list-disc list-inside marker:text-brass-dark/60">
            <li>İstenmeyen / Gereksiz klasörünü kontrol et</li>
            <li>Doğrulama linki 24 saat geçerli</li>
            <li>
              Yeni link için{" "}
              <Link
                href="/login"
                className="text-brass-dark border-b border-brass/40 hover:text-brass"
              >
                giriş sayfasından
              </Link>{" "}
              tekrar gönderebilirsin
            </li>
          </ul>
        </div>

        <div className="mt-12 flex items-center justify-center gap-6">
          <Link
            href="/"
            className="text-xs tracking-widest uppercase text-charcoal-700 border border-charcoal px-6 py-3 hover:bg-charcoal hover:text-ivory transition-colors"
          >
            Ana Sayfa
          </Link>
          <Link
            href="/auctions"
            className="text-xs tracking-widest uppercase text-brass-dark border-b border-brass/40 pb-0.5 hover:text-brass"
          >
            Müzayedeleri Keşfet →
          </Link>
        </div>
      </div>
    </Container>
  );
}
