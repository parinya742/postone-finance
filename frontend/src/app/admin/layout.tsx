'use client'

import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, sessionExpiresAt } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showExpiryWarning, setShowExpiryWarning] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!sessionExpiresAt) return
    const check = () => {
      const remaining = sessionExpiresAt - Date.now()
      setShowExpiryWarning(remaining > 0 && remaining < 5 * 60 * 1000)
    }
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [sessionExpiresAt])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-[3px] border-[#354A5E] border-t-[#0070F2] rounded-full animate-spin" />
          <p className="text-sm text-[#6A6D70]">กำลังโหลดระบบ...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F5F5]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        {showExpiryWarning && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-sm flex items-center justify-center gap-2">
            <span>⚠</span>
            <span>เซสชันของคุณจะหมดอายุในไม่ช้า กรุณาบันทึกงานและเข้าสู่ระบบใหม่</span>
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
