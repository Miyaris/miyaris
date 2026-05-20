import { redirect } from "next/navigation";

/**
 * /marketplace artık ikiye bölündü:
 *   - /auctions → Müzayedeler
 *   - /shop     → Miyaris Mağaza (Hemen Al)
 *
 * Geriye dönük uyumluluk için bu rota /shop'a permanent redirect yapar.
 */
export default function MarketplaceRedirect() {
  redirect("/shop");
}
