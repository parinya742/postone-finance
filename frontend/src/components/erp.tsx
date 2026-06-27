'use client'

import { Lock } from 'lucide-react'
import React from 'react'

// ── Formatters ────────────────────────────────────────────────────────────────

export function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function fmtAmt(n: number | null) {
  if (n == null) return '—'
  const fmt = Math.abs(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `-${fmt}` : fmt
}

// ── Table Primitives ──────────────────────────────────────────────────────────

export function TH({ children, right, center, w }: {
  children: React.ReactNode; right?: boolean; center?: boolean; w?: string
}) {
  return (
    <th
      style={w ? { width: w, minWidth: w } : undefined}
      className={`px-2.5 py-2 text-[10px] font-semibold text-[#354A5E] uppercase tracking-wider whitespace-nowrap border-r border-[#D9D9D9] last:border-r-0 ${right ? 'text-right' : center ? 'text-center' : 'text-left'}`}
    >
      {children}
    </th>
  )
}

export function TD({ children, right, center }: {
  children: React.ReactNode; right?: boolean; center?: boolean
}) {
  return (
    <td className={`px-2.5 py-1.5 text-xs text-[#32363A] border-r border-[#EBEBEB] last:border-r-0 ${right ? 'text-right' : center ? 'text-center' : ''}`}>
      {children}
    </td>
  )
}

// ── Cell Components ───────────────────────────────────────────────────────────

export function AmountCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[#D9D9D9]">—</span>
  return (
    <span className={`font-mono tabular-nums ${value < 0 ? 'text-[#BB0000]' : value > 0 ? 'text-[#107E3E]' : 'text-[#6A6D70]'}`}>
      {fmtAmt(value)}
    </span>
  )
}

export function StatusBadge({ value, colorMap, labels }: {
  value: string | null
  colorMap: Record<string, string>
  labels?: Record<string, string>
}) {
  if (!value) return <span className="text-[#D9D9D9]">—</span>
  const cls = colorMap[value] ?? 'bg-[#F5F5F5] text-[#6A6D70] border-[#D9D9D9]'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold border rounded-sm ${cls}`}>
      {labels?.[value] ?? value}
    </span>
  )
}

// ── Form Primitives ───────────────────────────────────────────────────────────

export function SapInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] text-[#6A6D70] uppercase tracking-wide font-medium whitespace-nowrap">{label}</span>
      {children}
    </div>
  )
}

export const inputCls = 'h-8 border border-[#D9D9D9] rounded text-sm text-[#32363A] bg-white px-2.5 focus:outline-none focus:border-[#0070F2] focus:ring-1 focus:ring-[#0070F2]/20'

// ── Common Blocks ─────────────────────────────────────────────────────────────

export function ErpNoAccess() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-[#6A6D70]">
      <Lock className="w-10 h-10 mb-3 text-[#D9D9D9]" />
      <p className="text-sm font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
    </div>
  )
}

type PaginationData = {
  total: number
  current_page: number
  per_page: number
  last_page: number
}

export function ErpPagination({
  data,
  page,
  setPage,
  unit = 'รายการ',
}: {
  data: PaginationData
  page: number
  setPage: (fn: (p: number) => number) => void
  unit?: string
}) {
  return (
    <div className="px-4 py-2.5 border-t border-[#D9D9D9] flex items-center justify-between bg-[#F9FAFB]">
      <span className="text-xs text-[#6A6D70]">
        {data.total > 0
          ? `แสดง ${((data.current_page - 1) * data.per_page) + 1}–${Math.min(data.current_page * data.per_page, data.total)} จาก ${data.total.toLocaleString('th-TH')} ${unit}`
          : `0 ${unit}`}
      </span>
      {data.last_page > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6A6D70]">หน้า {data.current_page} / {data.last_page}</span>
          <div className="flex gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="h-7 px-3 border border-[#D9D9D9] rounded text-xs text-[#32363A] disabled:opacity-40 hover:bg-[#F5F5F5] transition-colors"
            >
              ‹ ก่อนหน้า
            </button>
            <button
              disabled={page === data.last_page}
              onClick={() => setPage(p => p + 1)}
              className="h-7 px-3 border border-[#D9D9D9] rounded text-xs text-[#32363A] disabled:opacity-40 hover:bg-[#F5F5F5] transition-colors"
            >
              ถัดไป ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
