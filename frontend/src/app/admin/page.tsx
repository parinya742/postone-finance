'use client'

import { useAuth } from '@/context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import Link from 'next/link'
import {
  Users, ShieldCheck, KeyRound, Activity, TrendingUp,
  Package, FileText, Store, CheckCircle2, AlertTriangle, XCircle, Clock,
} from 'lucide-react'
import {
  PaginatedResponse, PostoneShipment, PostoneExportFile,
  LazadaShop, TikTokShop, ShopeeShop, AuditLog,
} from '@/lib/types'
import clsx from 'clsx'

// ─── helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'เมื่อกี้'
  if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`
  return `${Math.floor(h / 24)} วันที่แล้ว`
}

type TokenHealth = 'ok' | 'warning' | 'expired' | 'unknown'

function getTokenHealth(expiresAt: string | null | undefined): TokenHealth {
  if (!expiresAt) return 'unknown'
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff < 0) return 'expired'
  if (diff < 7 * 24 * 60 * 60 * 1000) return 'warning'
  return 'ok'
}

function countHealth(shops: Array<{ access_token_expires_at?: string | null }>) {
  const c = { ok: 0, warning: 0, expired: 0, unknown: 0 }
  shops.forEach((s) => { c[getTokenHealth(s.access_token_expires_at)]++ })
  return c
}

const HEALTH = {
  ok:      { icon: CheckCircle2,  cls: 'text-emerald-500', label: 'ปกติ' },
  warning: { icon: AlertTriangle, cls: 'text-amber-500',   label: 'ใกล้หมด' },
  expired: { icon: XCircle,       cls: 'text-red-500',     label: 'หมดอายุ' },
  unknown: { icon: Clock,         cls: 'text-slate-400',   label: 'ไม่ทราบ' },
} as const

// ─── sub-components ──────────────────────────────────────────────────────────

function HealthBadge({ count, type }: { count: number; type: TokenHealth }) {
  if (count === 0) return null
  const { icon: Icon, cls, label } = HEALTH[type]
  return (
    <span className={clsx('flex items-center gap-1 text-xs font-medium', cls)}>
      <Icon className="w-3.5 h-3.5" />
      {count} {label}
    </span>
  )
}

function PlatformRow({
  name, shops, href, loading,
}: {
  name: string
  shops: Array<{ access_token_expires_at?: string | null }>
  href: string
  loading: boolean
}) {
  const h = countHealth(shops)
  const hasIssue = h.warning > 0 || h.expired > 0

  return (
    <div className={clsx(
      'flex items-center justify-between px-4 py-3 rounded-lg border transition-colors',
      hasIssue ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 bg-slate-50/50',
    )}>
      <div className="flex items-center gap-3">
        <Store className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-800">{name}</p>
          {loading ? (
            <div className="h-3 w-20 bg-slate-200 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-xs text-slate-400">{shops.length} ร้านค้า</p>
          )}
        </div>
      </div>
      {loading ? (
        <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
      ) : (
        <div className="flex items-center gap-3">
          <HealthBadge count={h.ok}      type="ok" />
          <HealthBadge count={h.warning} type="warning" />
          <HealthBadge count={h.expired} type="expired" />
          <HealthBadge count={h.unknown} type="unknown" />
          <Link href={href} className="text-xs text-blue-600 hover:underline ml-1 whitespace-nowrap">
            จัดการ →
          </Link>
        </div>
      )}
    </div>
  )
}

function ShopeeRow({ shops, href, loading }: { shops: ShopeeShop[]; href: string; loading: boolean }) {
  const activeCount = shops.filter((s) => s.access_token).length

  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-slate-100 bg-slate-50/50">
      <div className="flex items-center gap-3">
        <Store className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-800">Shopee</p>
          {loading ? (
            <div className="h-3 w-20 bg-slate-200 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-xs text-slate-400">{shops.length} ร้านค้า</p>
          )}
        </div>
      </div>
      {loading ? (
        <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
      ) : (
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-500">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {activeCount} มี Token
            </span>
          )}
          {shops.length - activeCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              {shops.length - activeCount} ไม่มี Token
            </span>
          )}
          <Link href={href} className="text-xs text-blue-600 hover:underline ml-1 whitespace-nowrap">
            จัดการ →
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user, roles, permissions, can } = useAuth()

  const { data: shipmentsData, isLoading: shipmentsLoading } = useQuery<PaginatedResponse<PostoneShipment>>({
    queryKey: ['dashboard-shipments'],
    queryFn: () => api.get('/shipments', { params: { per_page: 1 } }).then((r) => r.data),
    enabled: can('shipments.view'),
  })

  const { data: exportFilesData, isLoading: exportLoading } = useQuery<PaginatedResponse<PostoneExportFile>>({
    queryKey: ['dashboard-export-files'],
    queryFn: () => api.get('/export-files', { params: { per_page: 1 } }).then((r) => r.data),
    enabled: can('shipments.view'),
  })

  const { data: lazadaData, isLoading: lazadaLoading } = useQuery<PaginatedResponse<LazadaShop>>({
    queryKey: ['dashboard-lazada-shops'],
    queryFn: () => api.get('/lazada/shops', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('lazada-shops.view'),
  })

  const { data: tiktokData, isLoading: tiktokLoading } = useQuery<PaginatedResponse<TikTokShop>>({
    queryKey: ['dashboard-tiktok-shops'],
    queryFn: () => api.get('/tiktok/shops', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('tiktok-shops.view'),
  })

  const { data: shopeeData, isLoading: shopeeLoading } = useQuery<PaginatedResponse<ShopeeShop>>({
    queryKey: ['dashboard-shopee-shops'],
    queryFn: () => api.get('/shopee/shops', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('shopee-shops.view'),
  })

  const { data: auditData } = useQuery<PaginatedResponse<AuditLog>>({
    queryKey: ['dashboard-audit-logs'],
    queryFn: () => api.get('/audit-logs', { params: { per_page: 6 } }).then((r) => r.data),
  })

  const lazadaShops = lazadaData?.data ?? []
  const tiktokShops = tiktokData?.data ?? []
  const shopeeShops = shopeeData?.data ?? []
  const auditLogs   = auditData?.data ?? []

  const hasPlatformAccess = can('lazada-shops.view') || can('tiktok-shops.view') || can('shopee-shops.view')

  type KpiItem = {
    label: string; value: number | null; loading: boolean
    icon: React.ElementType; color: string; bg: string; border: string; href: string
  }

  const kpis: KpiItem[] = [
    can('shipments.view') && {
      label: 'พัสดุทั้งหมด', value: shipmentsData?.total ?? null, loading: shipmentsLoading,
      icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', href: '/admin/shipments',
    },
    can('shipments.view') && {
      label: 'Export Files', value: exportFilesData?.total ?? null, loading: exportLoading,
      icon: FileText, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', href: '/admin/export-files',
    },
    can('roles.view') && {
      label: 'Roles ของคุณ', value: roles.length, loading: false,
      icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', href: '/admin/roles',
    },
    can('permissions.view') && {
      label: 'Permissions', value: permissions.length, loading: false,
      icon: KeyRound, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', href: '/admin/permissions',
    },
  ].filter(Boolean) as KpiItem[]

  const quickLinks = [
    { label: 'จัดการผู้ใช้', href: '/admin/users',        icon: Users,       permission: 'users.view',        desc: 'เพิ่ม แก้ไข ลบผู้ใช้งาน' },
    { label: 'จัดการ Roles', href: '/admin/roles',        icon: ShieldCheck, permission: 'roles.view',        desc: 'กำหนดกลุ่มสิทธิ์การใช้งาน' },
    { label: 'Permissions',  href: '/admin/permissions',  icon: KeyRound,    permission: 'permissions.view',  desc: 'บริหารสิทธิ์การเข้าถึง' },
    { label: 'Lazada',       href: '/admin/lazada/shops', icon: Store,       permission: 'lazada-shops.view', desc: 'จัดการร้านค้า Lazada' },
    { label: 'TikTok',       href: '/admin/tiktok/shops', icon: Store,       permission: 'tiktok-shops.view', desc: 'จัดการร้านค้า TikTok' },
    { label: 'Shopee',       href: '/admin/shopee/shops', icon: Store,       permission: 'shopee-shops.view', desc: 'จัดการร้านค้า Shopee' },
  ]

  const visibleLinks = quickLinks.filter((l) => !l.permission || can(l.permission))

  const gridCols =
    kpis.length === 2 ? 'grid-cols-2' :
    kpis.length === 3 ? 'grid-cols-3' :
    'grid-cols-2 lg:grid-cols-4'

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
                <span key={role.id} className="px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm">
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

      {/* KPI bar */}
      {kpis.length > 0 && (
        <div className={clsx('grid gap-4', gridCols)}>
          {kpis.map(({ label, value, loading, icon: Icon, color, bg, border, href }) => (
            <Link key={label} href={href} className={`bg-white rounded-xl border ${border} p-5 hover:shadow-md transition-all group`}>
              <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              {loading ? (
                <div className="h-7 bg-slate-100 rounded animate-pulse mb-1 w-16" />
              ) : (
                <p className="text-2xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                  {value?.toLocaleString() ?? '—'}
                </p>
              )}
              <p className="text-sm text-slate-500 mt-0.5">{label}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Platform token health + Audit log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {hasPlatformAccess && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-600" />
              สถานะ Token ของร้านค้า
            </h2>
            <div className="space-y-3">
              {can('lazada-shops.view') && (
                <PlatformRow name="Lazada" shops={lazadaShops} href="/admin/lazada/shops" loading={lazadaLoading} />
              )}
              {can('tiktok-shops.view') && (
                <PlatformRow name="TikTok" shops={tiktokShops} href="/admin/tiktok/shops" loading={tiktokLoading} />
              )}
              {can('shopee-shops.view') && (
                <ShopeeRow shops={shopeeShops} href="/admin/shopee/shops" loading={shopeeLoading} />
              )}
            </div>
          </div>
        )}

        <div className={clsx('bg-white rounded-xl border border-slate-200 p-6', !hasPlatformAccess && 'lg:col-span-2')}>
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            กิจกรรมล่าสุด
          </h2>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">ไม่มีกิจกรรม</p>
          ) : (
            <div className="space-y-1">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 py-2.5 border-b border-slate-50 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 text-xs font-bold mt-0.5">
                    {(log.user_name ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-700 leading-snug">
                      <span className="font-semibold">{log.user_name ?? 'system'}</span>{' '}
                      <span className="text-slate-500">{log.action}</span>{' '}
                      <span className="font-medium">{log.target_name}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{timeAgo(log.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      {visibleLinks.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-slate-800">เมนูด่วน</h2>
          </div>
          <div className={clsx(
            'grid gap-3',
            visibleLinks.length <= 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
          )}>
            {visibleLinks.map(({ label, href, icon: Icon, desc }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group text-center"
              >
                <div className="w-10 h-10 bg-slate-100 group-hover:bg-blue-100 rounded-xl flex items-center justify-center transition-colors">
                  <Icon className="w-5 h-5 text-slate-500 group-hover:text-blue-600 transition-colors" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 group-hover:text-blue-700">{label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
