'use client'

import api from '@/lib/api'
import React, { useEffect, useState } from 'react'
import { Download, History, Loader2, X } from 'lucide-react'
import clsx from 'clsx'
import { TH, TD, ErpPagination, StatusBadge, SapInput, inputCls } from '@/components/erp'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { MtAuditLog, PaginatedResponse } from '@/lib/types'

// ── Formatters ────────────────────────────────────────────────────────────────

export function toNum(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function fmtNum(v: string | number | null | undefined, decimals = 0) {
  const n = toNum(v)
  if (n == null) return '—'
  return n.toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function fmtBytes(bytes: number | null) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export function useDebounced<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ── Layout blocks ─────────────────────────────────────────────────────────────

export function CrcHeader({ section = 'CRC', crumb, title, right }: {
  section?: string; crumb: string; title: string; right?: React.ReactNode
}) {
  return (
    <div className="bg-white border border-[#D9D9D9] px-4 py-2.5 flex items-center justify-between">
      <div>
        <p className="text-[10px] text-[#6A6D70] uppercase tracking-wide">MT / {section} / {crumb}</p>
        <h1 className="text-sm font-semibold text-[#32363A] leading-tight">{title}</h1>
      </div>
      {right && <span className="text-xs text-[#6A6D70]">{right}</span>}
    </div>
  )
}

export function CrcViewTabs<K extends string>({ tabs, active, onChange }: {
  tabs: { key: K; label: string }[]
  active: K
  onChange: (key: K) => void
}) {
  return (
    <div className="bg-white border-x border-b border-[#D9D9D9] px-4 flex gap-1">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={clsx(
            'px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors',
            active === t.key
              ? 'text-[#0070F2] border-[#0070F2]'
              : 'text-[#6A6D70] border-transparent hover:text-[#32363A]'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function CrcFilterBar({ hasFilter, onReset, children }: {
  hasFilter: boolean
  onReset: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-[#F9FAFB] border-x border-b border-[#D9D9D9] px-4 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-semibold text-[#6A6D70] uppercase tracking-wider">ตัวกรอง</span>
        {hasFilter && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#6A6D70] hover:text-[#32363A] border border-[#D9D9D9] rounded bg-white hover:bg-[#F5F5F5] transition-colors"
          >
            <X className="w-3 h-3" /> ล้างตัวกรอง
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3 items-end">{children}</div>
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────

export type CrcColumn<T> = {
  key: string
  header: string
  w?: string
  align?: 'right' | 'center'
  render: (row: T) => React.ReactNode
  /** key in the response `totals` to show in the footer row */
  total?: { key: string; decimals?: number }
}

type Paged<T> = {
  data: T[]
  total: number
  current_page: number
  per_page: number
  last_page: number
  totals?: Record<string, string | number | null>
}

export function CrcTable<T extends { id: number }>({
  columns, data, isLoading, page, setPage, emptyText, emptyIcon, unit = 'รายการ',
}: {
  columns: CrcColumn<T>[]
  data: Paged<T> | undefined
  isLoading: boolean
  page: number
  setPage: (fn: (p: number) => number) => void
  emptyText: string
  emptyIcon: React.ReactNode
  unit?: string
}) {
  const rows = data?.data ?? []
  const minWidth = columns.reduce((sum, c) => sum + (parseInt(c.w ?? '100', 10) || 100), 0)
  const totals = data?.totals
  const showTotals = !!totals && rows.length > 0 && columns.some(c => c.total)

  return (
    <div className="bg-white border border-[#D9D9D9] border-t-0 overflow-x-auto">
      <table className="w-full text-xs border-collapse" style={{ minWidth: `${minWidth}px` }}>
        <thead>
          <tr className="bg-[#F2F4F7] border-b-2 border-[#0070F2]">
            {columns.map(c => (
              <TH key={c.key} w={c.w} right={c.align === 'right'} center={c.align === 'center'}>{c.header}</TH>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            [...Array(8)].map((_, i) => (
              <tr key={i} className="border-b border-[#EBEBEB]">
                {columns.map(c => (
                  <td key={c.key} className="px-2.5 py-1.5 border-r border-[#EBEBEB]">
                    <div className="h-2.5 bg-[#F2F4F7] rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center text-[#6A6D70] text-sm">
                <div className="flex justify-center mb-2 text-[#D9D9D9]">{emptyIcon}</div>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map(row => (
              <tr key={row.id} className="border-b border-[#EBEBEB] hover:bg-[#F9FAFB] transition-colors">
                {columns.map(c => (
                  <TD key={c.key} right={c.align === 'right'} center={c.align === 'center'}>{c.render(row)}</TD>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {showTotals && (
          <tfoot>
            <tr className="bg-[#F2F4F7] border-t-2 border-[#D9D9D9] font-semibold">
              {columns.map((c, i) => (
                <TD key={c.key} right={c.align === 'right'} center={c.align === 'center'}>
                  {c.total
                    ? <span className="font-mono tabular-nums">{fmtNum(totals![c.total.key], c.total.decimals ?? 0)}</span>
                    : i === 0 ? <span className="text-[10px] uppercase text-[#6A6D70]">รวมทั้งหมด</span> : null}
                </TD>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
      {data && <ErpPagination data={data} page={page} setPage={setPage} unit={unit} />}
    </div>
  )
}

// ── Cells ─────────────────────────────────────────────────────────────────────

export const dash = <span className="text-[#D9D9D9]">—</span>

export function NumCell({ value, decimals = 0, colored }: {
  value: string | number | null; decimals?: number; colored?: boolean
}) {
  const n = toNum(value)
  if (n == null) return dash
  return (
    <span className={clsx(
      'font-mono tabular-nums',
      colored && (n < 0 ? 'text-[#BB0000]' : n > 0 ? 'text-[#107E3E]' : 'text-[#6A6D70]')
    )}>
      {fmtNum(n, decimals)}
    </span>
  )
}

export function TextCell({ value, max = 200, mono, muted }: {
  value: string | null; max?: number; mono?: boolean; muted?: boolean
}) {
  if (!value) return dash
  return (
    <span
      className={clsx('truncate block', mono && 'font-mono text-[10px]', muted && 'text-[#6A6D70]')}
      style={{ maxWidth: max }}
      title={value}
    >
      {value}
    </span>
  )
}

export function CrcDownloadButton({ type, id, base = '/crc', path, title = 'ดาวน์โหลดไฟล์ต้นฉบับ' }: {
  type?: string
  id?: number
  /** API prefix of the report module, e.g. '/crc' or '/hpmh' */
  base?: string
  /** Full API path of the download endpoint — overrides base/type/id for modules with another URL shape */
  path?: string
  title?: string
}) {
  const [loading, setLoading] = useState(false)

  const download = async () => {
    setLoading(true)
    try {
      const { data } = await api.get<{ url: string }>(path ?? `${base}/files/${type}/${id}/download`)
      window.open(data.url, '_blank', 'noopener')
    } catch {
      alert('ไม่สามารถดาวน์โหลดไฟล์ได้')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={download}
      disabled={loading}
      title={title}
      className="inline-flex items-center justify-center w-6 h-6 rounded text-[#6A6D70] hover:text-[#0070F2] hover:bg-[#EBF5FB] transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
    </button>
  )
}

export function ViewDataButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 text-[10px] font-semibold text-[#0070F2] border border-[#0070F2]/40 rounded hover:bg-[#EBF5FE] transition-colors whitespace-nowrap"
    >
      ดูข้อมูล
    </button>
  )
}

// ── Scraper run log (audit_log) ───────────────────────────────────────────────

const AUDIT_STATUS_COLORS: Record<string, string> = {
  SUCCESS: 'bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40',
  FAILED:  'bg-[#FFEBEB] text-[#BB0000] border-[#BB0000]/40',
  ERROR:   'bg-[#FFEBEB] text-[#BB0000] border-[#BB0000]/40',
  RUNNING: 'bg-[#EBF5FE] text-[#0070F2] border-[#0070F2]/40',
  SKIPPED: 'bg-[#F5F5F5] text-[#6A6D70] border-[#D9D9D9]',
}

function fmtDuration(ms: number | null) {
  if (ms == null) return '—'
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

/** audit_log of an n8n scraper schema, served at `${base}/audit-logs` (+ `${base}/audit-log-topics`). */
export function MtAuditLogTable({ base, queryKey, params }: {
  base: string
  queryKey: string
  /** Fixed query params, e.g. { vendor_no } — vendor-less runs (login, ...) are still included */
  params?: Record<string, string>
}) {
  const [status, setStatus] = useState('')
  const [topic, setTopic] = useState('')
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  const { data: topics } = useQuery<string[]>({
    queryKey: [queryKey, 'audit-log-topics'],
    queryFn: () => api.get(`${base}/audit-log-topics`).then(r => r.data),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<MtAuditLog>>({
    queryKey: [queryKey, 'audit-logs', params, status, topic, debouncedSearch, startDate, endDate, page],
    queryFn: () => api.get(`${base}/audit-logs`, {
      params: {
        ...params,
        status: status || undefined,
        topic: topic || undefined,
        search: debouncedSearch || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        per_page: 50,
      },
    }).then(r => r.data),
    placeholderData: keepPreviousData,
  })

  const hasFilter = !!(status || topic || search || startDate || endDate)
  const resetFilters = () => { setStatus(''); setTopic(''); setSearch(''); setStartDate(''); setEndDate(''); setPage(1) }

  const columns: CrcColumn<MtAuditLog>[] = [
    { key: 'started_at', header: 'เริ่มเมื่อ', w: '130px', render: l => <span className="text-[#6A6D70] whitespace-nowrap">{fmtDateTime(l.started_at)}</span> },
    { key: 'topic', header: 'Topic', w: '140px', render: l => <span className="font-mono text-[10px]">{l.topic ?? '—'}</span> },
    { key: 'step', header: 'Step', w: '220px', render: l => <TextCell value={l.step} max={220} mono /> },
    { key: 'status', header: 'สถานะ', w: '80px', align: 'center', render: l => <StatusBadge value={l.status} colorMap={AUDIT_STATUS_COLORS} /> },
    { key: 'message', header: 'ข้อความ', w: '420px', render: l => (
      <>
        <TextCell value={l.message} max={420} />
        {l.error_detail && <span className="block text-[10px] text-[#BB0000] truncate" style={{ maxWidth: 420 }} title={l.error_detail}>{l.error_detail}</span>}
      </>
    ) },
    { key: 'duration_ms', header: 'ใช้เวลา', w: '70px', align: 'right', render: l => <span className="tabular-nums text-[#6A6D70]">{fmtDuration(l.duration_ms)}</span> },
  ]

  return (
    <>
      <CrcFilterBar hasFilter={hasFilter} onReset={resetFilters}>
        <SapInput label="ค้นหา">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="ข้อความ, Step, Error..."
            className={`${inputCls} w-72`}
          />
        </SapInput>
        <SapInput label="สถานะ">
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[120px]`}>
            <option value="">ทั้งหมด</option>
            {Object.keys(AUDIT_STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </SapInput>
        <SapInput label="Topic">
          <select value={topic} onChange={e => { setTopic(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[160px]`}>
            <option value="">ทั้งหมด</option>
            {topics?.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </SapInput>
        <SapInput label="วันที่ ตั้งแต่">
          <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} className={inputCls} />
        </SapInput>
        <SapInput label="ถึง">
          <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} className={inputCls} />
        </SapInput>
      </CrcFilterBar>
      <CrcTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        page={page}
        setPage={setPage}
        emptyText="ยังไม่มีประวัติการทำงาน"
        emptyIcon={<History className="w-8 h-8" />}
      />
    </>
  )
}
