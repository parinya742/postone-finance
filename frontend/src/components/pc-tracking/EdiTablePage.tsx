'use client'

import api from '@/lib/api'
import { PaginatedResponse } from '@/lib/types'
import { useAuth } from '@/context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { useState, ReactNode } from 'react'
import { Search, Lock, Database, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import MultiSelectFilter from './MultiSelectFilter'

export type EdiColumn<T> = {
  label: string
  render: (row: T) => ReactNode
  className?: string
}

export type EdiExportColumn<T> = {
  label: string
  value: (row: T) => string | number | null | undefined
}

export type EdiExportConfig<T> = {
  filename: string               // file prefix, date is appended
  sheetName: string
  columns: EdiExportColumn<T>[]
}

export type EdiSelectFilter = {
  param: string
  placeholder: string
  options: { value: string; label: string; disabled?: boolean }[]
  multiple?: boolean             // checkbox dropdown; sent as param[]=a&param[]=b
}

type Props<T> = {
  permission: string             // menu permission, e.g. 'pc-line-orders.view'
  title: string
  subtitle: string
  endpoint: string
  columns: EdiColumn<T>[]
  searchPlaceholder: string
  rowKey: (row: T) => string | number
  dateFilter?: string            // label shown next to the date range; omit to hide it
  selectFilters?: EdiSelectFilter[]
  perPage?: number
  exportConfig?: EdiExportConfig<T>   // shows the "Export Excel" button when set
}

const inputCls =
  'border border-[#89919A] rounded px-3 py-2 text-sm text-[#32363A] placeholder:text-[#6A6D70] focus:outline-none focus:border-[#0070F2] focus:ring-1 focus:ring-[#0070F2] bg-white'

export function formatDateTime(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v.replace(' ', 'T'))
  if (isNaN(d.getTime())) return v
  return d.toLocaleString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function formatDate(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function formatNumber(v: string | number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  return isNaN(n) ? String(v) : n.toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: 2 })
}

export function BoolBadge({ value, yes = 'ใช่', no = 'ไม่ใช่' }: { value: boolean | null; yes?: string; no?: string }) {
  return value ? (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#F1FDF6] text-[#256F3A]">{yes}</span>
  ) : (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#F5F5F5] text-[#6A6D70]">{no}</span>
  )
}

export default function EdiTablePage<T>({
  permission, title, subtitle, endpoint, columns, searchPlaceholder, rowKey, dateFilter, selectFilters = [], perPage = 20,
  exportConfig,
}: Props<T>) {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selects, setSelects] = useState<Record<string, string | string[]>>({})
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const filters = {
    search: search.trim() || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    ...Object.fromEntries(Object.entries(selects).filter(([, v]) => v.length > 0)),
  }

  const setSelect = (param: string, value: string | string[]) => {
    setSelects((prev) => ({ ...prev, [param]: value }))
    setPage(1)
  }

  const params = { ...filters, page, per_page: perPage }

  async function handleExport() {
    if (!exportConfig) return
    setExporting(true)
    try {
      // Fetch every page with the current filters (server may cap per_page, so follow last_page).
      const all: T[] = []
      let p = 1
      let last = 1
      do {
        const res = await api.get<PaginatedResponse<T>>(endpoint, {
          params: { ...filters, page: p, per_page: 5000, export: 1 },
        })
        all.push(...(res.data?.data ?? []))
        last = res.data?.last_page ?? 1
        p++
      } while (p <= last)

      if (all.length === 0) {
        alert('ไม่พบข้อมูลสำหรับส่งออก')
        return
      }

      const rows = all.map((row) =>
        Object.fromEntries(exportConfig.columns.map((c) => [c.label, c.value(row) ?? ''])),
      )
      const ws = XLSX.utils.json_to_sheet(rows, { header: exportConfig.columns.map((c) => c.label) })
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, exportConfig.sheetName.slice(0, 31))

      const filename = `${exportConfig.filename}-${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, filename)

      api.post('/audit-logs', {
        action: 'export',
        target_type: exportConfig.filename,
        target_id: 0,
        target_name: filename,
        payload: { row_count: all.length, filters },
      }).catch(() => {})
    } catch (err) {
      console.error('Export failed:', err)
      alert('เกิดข้อผิดพลาดในการส่งออก')
    } finally {
      setExporting(false)
    }
  }

  const { data, isLoading } = useQuery<PaginatedResponse<T>>({
    queryKey: ['pc-tracking', endpoint, params],
    queryFn: () => api.get(endpoint, { params }).then((r) => r.data),
    enabled: can(permission),
  })

  if (!can(permission)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#6A6D70]">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const items = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="pb-1 border-b border-[#EBEBEB]">
        <h1 className="text-xl font-semibold text-[#32363A]">{title}</h1>
        <p className="text-[#6A6D70] text-sm mt-0.5">
          ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} รายการ · {subtitle}
        </p>
      </div>

      <div className="bg-white border border-[#EBEBEB] rounded px-4 py-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6A6D70]" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={searchPlaceholder}
            className={`w-full pl-9 ${inputCls}`}
          />
        </div>
        {dateFilter && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#6A6D70] whitespace-nowrap">{dateFilter}</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className={inputCls} />
            <span className="text-[#6A6D70] text-sm">—</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className={inputCls} />
          </div>
        )}
        {selectFilters.map((f) =>
          f.multiple ? (
            <MultiSelectFilter
              key={f.param}
              placeholder={f.placeholder}
              options={f.options}
              value={(selects[f.param] as string[] | undefined) ?? []}
              onChange={(v) => setSelect(f.param, v)}
            />
          ) : (
            <select
              key={f.param}
              value={(selects[f.param] as string | undefined) ?? ''}
              onChange={(e) => setSelect(f.param, e.target.value)}
              className={inputCls}
            >
              <option value="">{f.placeholder}</option>
              {f.options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
            </select>
          ),
        )}
        {exportConfig && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#0070F2] hover:bg-[#0064D9] disabled:opacity-50 text-white text-sm font-medium rounded transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'กำลัง Export...' : 'Export Excel'}
          </button>
        )}
      </div>

      <div className="bg-white border border-[#EBEBEB] rounded">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F5F6F7] border-b border-[#EBEBEB]">
              <tr>
                {columns.map((c) => (
                  <th key={c.label} className="text-left px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.label} className="px-4 py-3"><div className="h-4 bg-[#F0F0F0] rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center text-[#6A6D70]">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={rowKey(row)} className="hover:bg-[#F5F5F5] transition-colors align-top">
                    {columns.map((c) => (
                      <td key={c.label} className={`px-4 py-3 ${c.className ?? 'text-xs text-[#32363A] whitespace-nowrap'}`}>
                        {c.render(row) ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.last_page > 1 && (
          <div className="px-5 py-3 border-t border-[#EBEBEB] flex items-center justify-between text-sm text-[#6A6D70]">
            <span>หน้า {data.current_page} จาก {data.last_page} (ทั้งหมด {data.total?.toLocaleString('th-TH')} รายการ)</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-[#89919A] rounded disabled:opacity-50 hover:bg-[#F5F5F5]">ก่อนหน้า</button>
              <button disabled={page === data.last_page} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-[#89919A] rounded disabled:opacity-50 hover:bg-[#F5F5F5]">ถัดไป</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
