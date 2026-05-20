import { redirect } from "next/navigation";

/**
 * Eski satış formu rotası — `/sell-watch` yeni iki-vitrin formuna evrildi.
 *
 * Eski `/sell/new` URL'i artık `/sell-watch`'a kalıcı yönlendirir. Bookmark
 * veya eski linklerden gelen kullanıcılar yeni form'u görür; ilan tipi
 * seçici, asking_price input'u ve kademeli komisyon widget'ı orada.
 */
export default function SellNewRedirect() {
  redirect("/sell-watch");
}
