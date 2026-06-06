// Backend DTO'ları ile birebir hizalı tipler.
// Backend Pydantic şemaları değişirse bu dosya da güncellenmeli.

export type UserRole = "buyer" | "seller" | "expert" | "admin";

export type WatchStatus =
  | "draft"
  | "pending_review"
  | "pending_pre_expertise"
  | "active"
  | "awaiting_expertise"
  | "sold"
  | "rejected";

export type ListingType = "direct_sale" | "auction";

export type WatchCondition =
  | "new"
  | "mint"
  | "excellent"
  | "good"
  | "fair";

export type AuctionStatus =
  | "scheduled"
  | "live"
  | "ended"
  | "completed"
  | "cancelled";

export type AIProcessingStatus =
  | "none"
  | "queued"
  | "processing"
  | "done"
  | "failed";

export interface UserPublic {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  kyc_verified: boolean;
  is_verified?: boolean;
  /** Admin tarafından verilen canlı müzayede sunucu (Presenter) yetkisi.
   *  `/presenter/*` layout guard'ı bu alanı okur. */
  is_presenter?: boolean;
  tc_kimlik_no: string | null;
  mersis_no: string | null;
  created_at: string;
}

// Admin panelindeki kullanıcılar tablosu için kompakt DTO — backend
// `AdminUserListItem` ile birebir.
export interface AdminUserListItem {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_verified: boolean;
  is_active: boolean;
  kyc_verified: boolean;
  is_presenter: boolean;
  created_at: string;
}

