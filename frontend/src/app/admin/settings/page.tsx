'use client'

import { useAuth } from '@/context/AuthContext'
import { Lock, Settings } from 'lucide-react'

export default function SettingsPage() {
  const { can } = useAuth()

  if (!can('settings.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-600" />
          <h1 className="text-2xl font-bold text-slate-800">ตั้งค่าระบบ</h1>
        </div>
        <p className="text-slate-500 text-sm mt-1">จัดการการตั้งค่าทั่วไปของระบบ</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Settings className="w-10 h-10 opacity-30" />
        <p className="text-sm">ยังไม่มีการตั้งค่าในขณะนี้</p>
      </div>
    </div>
  )
}
