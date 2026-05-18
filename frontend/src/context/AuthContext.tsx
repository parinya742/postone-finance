'use client'

import api from '@/lib/api'
import { AuthState } from '@/lib/types'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  can: (permission: string) => boolean
  hasRole: (role: string) => boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ user: null, roles: [], permissions: [] })
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me')
      setAuth({ user: data.user, roles: data.roles, permissions: data.permissions })
    } catch {
      setAuth({ user: null, roles: [], permissions: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (localStorage.getItem('token')) fetchMe()
    else setLoading(false)
  }, [fetchMe])

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', data.token)
    await fetchMe()
  }

  const logout = async () => {
    try { await api.post('/auth/logout') } catch { /* ignore */ }
    localStorage.removeItem('token')
    setAuth({ user: null, roles: [], permissions: [] })
    window.location.href = '/login'
  }

  const can = (permission: string) =>
    auth.roles.some((r) => r.slug === 'super_admin') || auth.permissions.includes(permission)

  const hasRole = (role: string) => auth.roles.some((r) => r.slug === role)

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, can, hasRole, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
