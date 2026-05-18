'use client'

import { useAuth } from '@/context/AuthContext'
import { LogOut, User } from 'lucide-react'
import { useState } from 'react'

export default function Header() {
  const { user, roles, logout } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6">
      <div />
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-gray-900"
        >
          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
            <User className="w-4 h-4 text-violet-600" />
          </div>
          <div className="text-left hidden sm:block">
            <p className="font-medium leading-tight">{user?.name}</p>
            <p className="text-xs text-gray-500">{roles[0]?.name ?? 'ไม่มี Role'}</p>
          </div>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              ออกจากระบบ
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
