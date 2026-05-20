import { Container } from "@/components/shared/Container";
import { SellWatchForm } from "@/app/sell-watch/SellWatchForm";

export const metadata = { title: "Saatinizi Satın — Miyaris" };

export default function SellWatchPage() {
  return (
    <Container size="narrow" className="py-16">
      <div className="mb-12">
        <span className="eyebrow">Yeni İlan</span>
        <h1 className="font-display text-4xl mt-4">Saatinizi Satın</h1>
        <p className="text-charcoal-500 mt-3 leading-relaxed">
          İki yöntemden birini seçin: doğrudan sabit fiyatla satış veya haftalık
          açık artırma. Her ikisinde de partner mağaza ekspertizi zorunludur —
          akış ilan tipine göre değişir.
        </p>
      </div>
      <SellWatchForm />
    </Container>
  );
}
