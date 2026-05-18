'use client'

import { useAuth } from '@/context/AuthContext'
import { LogOut, Menu, Bell, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

interface HeaderProps {
  onMenuToggle: () => void
}

const pageTitles: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/users': 'จัดการผู้ใช้งาน',
  '/admin/roles': 'จัดการ Roles',
  '/admin/permissions': 'จัดการ Permissions',
  '/admin/settings': 'ตั้งค่าระบบ',
  '/admin/account-types': 'Account Types',
  '/admin/sessions': 'Postone Sessions',
  '/admin/shipments': 'Postone Shipments Sync ',
  '/admin/line-files': 'Header Files Import',
  '/admin/line-extracted': 'Extracted Files',
  '/admin/thaipost': 'Files Data',
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { user, roles, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const title = pageTitles[pathname] ?? 'Admin'

  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 lg:px-6 flex-shrink-0 shadow-sm z-10">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-slate-800 leading-tight">{title}</h1>
          <p className="text-xs text-slate-400 hidden sm:block">Postone Finance</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <div className="relative ml-1">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="text-left hidden sm:block">
              <p className="font-semibold leading-tight text-slate-800 text-sm">{user?.name}</p>
              <p className="text-xs text-slate-400 leading-tight">{roles[0]?.name ?? '—'}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-20">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {roles.map((role) => (
                      <span
                        key={role.id}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold text-white"
                        style={{ backgroundColor: role.color }}
                      >
                        {role.name}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => { logout(); setOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  ออกจากระบบ
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
