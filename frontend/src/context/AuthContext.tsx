'use client'

import axios from 'axios'
import api from '@/lib/api'
import { AuthState } from '@/lib/types'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const SESSION_TIMEOUT_MS = 120 * 60 * 1000 // 120 minutes

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  can: (permission: string) => boolean
  hasRole: (role: string) => boolean
  loading: boolean
  sessionExpiresAt: number | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ user: null, roles: [], permissions: [] })
  const [loading, setLoading] = useState(true)
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null)

  const fetchMe = useCallback(async (signal?: AbortSignal) => {
    try {
      const { data } = await api.get('/auth/me', { signal })
      setAuth({ user: data.user, roles: data.roles, permissions: data.permissions })
      setLoading(false)
    } catch (err: unknown) {
      if (axios.isCancel(err)) return
      setAuth({ user: null, roles: [], permissions: [] })
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const expiresAt = localStorage.getItem('session_expires_at')

    if (token && expiresAt && Date.now() > Number(expiresAt)) {
      localStorage.removeItem('token')
      localStorage.removeItem('session_expires_at')
      setLoading(false)
      return
    }

    if (expiresAt) setSessionExpiresAt(Number(expiresAt))

    if (token) {
      const controller = new AbortController()
      fetchMe(controller.signal)
      return () => controller.abort()
    } else {
      setLoading(false)
    }
  }, [fetchMe])

  // Periodic session expiry check every 30 seconds
  useEffect(() => {
    if (!auth.user) return

    const check = () => {
      const expiresAt = localStorage.getItem('session_expires_at')
      if (!expiresAt || Date.now() > Number(expiresAt)) {
        localStorage.removeItem('token')
        localStorage.removeItem('session_expires_at')
        setAuth({ user: null, roles: [], permissions: [] })
        window.location.href = '/login?reason=session_expired'
      }
    }

    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [auth.user])

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    const expiresAt = Date.now() + SESSION_TIMEOUT_MS
    localStorage.setItem('token', data.token)
    localStorage.setItem('session_expires_at', String(expiresAt))
    setSessionExpiresAt(expiresAt)
    await fetchMe()
  }

  const logout = async () => {
    try { await api.post('/auth/logout') } catch { /* ignore */ }
    localStorage.removeItem('token')
    localStorage.removeItem('session_expires_at')
    setSessionExpiresAt(null)
    setAuth({ user: null, roles: [], permissions: [] })
    window.location.href = '/login'
  }

  const can = (permission: string) =>
    auth.roles.some((r) => r.slug === 'super_admin') || auth.permissions.includes(permission)

  const hasRole = (role: string) => auth.roles.some((r) => r.slug === role)

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, can, hasRole, loading, sessionExpiresAt }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
