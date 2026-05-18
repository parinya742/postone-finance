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
