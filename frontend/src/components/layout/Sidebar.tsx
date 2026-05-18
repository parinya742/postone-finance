'use client'

import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, ShieldCheck, KeyRound, Settings } from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, permission: null },
  { href: '/admin/users', label: 'จัดการผู้ใช้', icon: Users, permission: 'users.view' },
  { href: '/admin/roles', label: 'จัดการ Roles', icon: ShieldCheck, permission: 'roles.view' },
  { href: '/admin/permissions', label: 'จัดการ Permissions', icon: KeyRound, permission: 'permissions.view' },
  { href: '/admin/settings', label: 'ตั้งค่า', icon: Settings, permission: 'settings.view' },
]

export default function Sidebar() {
  const { can } = useAuth()
  const pathname = usePathname()

  const visible = navItems.filter((item) => !item.permission || can(item.permission))

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-500 rounded-lg flex items-center justify-center font-bold text-sm">P</div>
          <div>
            <p className="font-semibold text-sm">Postone Finance</p>
            <p className="text-gray-400 text-xs">Admin Panel</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {visible.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/admin' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                active ? 'bg-violet-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
