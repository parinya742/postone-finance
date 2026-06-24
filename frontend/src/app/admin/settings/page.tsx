'use client'

import api from '@/lib/api'
import { AuditLog, PaginatedResponse } from '@/lib/types'
import { useAuth } from '@/context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Settings,
  Lock,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  User,
  Tag,
  Hash,
  Globe,
  Calendar,
  Filter,
} from 'lucide-react'

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(val: string | null) {
  if (!val) return '—'
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(val))
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  login: 'bg-violet-100 text-violet-700',
  logout: 'bg-slate-100 text-slate-600',
}

function ActionBadge({ action }: { action: string }) {
  const base = ACTION_COLORS[action.toLowerCase()] ?? 'bg-amber-100 text-amber-700'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${base}`}>
      {action}
    </span>
  )
}

// ─── Audit Log Tab ────────────────────────────────────────────────────────────

function AuditLogTab() {
  const [page, setPage] = useState(1)
  const [targetType, setTargetType] = useState('')
  const [targetId, setTargetId] = useState('')
  const [search, setSearch] = useState({ targetType: '', targetId: '' })

  const { data, isLoading, isFetching, refetch } = useQuery<PaginatedResponse<AuditLog>>({
    queryKey: ['audit-logs', page, search.targetType, search.targetId],
    queryFn: () =>
      api
        .get('/audit-logs', {
          params: {
            page,
            per_page: 20,
            ...(search.targetType ? { target_type: search.targetType } : {}),
            ...(search.targetId ? { target_id: search.targetId } : {}),
          },
        })
        .then((r) => r.data),
  })

  const logs = data?.data ?? []
  const lastPage = data?.last_page ?? 1
  const total = data?.total ?? 0

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch({ targetType: targetType.trim(), targetId: targetId.trim() })
    setPage(1)
  }

  function handleReset() {
    setTargetType('')
    setTargetId('')
    setSearch({ targetType: '', targetId: '' })
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <form
        onSubmit={handleSearch}
        className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" /> Target Type
          </label>
          <input
            type="text"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            placeholder="เช่น User, Role..."
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          />
        </div>

        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Hash className="w-3.5 h-3.5" /> Target ID
          </label>
          <input
            type="number"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="ID"
            min={0}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          />
        </div>

        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Filter className="w-3.5 h-3.5" />
            รีเซ็ต
          </button>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            ค้นหา
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            title="รีเฟรช"
            className="p-1.5 text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </form>

      {/* Summary */}
      {!isLoading && (
        <p className="text-xs text-slate-400">
          พบทั้งหมด <span className="font-semibold text-slate-600">{total.toLocaleString()}</span> รายการ
        </p>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> วันที่
                  </span>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> ผู้ใช้
                  </span>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Action</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" /> Target Type
                  </span>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">
                  Target Name
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">
                  <span className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" /> IP Address
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading
                ? [...Array(6)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(6)].map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : logs.length === 0
                ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">ไม่พบข้อมูล Audit Log</p>
                    </td>
                  </tr>
                )
                : logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {fmtDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-slate-700 text-xs">{log.user_name}</div>
                      {log.user_id && (
                        <div className="text-slate-400 text-xs">ID: {log.user_id}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                        {log.target_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 max-w-[200px] truncate">
                      <span title={log.target_name}>{log.target_name}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                      {log.ip_address ?? '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && lastPage > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-500">
              หน้า {page} / {lastPage}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(lastPage, 7) }, (_, i) => {
                let p = i + 1
                if (lastPage > 7) {
                  const start = Math.max(1, Math.min(page - 3, lastPage - 6))
                  p = start + i
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[2rem] h-8 rounded-lg text-xs font-medium border transition-colors ${
                      p === page
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page === lastPage}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabId = 'general' | 'audit-log'

const ALL_TABS: { id: TabId; label: string; icon: React.ReactNode; permission?: string }[] = [
  { id: 'general', label: 'ทั่วไป', icon: <Settings className="w-4 h-4" /> },
  { id: 'audit-log', label: 'Audit Log', icon: <ClipboardList className="w-4 h-4" />, permission: 'audit_logs.view' },
]

export default function SettingsPage() {
  const { can } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('general')

  if (!can('settings.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  // Only show tabs the current user is allowed to see
  const visibleTabs = ALL_TABS.filter((tab) => !tab.permission || can(tab.permission))

  // If the active tab got hidden (permission revoked), fall back to 'general'
  const safeTab = visibleTabs.find((t) => t.id === activeTab) ? activeTab : 'general'

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-600" />
          <h1 className="text-2xl font-bold text-slate-800">ตั้งค่าระบบ</h1>
        </div>
        <p className="text-slate-500 text-sm mt-1">จัดการการตั้งค่าทั่วไปของระบบ</p>
      </div>

      {/* Tab bar — only renders tabs the user can access */}
      <div className="flex gap-1 border-b border-slate-200">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              safeTab === tab.id
                ? 'border-violet-600 text-violet-700 bg-violet-50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {safeTab === 'general' && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Settings className="w-10 h-10 opacity-30" />
          <p className="text-sm">ยังไม่มีการตั้งค่าในขณะนี้</p>
        </div>
      )}

      {safeTab === 'audit-log' && can('audit_logs.view') && <AuditLogTab />}

      {/* Fallback guard — shown only if tab is active but permission is missing */}
      {safeTab === 'audit-log' && !can('audit_logs.view') && (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <Lock className="w-12 h-12 mb-3" />
          <p className="font-medium">ไม่มีสิทธิ์ดู Audit Log</p>
        </div>
      )}
    </div>
  )
}
