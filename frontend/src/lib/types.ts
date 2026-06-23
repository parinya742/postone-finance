export interface Permission {
  id: number
  name: string
  slug: string
  description: string | null
  module: string
  action: string
  is_active: boolean
  created_at: string
}

export interface Role {
  id: number
  name: string
  slug: string
  description: string | null
  level: number
  color: string
  is_active: boolean
  is_system: boolean
  users_count?: number
  permissions?: Permission[]
  created_at: string
}

export interface User {
  id: number
  name: string
  username: string | null
  email: string
  avatar: string | null
  status: 'active' | 'inactive' | 'suspended' | 'pending'
  last_login_at: string | null
  roles?: Role[]
  roles_count?: number
  created_at: string
}

export interface AuthState {
  user: User | null
  roles: { id: number; name: string; slug: string; color: string }[]
  permissions: string[]
}

export interface PaginatedResponse<T> {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface PostoneAccountType {
  id: number
  name: string
  status: string
  description: string | null
  shop_id: number | null
  created_at: string | null
}

export interface PostoneSession {
  id: number
  username: string
  postone_uid: string | null
  login_at: string | null
  last_used_at: string | null
  updated_at: string | null
  status: string
}

export interface PostoneExportFile {
  id: number
  account_name: string | null
  shop_id: string | null
  file_name: string | null
  s3_url: string | null
  row_count: number | null
  filter_range: string | null
  created_at: string | null
}

export interface PostoneShipment {
  label_id: string
  customer_name: string | null
  product_details: string | null
  cod_amount: string | null
  shipping_by: string | null
  shipping_cost: string | null
  tracking_no: string | null
  due_date: string | null
  latest_status: string | null
  updated_at: string | null
  account_type_id: number | null
  pi_number: string | null
  so_number: string | null
  channel: string | null
  last_export_file_id: number | null
  account_type?: PostoneAccountType
  export_file?: PostoneExportFile
}

export interface LineGroupMedia {
  id: number
  group_id: string
  message_id: string
  file_url: string
  file_extension: string | null
  content_type: string
  width: number | null
  height: number | null
  duration_ms: number | null
  created_at: string | null
  deleted_at: string | null
  imported_by: string | null
}

export interface LineGroupFile {
  id: number
  group_id: string | null
  message_id: string | null
  original_file_name: string | null
  file_url: string | null
  created_at: string | null
  file_extension: string | null
  content_type: string | null
  source_type: string | null
  is_active: boolean
  extracted_files_count?: number
}

export interface ImportResult {
  message: string
  file_id: number
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

export interface LineGroupFileNote {
  id: number
  line_group_file_id: number
  note: string
  user_id: number | null
  user_name: string
  created_at: string
  updated_at: string
}

export interface LineGroupExtractedFile {
  id: number
  parent_file_id: number | null
  extracted_file_id: number | null
  message_id: string | null
  file_name: string | null
  file_extension: string | null
  file_type: string | null
  created_at: string | null
  s3_url: string | null
  parent_file?: LineGroupFile
}

export interface ShipmentAcceptanceJoin {
  // Thailand Post (base — always present)
  barcode: string
  office_code: string | null
  office_name: string | null
  print_datetime: string | null
  tr_number: string | null
  deposit_datetime: string | null
  recipient_name: string | null
  destination: string | null
  destination_code: string | null
  destination_name: string | null
  weight_grams: number | null
  recipient_phone: string | null
  service_name: string | null
  service_fee: number | null
  thpa_cod_amount: number | null
  wallet_phone: string | null
  sender_name: string | null
  // Postone fields (null when unmatched)
  label_id: string | null
  customer_name: string | null
  product_details: string | null
  pi_number: string | null
  so_number: string | null
  ps_cod_amount: string | null
  shipping_by: string | null
  shipping_cost: string | null
  tracking_no: string | null
  due_date: string | null
  latest_status: string | null
  // Calculated EMS cost (non-null only when service_name contains EMS)
  ems_calculated_cost: number | null
  dl_calculated_cost: number | null
  account_type_name: string | null
}

export interface ShipmentAcceptanceResponse extends PaginatedResponse<ShipmentAcceptanceJoin> {
  total_all: number
  matched_count: number
  unmatched_count: number
}

export interface LineSoJoin {
  // LINE file (thailand_post_acceptance) — always present
  barcode: string
  deposit_datetime: string | null
  destination_code: string | null
  destination_name: string | null
  weight_grams: number | null
  service_name: string | null
  service_fee: number | null
  // Postone (null when no match)
  pi_number: string | null
  customer_name: string | null
  product_details: string | null
  // ISCODE SO_Head (null when no match)
  SODate: string | null
  NumOfItem: number | null
  PINo: string | null
  DINo: string | null
  SoNo: string | null
  PONo: string | null
  CustID: string | null
  CustName: string | null
  FieldSaleID: string | null
  FieldSaleName: string | null
  CreateBy: string | null
  CreateByName: string | null
  DocRemark: string | null
  ACCRemark: string | null
  // Special Postal Zone (null when destination_name has no match)
  special_zone_rate: number | null
  account_type_name?: string | null
  Area?: string | null
  // Calculated EMS cost (non-null only when service_name contains EMS)
  ems_calculated_cost: number | null
  dl_calculated_cost: number | null
}

export interface SoHead {
  SODate: string | null
  NumOfItem: number | null
  PINo: string | null
  DINo: string | null
  SoNo: string | null
  PONo: string | null
  CustID: string | null
  CustName: string | null
  FieldSaleID: string | null
  FieldSaleName: string | null
  DocRemark: string | null
  CreateBy: string | null
  CreateByName: string | null
  ACCRemark: string | null
}

export interface EmsRate {
  id: number
  weight: number
  rate: number
  created_at: string | null
  updated_at: string | null
}

export interface EmsRatesResponse {
  data: EmsRate[]
  offset: number
}

export interface DomesticLetterRate {
  id: number
  weight: number
  rate: number
  created_at: string | null
  updated_at: string | null
}

export interface DomesticLetterRatesResponse {
  data: DomesticLetterRate[]
  offset: number
}

export interface SpecialPostalZone {
  id: number
  seq: number
  area_group: number
  province: string
  office_name: string
  postal_code: string
  area_description: string | null
  rate: number
  created_at: string | null
  updated_at: string | null
}

export interface LazadaSessionLog {
  id: number
  run_id: string
  platform: string
  seller_key: string
  shop_name: string | null
  status: string
  live: string | null
  asc_uid: string | null
  reason: string | null
  triggered_by: string
  duration_ms: number | null
  created_at: string
}

export interface LazadaSession {
  id: number
  seller_key: string
  shop_name: string | null
  cookie_length: number
  cookie_preview: string | null
  updated_at: string | null
  days_ago: number | null
  status: 'active' | 'warning' | 'expired' | 'unknown'
}

export interface ShopeeSessionLog {
  id: number
  run_id: string
  seller_key: string
  shop_name: string | null
  status: string
  missing: string | null
  reason: string | null
  triggered_by: string
  duration_ms: number | null
  created_at: string
}

export interface ShopeeSession {
  id: number
  seller_key: string
  shop_name: string | null
  cookie_length: number
  cookie_preview: string | null
  updated_at: string | null
  days_ago: number | null
  status: 'active' | 'warning' | 'expired' | 'unknown'
}

export interface LazadaInvoices {
  id: number
  seller_key: string
  shop_name: string | null
  invoice_no: string
  invoice_type: string
  provider: string
  invoice_date: string
  invoice_period: string
  s3_url: string
}

export interface LazadaShop {
  id: number
  shop_name: string
  app_key: string
  app_secret: string
  access_token: string | null
  refresh_token: string | null
  access_token_expires_at: string | null
  seller_id: string
  short_code: string
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface LazadaTransaction {
  id: number
  shop_name: string
  transaction_date: string | null
  transaction_type: string | null
  fee_name: string | null
  transaction_number: string | null
  details: string | null
  seller_sku: string | null
  lazada_sku: string | null
  amount: number | null
  vat_in_amount: number | null
  wht_amount: number | null
  wht_included_in_amount: string | null
  statement: string | null
  paid_status: string | null
  order_no: string | null
  order_item_no: string | null
  order_item_status: string | null
  shipping_provider: string | null
  reference: string | null
  comment: string | null
  payment_ref_id: string | null
  short_code: string | null
  synced_at: string | null
  file_id: number | null
}

export interface LazadaTransactionFile {
  id: number
  shop_name: string
  short_code: string | null
  seller_id: string | null
  start_date: string | null
  end_date: string | null
  file_name: string | null
  s3_bucket: string | null
  s3_key: string | null
  s3_url: string | null
  row_count: number | null
  total_amount: number | null
  file_size_bytes: number | null
  status: string | null
  created_at: string | null
}

export interface AuditLog {
  id: number
  user_id: number | null
  user_name: string
  action: string
  target_type: string
  target_id: number
  target_name: string
  payload: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface TikTokShop {
  id: number
  seller_id: string
  seller_name: string | null
  access_token: string | null
  refresh_token: string | null
  access_token_expires_at: string | null
  refresh_token_expires_at: string | null
  open_id: string | null
  granted_scopes: unknown | null
  shops_code: string | null
  shops_cipher: string | null
  created_at: string | null
  updated_at: string | null
}

export interface TikTokTransaction {
  id: number
  shop_name: string
  seller_id: string | null
  shops_code: string | null
  order_id: string | null
  transaction_type: string | null
  order_create_time: string | null
  order_paid_time: string | null
  currency: string | null
  total_payment_amount: number | null
  revenue_amount: number | null
  settlement_amount: number | null
  net_sales_amount: number | null
  fee_amount: number | null
  shipping_cost_amount: number | null
  total_fee: number | null
  tiktok_commission: number | null
  seller_discount: number | null
  payment_status: string | null
  payment_id: string | null
  statement_id: string | null
  payment_time: string | null
  statement_time: string | null
  file_id: number | null
}

export interface TikTokTransactionFile {
  id: number
  shop_name: string
  seller_id: string | null
  shops_code: string | null
  start_date: string | null
  end_date: string | null
  file_name: string | null
  s3_bucket: string | null
  s3_key: string | null
  s3_url: string | null
  row_count: number | null
  total_revenue: number | null
  total_fee: number | null
  total_settlement: number | null
  file_size_bytes: number | null
  report_mode: string | null
  status: string | null
  created_at: string | null
}

export interface ShopeeShop {
  shop_id: string
  shop_name: string | null
  partner_id: string
  access_token: string | null
  refresh_token: string | null
  updated_at: string | null
  partner_key: string | null
}

export interface ShopeeTransaction {
  order_sn: string
  return_sn: string | null
  buyer_username: string | null
  order_date: string | null
  payment_method: string | null
  payment_detail: string | null
  payout_date: string | null
  original_price: number | null
  seller_discount: number | null
  refund_to_buyer: number | null
  shopee_discount: number | null
  seller_voucher: number | null
  ams_commission: number | null
  commission_fee: number | null
  service_fee: number | null
  transaction_fee: number | null
  tax: number | null
  total_payout: number | null
  shipping_provider: string | null
  carrier_name: string | null
  shop_id: string | null
  shop_name: string | null
  file_id: number | null
  updated_at: string | null
}

export interface ShopeeTransactionFile {
  id: number
  shop_id: string
  shop_name: string | null
  payout_date: string | null
  s3_bucket: string | null
  s3_key: string | null
  s3_url: string | null
  row_count: number | null
  created_at: string | null
}

export interface ShopeeOrderItem {
  order_sn: string
  order_status: string | null
  create_time: string | null
  pay_time: string | null
  ship_by_date: string | null
  complete_time: string | null
  update_time: string | null
  shop_id: string | null
  shop_name: string | null
  buyer_username: string | null
  buyer_user_id: string | null
  payment_method: string | null
  shipping_option: string | null
  tracking_no: string | null
  item_id: string | null
  parent_sku: string | null
  item_name: string | null
  sku_ref: string
  variation_name: string
  original_price: number | null
  selling_price: number | null
  qty: number | null
  qty_returned: number | null
  qty_cancelled: number | null
  net_price: number | null
  shopee_discount: number | null
  seller_voucher: number | null
  commission_fee: number | null
  transaction_fee: number | null
  service_fee: number | null
  total_amount: number | null
  buyer_paid_price: number | null
  buyer_shipping_fee: number | null
  province: string | null
  district: string | null
  cancel_reason: string | null
  return_status: string | null
  range_from: string | null
  range_to: string | null
  updated_at: string | null
}

export interface ShopeeOrderFile {
  id: number
  shop_id: string | null
  shop_name: string | null
  range_from: string | null
  range_to: string | null
  s3_bucket: string | null
  s3_key: string | null
  s3_url: string | null
  row_count: number | null
  created_at: string | null
}

export interface ShopeeWalletTransaction {
  id: number
  shop_id: string | null
  shop_name: string | null
  range_from: string | null
  range_to: string | null
  transaction_id: string
  status: string | null
  wallet_type: string | null
  transaction_type: string | null
  transaction_tab_type: string | null
  money_flow: string | null
  amount: number | null
  current_balance: number | null
  transaction_fee: number | null
  create_time: string | null
  order_sn: string | null
  refund_sn: string | null
  withdrawal_id: string | null
  withdrawal_type: string | null
  description: string | null
  reason: string | null
  buyer_name: string | null
  buyer_username: string | null
  order_status: string | null
  pay_time: string | null
  complete_time: string | null
  shipping_method: string | null
  tracking_no: string | null
  net_price: number | null
  commission_fee: number | null
  order_transaction_fee: number | null
  buyer_paid_price: number | null
  actual_shipping_fee: number | null
  escrow_amount: number | null
  shopee_shipping_subsidy: number | null
  service_fee: number | null
  return_shipping_fee: number | null
  seller_voucher: number | null
  shopee_voucher: number | null
  shopee_discount: number | null
  created_at: string | null
}

export interface ShopeeWalletFile {
  id: number
  shop_id: string | null
  shop_name: string | null
  range_from: string | null
  range_to: string | null
  s3_bucket: string | null
  s3_key: string | null
  s3_url: string | null
  row_count: number | null
  created_at: string | null
}

export interface ShopeeWalletSyncLog {
  id: number
  shop_id: string | null
  shop_name: string | null
  range_from: string | null
  range_to: string | null
  file_id: number | null
  tx_count: number | null
  s3_bucket: string | null
  s3_key: string | null
  s3_url: string | null
  status: string | null
  message: string | null
  created_at: string | null
}

export interface ShopeeOrderSyncLog {
  id: number
  shop_id: string | null
  shop_name: string | null
  range_from: string | null
  range_to: string | null
  file_id: number | null
  order_count: number | null
  status: string | null
  message: string | null
  created_at: string | null
}

export interface ShopeeIncomeSyncLog {
  id: number
  shop_id: string | null
  shop_name: string | null
  payout_date: string | null
  file_id: number | null
  order_count: number | null
  status: string | null
  message: string | null
  created_at: string | null
}

export interface ThailandPostAcceptance {
  id: number
  source_file: string | null
  parent_file_id: number | null
  extracted_file_id: number | null
  import_batch_id: string | null
  imported_by: number | null
  imported_at: string | null
  office_code: string | null
  office_name: string | null
  print_datetime: string | null
  seq_no: number | null
  tr_number: string | null
  deposit_datetime: string | null
  barcode: string | null
  recipient_name: string | null
  destination: string | null
  destination_code: string | null
  destination_name: string | null
  weight_grams: number | null
  recipient_phone: string | null
  service_name: string | null
  service_fee: number | null
  cod_amount: number | null
  wallet_phone: string | null
  sender_name: string | null
  file_source_type: string | null
  message_id: string | null
}
