'use client'

import { useAuth } from '@/context/AuthContext'
import { Users, ShieldCheck, KeyRound, Activity, TrendingUp, Database, Lock } from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
  const { user, roles, permissions, can } = useAuth()

  const kpis = [
    {
      label: 'Roles ที่มี',
      value: roles.length,
      icon: ShieldCheck,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      href: '/admin/roles',
    },
    {
      label: 'Permissions',
      value: permissions.length,
      icon: KeyRound,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      border: 'border-violet-100',
      href: '/admin/permissions',
    },
    {
      label: 'สถานะสิทธิ์',
      value: permissions.length > 0 ? 'Active' : 'None',
      icon: Lock,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      href: '#',
    },
    {
      label: 'ระบบ',
      value: 'Online',
      icon: Database,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-100',
      href: '#',
    },
  ]

  const quickLinks = [
    { label: 'จัดการผู้ใช้', href: '/admin/users', icon: Users, permission: 'users.view', desc: 'เพิ่ม แก้ไข ลบผู้ใช้งาน' },
    { label: 'จัดการ Roles', href: '/admin/roles', icon: ShieldCheck, permission: 'roles.view', desc: 'กำหนดกลุ่มสิทธิ์การใช้งาน' },
    { label: 'Permissions', href: '/admin/permissions', icon: KeyRound, permission: 'permissions.view', desc: 'บริหารสิทธิ์การเข้าถึง' },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium">ยินดีต้อนรับเข้าสู่ระบบ</p>
            <h1 className="text-2xl font-bold mt-1">{user?.name}</h1>
            <p className="text-blue-300 text-sm mt-1">{user?.email}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {roles.map((role) => (
                <span
                  key={role.id}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm"
                >
                  {role.name}
                </span>
              ))}
            </div>
          </div>
          <div className="hidden sm:flex items-center justify-center w-20 h-20 bg-white/10 rounded-2xl flex-shrink-0">
            <Activity className="w-10 h-10 text-blue-200" />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg, border, href }) => (
          <Link
            key={label}
            href={href}
            className={`bg-white rounded-xl border ${border} p-5 hover:shadow-md transition-all group`}
          >
            <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
              {value}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick access */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-slate-800">เมนูด่วน</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quickLinks
              .filter((l) => !l.permission || can(l.permission))
              .map(({ label, href, icon: Icon, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-2 p-5 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group text-center"
                >
                  <div className="w-12 h-12 bg-slate-100 group-hover:bg-blue-100 rounded-xl flex items-center justify-center transition-colors">
                    <Icon className="w-6 h-6 text-slate-500 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">{label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                  </div>
                </Link>
              ))}
          </div>
        </div>

        {/* Permissions list */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="w-5 h-5 text-violet-600" />
            <h2 className="font-semibold text-slate-800">Permissions ของคุณ</h2>
          </div>
          <div className="space-y-1.5 overflow-y-auto max-h-56">
            {permissions.slice(0, 16).map((perm) => (
              <div
                key={perm}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg"
              >
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                <span className="text-xs text-slate-600 font-mono truncate">{perm}</span>
              </div>
            ))}
            {permissions.length > 16 && (
              <p className="text-xs text-slate-400 text-center pt-1">
                +{permissions.length - 16} รายการ
              </p>
            )}
            {permissions.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">ไม่มี Permission</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
