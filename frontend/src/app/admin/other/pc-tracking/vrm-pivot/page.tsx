'use client'

import api from '@/lib/api'
import { VrmExportResponse, VrmOptions, VrmPivotResponse } from '@/lib/types'
import { useAuth } from '@/context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Database, Download, Lock } from 'lucide-react'
import { formatDate, formatDateTime } from '@/components/pc-tracking/EdiTablePage'
import { buildVrmWorkbook } from '@/components/pc-tracking/vrmWorkbook'

const PERMISSION = 'pc-vrm-sales.view'

const inputCls =
  'border border-[#89919A] rounded px-3 py-2 text-sm text-[#32363A] focus:outline-none focus:border-[#0070F2] focus:ring-1 focus:ring-[#0070F2] bg-white'

const fmtQty = (n: number | string) => Number(n).toLocaleString('th-TH', { maximumFractionDigits: 3 })
const fmtValue = (n: number | string) => Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function VrmPivotPage() {
  const { can } = useAuth()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [site, setSite] = useState('')
  const [saleType, setSaleType] = useState('')
  const [artNo, setArtNo] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)

  const params = {
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    site: site || undefined,
    sale_type: saleType || undefined,
    art_no: artNo || undefined,
  }

  const { data: options } = useQuery<VrmOptions>({
    queryKey: ['vrm-options'],
    queryFn: () => api.get('/pc-tracking/vrm/options').then((r) => r.data),
    enabled: can(PERMISSION),
    staleTime: 5 * 60_000,
  })

  const { data, isLoading } = useQuery<VrmPivotResponse>({
    queryKey: ['vrm-pivot', params],
    queryFn: () => api.get('/pc-tracking/vrm/pivot', { params }).then((r) => r.data),
    enabled: can(PERMISSION),
  })

  const sites = useMemo(() => data?.sites ?? [], [data])
  const allExpanded = sites.length > 0 && expanded.size === sites.length

  const toggle = (s: string) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(s)) next.delete(s); else next.add(s)
    return next
  })

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get<VrmExportResponse>('/pc-tracking/vrm/export', { params })
      const art = options?.articles.find((a) => a.art_no === artNo)
      buildVrmWorkbook(res.data, { artLabel: art?.art_desc ?? '(All)', site: site || 'ALL' })
    } catch (err) {
      console.error(err)
    } finally {
      setExporting(false)
    }
  }

  if (!can(PERMISSION)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#6A6D70]">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const latest = options?.latest_batch
  const dayCount = sites.reduce((s, x) => s + x.days.length, 0)

  return (
    <div className="space-y-4">
      <div className="pb-1 border-b border-[#EBEBEB]">
        <h1 className="text-xl font-semibold text-[#32363A]">ยอดขาย VRM (Pivot)</h1>
        <p className="text-[#6A6D70] text-sm mt-0.5">
          ยอดขายตามสาขา × วันที่ · vrm.article_channel_sales_daily
          {latest && <> · ข้อมูลล่าสุด {formatDateTime(latest.exported_at)} (batch #{latest.id})</>}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#EBEBEB] rounded px-4 py-3 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#6A6D70] whitespace-nowrap">วันที่ขาย</label>
          <input type="date" value={dateFrom || data?.date_from || ''} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
          <span className="text-[#6A6D70] text-sm">—</span>
          <input type="date" value={dateTo || data?.date_to || ''} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
        </div>
        <select value={site} onChange={(e) => setSite(e.target.value)} className={`${inputCls} max-w-[240px]`}>
          <option value="">ทุกสาขา (ALL)</option>
          {options?.sites.map((s) => <option key={s.site_no} value={s.site_no}>{s.site_no} — {s.site_name}</option>)}
        </select>
        <select value={saleType} onChange={(e) => setSaleType(e.target.value)} className={inputCls}>
          <option value="">ทุกช่องทาง</option>
          {options?.sale_types.map((t) => <option key={t.code} value={t.code}>{t.code} — {t.description}</option>)}
        </select>
        <select value={artNo} onChange={(e) => setArtNo(e.target.value)} className={`${inputCls} max-w-[280px]`}>
          <option value="">ทุกสินค้า (ARTDESC: All)</option>
          {options?.articles.map((a) => <option key={a.art_no} value={a.art_no}>{a.art_desc} ({a.vd_art_desc ?? a.art_no})</option>)}
        </select>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#0070F2] hover:bg-[#0057C2] disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'กำลัง Export...' : 'Export Excel'}
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          ['Sum of QTY', data ? fmtQty(data.total.qty) : '—'],
          ['Sum of VALUE (บาท)', data ? fmtValue(data.total.value) : '—'],
          ['จำนวนสาขา', data ? sites.length.toLocaleString('th-TH') : '—'],
        ].map(([label, value]) => (
          <div key={label} className="bg-white border border-[#EBEBEB] rounded px-4 py-3">
            <p className="text-xs text-[#6A6D70]">{label}</p>
            <p className="text-xl font-semibold text-[#32363A] mt-1 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Pivot */}
      <div className="bg-white border border-[#EBEBEB] rounded">
        <div className="px-4 py-2 border-b border-[#EBEBEB] flex items-center justify-between text-sm">
          <span className="text-[#6A6D70]">
            {data ? `${formatDate(data.date_from)} – ${formatDate(data.date_to)} · ${sites.length} สาขา · ${dayCount.toLocaleString('th-TH')} แถว` : ' '}
          </span>
          <button
            onClick={() => setExpanded(allExpanded ? new Set() : new Set(sites.map((s) => s.site_no)))}
            disabled={sites.length === 0}
            className="text-[#0070F2] hover:underline disabled:opacity-50"
          >
            {allExpanded ? 'ย่อทั้งหมด' : 'ขยายทั้งหมด'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F5F6F7] border-b border-[#EBEBEB]">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-[#6A6D70]">SITENO / PERIODDATE</th>
                <th className="text-right px-4 py-3 font-medium text-[#6A6D70] w-40">Sum of QTY</th>
                <th className="text-right px-4 py-3 font-medium text-[#6A6D70] w-48">Sum of VALUE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>{[0, 1, 2].map((j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-[#F0F0F0] rounded animate-pulse" /></td>)}</tr>
                ))
              ) : sites.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-[#6A6D70]">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                sites.map((s) => {
                  const open = expanded.has(s.site_no)
                  return (
                    <Fragment key={s.site_no}>
                      <tr className="bg-[#FAFAFA] hover:bg-[#F0F4F8] cursor-pointer" onClick={() => toggle(s.site_no)}>
                        <td className="px-4 py-2.5 font-medium text-[#32363A]">
                          <span className="inline-flex items-center gap-1.5">
                            {open ? <ChevronDown className="w-4 h-4 text-[#6A6D70]" /> : <ChevronRight className="w-4 h-4 text-[#6A6D70]" />}
                            <span className="font-mono">{s.site_no}</span>
                            <span className="text-[#6A6D70] font-normal">{s.site_name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">{fmtQty(s.qty)}</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">{fmtValue(s.value)}</td>
                      </tr>
                      {open && s.days.map((d) => (
                        <tr key={d.period_date} className="hover:bg-[#F5F5F5]">
                          <td className="pl-12 pr-4 py-2 text-xs text-[#32363A]">{formatDate(d.period_date)}</td>
                          <td className="px-4 py-2 text-right text-xs tabular-nums">{fmtQty(d.qty)}</td>
                          <td className="px-4 py-2 text-right text-xs tabular-nums">{fmtValue(d.value)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })
              )}
            </tbody>
            {data && sites.length > 0 && (
              <tfoot className="border-t-2 border-[#D9D9D9] bg-[#F5F6F7]">
                <tr>
                  <td className="px-4 py-3 font-semibold text-[#32363A]">Grand Total</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtQty(data.total.qty)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtValue(data.total.value)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
