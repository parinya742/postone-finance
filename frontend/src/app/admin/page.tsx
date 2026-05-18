'use client'

import { useAuth } from '@/context/AuthContext'
import { Users, ShieldCheck, KeyRound, Activity } from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
  const { user, roles, permissions, can } = useAuth()

  const stats = [
    { label: 'Roles ของคุณ', value: roles.length, icon: ShieldCheck, color: 'bg-violet-500', href: '/admin/roles' },
    { label: 'Permissions', value: permissions.length, icon: KeyRound, color: 'bg-blue-500', href: '/admin/permissions' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">ยินดีต้อนรับ, {user?.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className={`${color} w-10 h-10 rounded-lg flex items-center justify-center`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-violet-600" />
          <h2 className="font-semibold text-gray-900">Roles & Permissions ของคุณ</h2>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {roles.map((role) => (
            <span
              key={role.id}
              className="px-3 py-1 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: role.color }}
            >
              {role.name}
            </span>
          ))}
          {roles.length === 0 && <p className="text-sm text-gray-400">ไม่มี Role</p>}
        </div>

        {can('users.view') && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-gray-500" />
              <p className="text-sm font-medium text-gray-700">การเข้าถึงที่มี</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {permissions.slice(0, 20).map((perm) => (
                <span key={perm} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-mono">
                  {perm}
                </span>
              ))}
              {permissions.length > 20 && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                  +{permissions.length - 20} อื่นๆ
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