export interface AdminUserListResponse {
  items: AdminUserListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface WatchImage {
  id: string;
  url: string;
  sort_order: number;
  is_primary: boolean;
}

export interface WatchPublic {
  id: string;
  seller_id: string;
  brand: string;
  model: string;
  reference_number: string;
  year: number; // ZORUNLU — değerleme için birincil kriter
  serial_number: string | null;
  box_papers: boolean;
  condition: WatchCondition;
  description: string;
  seo_description: string | null;
  slug: string;
  status: WatchStatus;
  listing_type: ListingType;
  asking_price: string | null;
  ai_processing_status: AIProcessingStatus;
  images: WatchImage[];
  created_at: string;
}

export interface AIValuationOut {
  id: string;
  estimated_value_min: string;
  estimated_value_max: string;
  confidence_score: number;
  sources: Record<string, unknown>;
  agent_version: string;
  raw_output: Record<string, unknown>;
  created_at: string;
}

export interface WatchOwnerDetail extends WatchPublic {
  ai_processing_error: string | null;
  latest_valuation: AIValuationOut | null;
  delivery_code: string | null;
}

export interface AuctionListItem {
  id: string;
  watch_id: string;
  brand: string;
  model: string;
  current_price: string; // Decimal — backend string olarak döndürür
  buy_it_now_price: string | null;
  ends_at: string;
  status: AuctionStatus;
  primary_image_url: string | null;
}

export interface AuctionPublic {
  id: string;
  watch: WatchPublic;
  starting_price: string;
  reserve_price: string | null;
  buy_it_now_price: string | null;
  min_bid_increment: string;
  current_price: string;
  starts_at: string;
  ends_at: string;
  extended_until: string | null;
  status: AuctionStatus;
  bid_count: number;
}

// === Presenter Müzayede Oturumu ===
// Backend `PresenterSession*` DTO'ları ile birebir.

/** Admin paneli için presenter oturum kartı (presenter kimlik bilgisi dahil). */
export interface AdminPresenterSessionListItem {
  id: string;
  presenter_name: string;
  presenter_email: string;
  name: string;
  description: string | null;
  scheduled_at: string;
  status: string;
  is_hidden: boolean;
  lot_count: number;
  cover_image_url: string | null;
}

export type PresenterSessionStatus =
  | "planning"
  | "live"
  | "ended"
  | "cancelled";

export interface PresenterSessionListItem {
  id: string;
  name: string;
  description: string | null;
  scheduled_at: string;
  status: PresenterSessionStatus;
  is_hidden: boolean;
  lot_count: number;
  cover_image_url: string | null;
}

export interface PresenterLotListItem {
  auction_id: string;
  watch_id: string;
  brand: string;
  model: string;
  reference_number: string;
  primary_image_url: string | null;
  starting_price: string;
  current_price: string;
  buy_it_now_price: string | null;
  status: AuctionStatus;
  bid_count: number;
}

export interface PresenterSessionDetail {
  id: string;
  name: string;
  description: string | null;
  scheduled_at: string;
  status: PresenterSessionStatus;
  is_hidden: boolean;
  presenter_name: string;
  lots: PresenterLotListItem[];
}

export interface PublicSessionListItem {
  id: string;
  name: string;
  scheduled_at: string;
  status: PresenterSessionStatus;
  presenter_name: string;
  lot_count: number;
  cover_image_url: string | null;
}

export interface PublicSessionDetail {
  id: string;
  name: string;
  description: string | null;
  scheduled_at: string;
  status: PresenterSessionStatus;
  presenter_name: string;
  lots: PresenterLotListItem[];
}

/** POST /api/presenter/sessions body. */
export interface PresenterSessionCreatePayload {
  name: string;
  scheduled_at: string; // ISO 8601 + tz offset
  description?: string | null;
}

/** POST /api/presenter/sessions/{id}/lots body. */
export interface PresenterLotCreatePayload {
  brand: string;
  model: string;
  reference_number: string;
  year: number;
  condition: WatchCondition;
  description: string;
  serial_number?: string | null;
  box_papers: boolean;
  image_urls: string[];
  starting_price: string;
  min_bid_increment?: string;
  reserve_price?: string | null;
  buy_it_now_price?: string | null;
}

/** Kullanıcının bir müzayededeki kapora (deposit) durumu.
 *  Backend `DepositStatus` ile birebir. Teklif verme ekranında bu durum
 *  kontrol edilir — `deposit_paid=false` ise "Kapora Öde" modali açılır. */
export interface DepositStatus {
  auction_id: string;
  required_deposit_amount: string;
  deposit_paid: boolean;
  deposit_paid_at: string | null;
}

export interface BidPublic {
  /** Backend gerçek bidder kimliğini sızdırmaz; anonim 'Üye #A1B2C3' formatlı
   *  deterministik etiket gönderir. Aynı kullanıcı her teklifte aynı alias'i
   *  alır — bid history içinde tutarlı görünüm. */
  id: string;
  auction_id: string;
  bidder_alias: string;
  amount: string;
  placed_at: string;
  is_proxy: boolean;
}

export interface MyAuctionParticipation {
  auction_id: string;
  watch_id: string;
  brand: string;
  model: string;
  primary_image_url: string | null;
  my_highest_bid: string;
  current_price: string;
  is_leading: boolean;
  status: AuctionStatus;
  ends_at: string;
  extended_until: string | null;
  bid_count: number;
}

// === Escrow types ===

export type EscrowStatus =
  | "pending_payment"
  | "funded"
  | "awaiting_authentication"
  | "authenticated"
  | "shipped_to_buyer"
  | "delivered"
  | "released"
  | "refunded"
  | "disputed";

export type DeliveryMethod = "shipping" | "store_pickup";
export type PaymentMethod = "credit_card" | "bank_transfer";

/** YASAL: kredi kartı surcharge'ı yok; BANK_TRANSFER seçince %2.5 EFT indirimi.
 *  Frontend canlı indirim hesabını bu sabitle yapar; backend de aynı oranı
 *  uygular (escrow_service.EFT_DISCOUNT_RATE). */
export const EFT_DISCOUNT_RATE = 0.025;

export interface EscrowListItem {
  id: string;
  auction_id: string;
  watch_id: string;
  watch_brand: string;
  watch_model: string;
  watch_image_url: string | null;
  counterparty_name: string;
  amount: string;
  status: EscrowStatus;
  delivery_method: DeliveryMethod | null;
  payment_method: PaymentMethod | null;
  created_at: string;
}

export interface EscrowDetail {
  id: string;
  auction_id: string;
  watch_id: string;
  watch_brand: string;
  watch_model: string;
  watch_reference: string;
  watch_image_url: string | null;
  watch_listing_type: ListingType;
  buyer_id: string;
  buyer_name: string;
  seller_id: string;
  seller_name: string;
  amount: string;             // Standart fiyat (pre-discount)
  discount_amount: string;    // EFT indirimi tutarı (0 = indirim yok)
  platform_fee: string;
  status: EscrowStatus;
  delivery_method: DeliveryMethod | null;
  payment_method: PaymentMethod | null;
  payment_provider_ref: string | null;
  funded_at: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

// Admin / Expert moderation tipleri

export type AuthenticityVerdict =
  | "authentic"
  | "service_parts"
  | "not_authentic"
  | "inconclusive";

export interface AdminSellerInfo {
  id: string;
  full_name: string;
  email: string;
  kyc_verified: boolean;
}

export interface AdminWatchListItem {
  id: string;
  brand: string;
  model: string;
  reference_number: string;
  year: number | null;
  condition: WatchCondition;
  status: WatchStatus;
  ai_processing_status: AIProcessingStatus;
  seller_name: string;
  seller_email: string;
  primary_image_url: string | null;
  has_valuation: boolean;
  created_at: string;
}

export type AdminAuctionStatus = "scheduled" | "live" | "ended" | "completed" | "cancelled";

export interface AdminAuctionListItem {
  id: string;
  watch_id: string;
  brand: string;
  model: string;
  reference_number: string;
  primary_image_url: string | null;
  seller_name: string;
  seller_email: string;
  current_price: string;
  starting_price: string;
  starts_at: string;
  ends_at: string;
  status: AdminAuctionStatus;
  /** Admin tarafından sayfadan gizlenmiş mi — public listelerden filtrelenir. */
  is_hidden: boolean;
  bid_count: number;
}

export interface AdminWatchDetail {
  id: string;
  brand: string;
  model: string;
  reference_number: string;
  year: number | null;
  serial_number: string | null;
  box_papers: boolean;
  condition: WatchCondition;
  description: string;
  seo_description: string | null;
  slug: string;
  status: WatchStatus;
  ai_processing_status: AIProcessingStatus;
  ai_processing_error: string | null;
  images: WatchImage[];
  created_at: string;
  seller: AdminSellerInfo;
  latest_valuation: AIValuationOut | null;
  has_certificate: boolean;
  delivery_code: string | null;
}
