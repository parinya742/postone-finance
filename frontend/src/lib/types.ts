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
  account_type?: PostoneAccountType
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

export interface LineGroupExtractedFile {
  id: number
  parent_file_id: number | null
  message_id: string | null
  file_name: string | null
  file_extension: string | null
  file_type: string | null
  created_at: string | null
  s3_url: string | null
  parent_file?: LineGroupFile
}

export interface ThailandPostAcceptance {
  id: number
  source_file: string | null
  parent_file_id: number | null
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
