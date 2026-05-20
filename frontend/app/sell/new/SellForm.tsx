// Bu component artık kullanılmıyor. /sell/new sayfası /sell-watch'a kalıcı
// olarak redirect yapıyor; yeni form `app/sell-watch/SellWatchForm.tsx`
// içinde. Dead code olarak kalmaması için boşaltıldı; ileride dosyayı tümden
// silmek güvenli.
//
// Kullanan yoksa bundle'a girmez, ama referans varsa import hatası vermesin
// diye basit bir no-op export bırakıyoruz.
export function SellForm(): null {
  return null;
}
