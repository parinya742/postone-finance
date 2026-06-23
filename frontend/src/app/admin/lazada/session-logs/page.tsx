'use client'

import api from '@/lib/api'
import { LazadaSessionLog, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Lock, History as HistoryIcon, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Clock, SkipForward } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

// ---- helpers ----

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtMs(ms: number | null) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  saved:              { label: 'Saved',            cls: 'bg-green-100 text-green-700',   icon: <CheckCircle2 className="w-3 h-3" /> },
  reused:             { label: 'Reused',           cls: 'bg-blue-100 text-blue-700',     icon: <RefreshCw className="w-3 h-3" /> },
  skipped_challenge:  { label: 'Skip Challenge',   cls: 'bg-yellow-100 text-yellow-700', icon: <SkipForward className="w-3 h-3" /> },
  needs_manual_login: { label: 'ต้องล็อกอินเอง', cls: 'bg-yellow-100 text-yellow-700', icon: <AlertTriangle className="w-3 h-3" /> },
  timeout:            { label: 'Timeout',          cls: 'bg-orange-100 text-orange-700', icon: <Clock className="w-3 h-3" /> },
  error:              { label: 'Error',            cls: 'bg-red-100 text-red-600',       icon: <XCircle className="w-3 h-3" /> },
}

const TRIGGER_CFG: Record<string, string> = {
  api:    'bg-blue-50 text-blue-700',
  manual: 'bg-purple-50 text-purple-700',
  cli:    'bg-slate-100 text-slate-600',
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600', icon: null }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

function TriggerBadge({ by }: { by: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-medium ${TRIGGER_CFG[by] ?? 'bg-slate-100 text-slate-600'}`}>
      {by}
    </span>
  )
}

// ---- Pagination ----

function Pagination({
  page, lastPage, total, onPrev, onNext,
}: {
  page: number; lastPage: number; total: number; onPrev: () => void; onNext: () => void
}) {
  if (lastPage <= 1) return null
  return (
    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
      <span>หน้า {page} / {lastPage} · ทั้งหมด {total.toLocaleString('th-TH')} รายการ</span>
      <div className="flex gap-2">
        <button disabled={page === 1} onClick={onPrev}
          className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 text-sm">
          ก่อนหน้า
        </button>
        <button disabled={page === lastPage} onClick={onNext}
          className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 text-sm">
          ถัดไป
        </button>
      </div>
    </div>
  )
}

// ---- Page ----

export default function LazadaSessionLogsPage() {
  const { can } = useAuth()
  const [sellerKey, setSellerKey] = useState('')
  const [status, setStatus] = useState('')
  const [triggeredBy, setTriggeredBy] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)

  const resetPage = () => setPage(1)
  const hasFilter = !!(sellerKey || status || triggeredBy || startDate || endDate)

  const { data, isLoading, refetch, isFetching } = useQuery<PaginatedResponse<LazadaSessionLog>>({
    queryKey: ['lazada-session-logs', sellerKey, status, triggeredBy, startDate, endDate, page],
    queryFn: () =>
      api.get('/lazada/session-logs', {
        params: {
          seller_key:   sellerKey || undefined,
          status:       status || undefined,
          triggered_by: triggeredBy || undefined,
          start_date:   startDate || undefined,
          end_date:     endDate || undefined,
          page,
          per_page: 50,
        },
      }).then((r) => r.data),
    enabled: can('lazada-sessions.view'),
  })

  if (!can('lazada-sessions.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const items = data?.data ?? []

  const runColors = new Map<string, boolean>()
  let toggle = false
  items.forEach((item) => {
    if (!runColors.has(item.run_id)) {
      runColors.set(item.run_id, toggle)
      toggle = !toggle
    }
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HistoryIcon className="w-6 h-6 text-orange-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Cookie Capture Logs (Lazada)</h1>
            <p className="text-slate-500 text-sm mt-0.5">ประวัติการ Capture Cookie Lazada ทุกครั้ง</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          รีเฟรช
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={sellerKey}
          onChange={(e) => { setSellerKey(e.target.value); resetPage() }}
          placeholder="Seller Key..."
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono w-36 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />

        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); resetPage() }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
        >
          <option value="">ทุกสถานะ</option>
          <option value="saved">Saved</option>
          <option value="reused">Reused</option>
          <option value="skipped_challenge">Skip Challenge</option>
          <option value="needs_manual_login">ต้องล็อกอินเอง</option>
          <option value="timeout">Timeout</option>
          <option value="error">Error</option>
        </select>

        <select
          value={triggeredBy}
          onChange={(e) => { setTriggeredBy(e.target.value); resetPage() }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
        >
          <option value="">ทุก Trigger</option>
          <option value="api">api</option>
          <option value="manual">manual</option>
          <option value="cli">cli</option>
        </select>

        <input
          type="date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); resetPage() }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="วันที่เริ่ม"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); resetPage() }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="วันที่สิ้นสุด"
        />

        {hasFilter && (
          <button
            onClick={() => { setSellerKey(''); setStatus(''); setTriggeredBy(''); setStartDate(''); setEndDate(''); resetPage() }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">วันที่-เวลา</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Run ID</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ร้านค้า</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600 whitespace-nowrap">สถานะ</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Trigger</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ASC UID</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ระยะเวลา</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <HistoryIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบ Capture Log
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isAlt = runColors.get(item.run_id)
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-orange-50/30 transition-colors ${isAlt ? 'bg-slate-50/60' : 'bg-white'}`}
                    >
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {fmtDateTime(item.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="font-mono text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded"
                          title={item.run_id}
                        >
                          {item.run_id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700 text-xs">{item.shop_name ?? null}</p>
                        <span className="font-mono text-xs text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">
                          {item.seller_key}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <TriggerBadge by={item.triggered_by} />
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-400">
                        {item.asc_uid ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500">
                        {fmtMs(item.duration_ms)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-[180px]">
                        {item.reason ? (
                          <span className="text-red-500 truncate block" title={item.reason}>
                            {item.reason}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {data && (
          <Pagination
            page={page}
            lastPage={data.last_page}
            total={data.total}
            onPrev={() => setPage((p) => p - 1)}
            onNext={() => setPage((p) => p + 1)}
          />
        )}
      </div>

      <p className="text-xs text-slate-400">
        แถวสีต่างกันแบ่งตาม Run ID — 1 Run = 1 การ Capture ที่ระบบเรียก (อาจมีหลายร้านค้า)
      </p>
    </div>
  )
}
