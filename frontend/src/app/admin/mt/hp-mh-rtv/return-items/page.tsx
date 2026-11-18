'use client'

import api from '@/lib/api'
import {
  CrcPaginatedResponse, HpmhRtvExtractProgress, HpmhRtvReturnItem, HpmhRtvReturnItemGroup, HpmhRtvReturnItemSummary,
} from '@/lib/types'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { Search, Boxes, Eye, Database, X, BarChart3, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, StatusBadge, SapInput, inputCls, ErpNoAccess } from '@/components/erp'
import PdfViewer from '@/components/ui/PdfViewer'
import {
  CrcHeader, CrcViewTabs, CrcFilterBar, CrcTable, dash, fmtNum, toNum, useDebounced, type CrcColumn,
} from '@/components/crc'
import { MOVEMENT_COLORS, MOVEMENT_LABELS, REVERSAL_MVTS } from '../movement'

type View = 'items' | 'summary'

const VENDOR_NO = '501447'
const API = '/hpmh-rtv/return-items'

type Options = {
  sites: { site_code: string; site: string | null }[]
  buyers: { buyer_code: string; buyer_name: string | null }[]
  reasons: { reason: string; lines: number }[]
  mvts: string[]
}

const GROUPS: { key: HpmhRtvReturnItemGroup; label: string; keyHeader: string; labelHeader?: string }[] = [
  { key: 'article', label: 'สินค้า', keyHeader: 'Article', labelHeader: 'รายการสินค้า' },
  { key: 'reason', label: 'เหตุผลการคืน', keyHeader: 'เหตุผลการคืน' },
  { key: 'site', label: 'สาขา', keyHeader: 'สาขา', labelHeader: 'ชื่อสาขา' },
  { key: 'buyer', label: 'Buyer', keyHeader: 'Buyer', labelHeader: 'ชื่อ' },
  { key: 'month', label: 'เดือน', keyHeader: 'เดือน' },
]

const thCls = 'px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[#6A6D70] whitespace-nowrap border-r border-[#E5E5E5] last:border-r-0'
const tdCls = 'px-2.5 py-1.5 border-r border-[#EBEBEB] last:border-r-0'

const isReversal = (mvt: string | null) => !!mvt && REVERSAL_MVTS.includes(mvt)

/** Reversal lines (MVT 162/123) shown negative, matching the net totals */
function SignedNum({ value, mvt, decimals = 0 }: { value: string | number | null; mvt: string | null; decimals?: number }) {
  const n = toNum(value)
  if (n == null) return dash
  const signed = isReversal(mvt) ? -n : n
  return <span className={clsx('font-mono tabular-nums', signed < 0 && 'text-[#BB0000]')}>{fmtNum(signed, decimals)}</span>
}

function parseRemarks(json: string | null): string[] {
  try {
    const v = JSON.parse(json ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function monthLabel(ym: string | null) {
  if (!ym) return '—'
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })
}

export default function HpmhRtvReturnItemsPage() {
  const { can } = useAuth()
  const allowed = can('hpmh-rtv-return-items.view')
  const canSeeSlips = can('hpmh-rtv-return-slips.view')
  const [view, setView] = useState<View>('items')
  const [group, setGroup] = useState<HpmhRtvReturnItemGroup>('article')

  // ── Filters (shared by both tabs) ──
  const [search, setSearch] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [buyerCode, setBuyerCode] = useState('')
  const [mvt, setMvt] = useState('')
  const [reason, setReason] = useState('')
  const [article, setArticle] = useState('')   // set by drilling down from the product summary
  const [reversal, setReversal] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  const [viewDocId, setViewDocId] = useState<number | null>(null)

  const params = {
    vendor_no: VENDOR_NO,
    search: debouncedSearch || undefined,
    site_code: siteCode || undefined,
    buyer_code: buyerCode || undefined,
    mvt: mvt || undefined,
    reason: reason || undefined,
    article: article || undefined,
    reversal: reversal ? 1 : undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  }
  const filterKey = [debouncedSearch, siteCode, buyerCode, mvt, reason, article, reversal, startDate, endDate]

  const { data: status } = useQuery<HpmhRtvExtractProgress>({
    queryKey: ['hpmh-rtv-extract-status', VENDOR_NO, 'items'],
    queryFn: () => api.get(`${API}/status`, { params: { vendor_no: VENDOR_NO } }).then(r => r.data),
    enabled: allowed,
  })

  const { data: options } = useQuery<Options>({
    queryKey: ['hpmh-rtv-return-item-options', VENDOR_NO],
    queryFn: () => api.get(`${API}/options`, { params: { vendor_no: VENDOR_NO } }).then(r => r.data),
    enabled: allowed,
  })

  const { data, isLoading } = useQuery<CrcPaginatedResponse<HpmhRtvReturnItem, 'qty' | 'amount'>>({
    queryKey: ['hpmh-rtv-return-items', VENDOR_NO, ...filterKey, page],
    queryFn: () => api.get(API, { params: { ...params, page, per_page: 50 } }).then(r => r.data),
    enabled: allowed && view === 'items',
    placeholderData: keepPreviousData,
  })

  const { data: summary, isLoading: summaryLoading } = useQuery<HpmhRtvReturnItemSummary>({
    queryKey: ['hpmh-rtv-return-item-summary', VENDOR_NO, group, ...filterKey],
    queryFn: () => api.get(`${API}/summary`, { params: { ...params, group } }).then(r => r.data),
    enabled: allowed && view === 'summary',
    placeholderData: keepPreviousData,
  })

  // PDF viewer: steps through the distinct slips on the current page
  const docIds = [...new Set((data?.data ?? []).map(r => r.document_id))]
  const viewIndex = viewDocId != null ? docIds.indexOf(viewDocId) : -1
  const viewingRow = viewDocId != null ? data?.data.find(r => r.document_id === viewDocId) : undefined
  const { data: viewUrl, isLoading: viewUrlLoading, isError: viewUrlError } = useQuery<string>({
    queryKey: ['hpmh-rtv-item-pdf-url', viewDocId],
    queryFn: () => api.get<{ url: string }>(`${API}/documents/${viewDocId}/download`, { params: { inline: 1 } }).then(r => r.data.url),
    enabled: viewDocId != null,
    staleTime: 8 * 60 * 1000,
  })

  if (!allowed) return <ErpNoAccess />

  const hasFilter = !!(search || siteCode || buyerCode || mvt || reason || article || reversal || startDate || endDate)
  const resetFilters = () => {
    setSearch(''); setSiteCode(''); setBuyerCode(''); setMvt(''); setReason(''); setArticle(''); setReversal(false)
    setStartDate(''); setEndDate(''); setPage(1)
  }
  const set = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1) }

  const downloadPdf = async (docId: number) => {
    try {
      const { data: res } = await api.get<{ url: string }>(`${API}/documents/${docId}/download`)
      window.open(res.url, '_blank', 'noopener')
    } catch {
      alert('ไม่สามารถดาวน์โหลดไฟล์ได้')
    }
  }

  /** Summary row → the line list filtered to it */
  const drillDown = (key: string | null) => {
    if (key == null) return
    if (group === 'article') setArticle(key)
    if (group === 'reason') setReason(key)
    if (group === 'site') setSiteCode(key)
    if (group === 'buyer') setBuyerCode(key)
    if (group === 'month') {
      const [y, m] = key.split('-').map(Number)
      setStartDate(`${key}-01`)
      setEndDate(`${key}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`)
    }
    setPage(1)
    setView('items')
  }

  const COLUMNS: CrcColumn<HpmhRtvReturnItem>[] = [
    { key: 'doc', header: 'เลขที่เอกสาร', w: '120px', render: r => (
      <span className="font-mono text-[10px] text-[#0064D9] whitespace-nowrap">
        {r.article_doc_no ?? '—'}<span className="text-[#6A6D70]"> #{r.item_no}</span>
      </span>
    ) },
    { key: 'doc_date', header: 'วันที่', w: '80px', render: r => <span className="text-[#6A6D70]">{fmtDate(r.doc_date)}</span> },
    { key: 'site', header: 'สาขา', w: '130px', render: r => (
      <div className="min-w-0">
        <span className="font-mono text-[10px]">{r.site_code ?? '—'}</span>
        {r.site && <div className="text-[10px] text-[#6A6D70] truncate max-w-[120px]" title={r.site}>{r.site}</div>}
      </div>
    ) },
    { key: 'buyer', header: 'Buyer', w: '70px', align: 'center', render: r => (
      <span className="font-mono text-[10px]" title={r.buyer_name ?? undefined}>{r.buyer_code ?? '—'}</span>
    ) },
    { key: 'mvt', header: 'MVT', w: '60px', align: 'center', render: r => (
      <span title={r.mvt ? MOVEMENT_LABELS[r.mvt] : undefined}>
        <StatusBadge value={r.mvt} colorMap={MOVEMENT_COLORS} />
      </span>
    ) },
    { key: 'article', header: 'Article / VD Part#', w: '110px', render: r => (
      <div className="font-mono text-[10px]">
        <div className="text-[#0064D9]">{r.article ?? '—'}</div>
        <div className="text-[#6A6D70]">{r.vd_part ?? ''}</div>
      </div>
    ) },
    { key: 'description', header: 'รายการสินค้า', w: '320px', render: r => {
      const remarks = parseRemarks(r.remarks)
      const notes = r.return_reason ? remarks.slice(1) : remarks
      return (
        <div className="min-w-0 whitespace-normal">
          <div title={r.description_pdf && r.description_pdf !== r.description ? `ข้อความเดิมใน PDF: ${r.description_pdf}` : undefined}>
            {r.description ?? '—'}
          </div>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {r.return_reason && (
              <span className="px-1.5 py-px text-[10px] text-[#32363A] bg-[#F2F4F7] border border-[#D9D9D9] rounded-sm">{r.return_reason}</span>
            )}
            {r.reversed_doc_no && (
              <span className="px-1.5 py-px text-[10px] text-[#E9730C] bg-[#FEF7F1] border border-[#E9730C]/40 rounded-sm">ยกเลิกใบ {r.reversed_doc_no}</span>
            )}
          </div>
          {notes.map((n, i) => <div key={i} className="text-[10px] text-[#6A6D70]">*** {n}</div>)}
        </div>
      )
    } },
    { key: 'po', header: 'PO', w: '110px', render: r => (
      <span className="font-mono text-[10px] whitespace-nowrap">{r.po_no ? `${r.po_no}${r.po_item ? `/${r.po_item}` : ''}` : '—'}</span>
    ) },
    { key: 'qty', header: 'จำนวน', w: '80px', align: 'right', total: { key: 'qty' }, render: r => (
      <div>
        <SignedNum value={r.qty} mvt={r.mvt} /> <span className="text-[10px] text-[#6A6D70]">{r.unit}</span>
        {r.base_qty != null && (toNum(r.base_qty) !== toNum(r.qty) || r.base_unit !== r.unit) && (
          <div className="text-[10px] text-[#6A6D70]">= {fmtNum(r.base_qty)} {r.base_unit}</div>
        )}
      </div>
    ) },
    { key: 'price', header: '@', w: '90px', align: 'right', render: r => <span className="font-mono tabular-nums">{fmtNum(r.price, 2)}</span> },
    { key: 'amount', header: 'จำนวนเงิน', w: '110px', align: 'right', total: { key: 'amount', decimals: 2 }, render: r => (
      <SignedNum value={r.amount} mvt={r.mvt} decimals={2} />
    ) },
    { key: 'pdf', header: 'PDF', w: '50px', align: 'center', render: r => (
      <button
        onClick={() => setViewDocId(r.document_id)}
        title="ดูใบคืนสินค้า (PDF)"
        className="inline-flex items-center justify-center w-6 h-6 rounded text-[#6A6D70] hover:text-[#0070F2] hover:bg-[#EBF5FB] transition-colors"
      >
        <Eye className="w-3.5 h-3.5" />
      </button>
    ) },
  ]

  const groupDef = GROUPS.find(g => g.key === group)!
  const headerCount = view === 'items'
    ? (isLoading ? '...' : `${data?.total?.toLocaleString('th-TH') ?? 0} รายการ`)
    : (summaryLoading ? '...' : `${summary?.rows.length.toLocaleString('th-TH') ?? 0} กลุ่ม`)

  return (
    <div className="space-y-0 text-[#32363A]">
      <CrcHeader
        section={`HP-MH-RTV / Vendor ${VENDOR_NO}`}
        crumb="Return Items"
        title="รายการสินค้าที่คืน (จาก PDF)"
        right={headerCount}
      />
      <CrcViewTabs<View>
        tabs={[
          { key: 'items', label: 'รายการสินค้า' },
          { key: 'summary', label: 'สรุป' },
        ]}
        active={view}
        onChange={setView}
      />

      {/* Coverage: only processed slips are in here */}
      {status && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 bg-white border border-[#D9D9D9] border-t-0 text-[11px] text-[#6A6D70]">
          <span className="inline-flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#0070F2]" />
            ข้อมูลจากใบคืนที่ประมวลผลแล้ว <b className="text-[#32363A]">{fmtNum(status.extracted)}</b> / {fmtNum(status.documents)} ใบ
          </span>
          {status.pending > 0 && (
            <span className="text-[#E9730C]">
              รอประมวลผล {fmtNum(status.pending)} ใบ
              {canSeeSlips && <> — <Link href="/admin/mt/hp-mh-rtv/return-slips" className="text-[#0070F2] hover:underline">ไปที่หน้าใบคืนสินค้า</Link></>}
            </span>
          )}
          {status.error > 0 && <span className="text-[#BB0000]">อ่านไม่ได้ {fmtNum(status.error)} ใบ</span>}
          <span className="ml-auto text-[10px]">ยอดเป็นยอดสุทธิ — รายการ MVT 162 / 123 (ยกเลิกการคืน) หักออกและแสดงเป็นค่าติดลบ</span>
        </div>
      )}

      <CrcFilterBar hasFilter={hasFilter} onReset={resetFilters}>
        <SapInput label="ค้นหา">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6A6D70]" />
            <input
              value={search}
              onChange={e => set(setSearch)(e.target.value)}
              placeholder="เลขที่เอกสาร, Article, ชื่อสินค้า, PO..."
              className={`${inputCls} pl-7 w-64`}
            />
          </div>
        </SapInput>
        <SapInput label="สาขา">
          <select value={siteCode} onChange={e => set(setSiteCode)(e.target.value)} className={`${inputCls} pr-7 min-w-[130px]`}>
            <option value="">ทั้งหมด</option>
            {options?.sites.map(s => <option key={s.site_code} value={s.site_code}>{s.site_code}{s.site ? ` ${s.site}` : ''}</option>)}
          </select>
        </SapInput>
        <SapInput label="Buyer">
          <select value={buyerCode} onChange={e => set(setBuyerCode)(e.target.value)} className={`${inputCls} pr-7 min-w-[120px]`}>
            <option value="">ทั้งหมด</option>
            {options?.buyers.map(b => <option key={b.buyer_code} value={b.buyer_code}>{b.buyer_code}{b.buyer_name ? ` ${b.buyer_name}` : ''}</option>)}
          </select>
        </SapInput>
        <SapInput label="Movement">
          <select value={mvt} onChange={e => set(setMvt)(e.target.value)} className={`${inputCls} pr-7 min-w-[150px]`}>
            <option value="">ทั้งหมด</option>
            {options?.mvts.map(m => <option key={m} value={m}>{MOVEMENT_LABELS[m] ?? m}</option>)}
          </select>
        </SapInput>
        <SapInput label="เหตุผลการคืน">
          <select value={reason} onChange={e => set(setReason)(e.target.value)} className={`${inputCls} pr-7 min-w-[170px] max-w-[240px]`}>
            <option value="">ทั้งหมด</option>
            {options?.reasons.map(r => (
              <option key={r.reason} value={r.reason}>{r.reason === '-' ? '(ไม่ระบุ)' : r.reason} ({fmtNum(r.lines)})</option>
            ))}
          </select>
        </SapInput>
        <SapInput label="วันที่ตั้งแต่">
          <input type="date" value={startDate} onChange={e => set(setStartDate)(e.target.value)} className={inputCls} />
        </SapInput>
        <SapInput label="ถึง">
          <input type="date" value={endDate} onChange={e => set(setEndDate)(e.target.value)} className={inputCls} />
        </SapInput>
        <label className="flex items-center gap-1.5 h-8 text-[11px] text-[#32363A] cursor-pointer select-none">
          <input type="checkbox" checked={reversal} onChange={e => set(setReversal)(e.target.checked)} className="accent-[#0070F2]" />
          เฉพาะที่ยกเลิกใบอื่น (REV)
        </label>
        {article && (
          <span className="inline-flex items-center gap-1 h-7 px-2 text-[11px] text-[#0070F2] bg-[#EBF5FE] border border-[#0070F2]/40 rounded">
            Article {article}
            <button onClick={() => set(setArticle)('')} title="ล้าง"><X className="w-3 h-3" /></button>
          </span>
        )}
      </CrcFilterBar>

      {view === 'items' && (
        <CrcTable
          columns={COLUMNS}
          data={data}
          isLoading={isLoading}
          page={page}
          setPage={setPage}
          emptyText={status && status.extracted === 0 ? 'ยังไม่มีใบคืนที่ประมวลผล' : 'ไม่พบรายการ'}
          emptyIcon={<Boxes className="w-8 h-8" />}
          unit="รายการ"
        />
      )}

      {view === 'summary' && (
        <div className="bg-white border border-[#D9D9D9] border-t-0">
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-[#E5E5E5]">
            <BarChart3 className="w-3.5 h-3.5 text-[#6A6D70]" />
            <span className="text-[11px] text-[#6A6D70] mr-1">สรุปตาม</span>
            {GROUPS.map(g => (
              <button
                key={g.key}
                onClick={() => setGroup(g.key)}
                className={clsx(
                  'h-6 px-2.5 text-[11px] rounded border transition-colors',
                  group === g.key
                    ? 'text-white bg-[#0070F2] border-[#0070F2]'
                    : 'text-[#32363A] border-[#D9D9D9] hover:bg-[#F5F5F5]',
                )}
              >
                {g.label}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-[#6A6D70]">คลิกแถวเพื่อดูรายการสินค้าของกลุ่มนั้น</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#F2F4F7] border-b-2 border-[#0070F2]">
                  <th className={thCls}>{groupDef.keyHeader}</th>
                  {groupDef.labelHeader && <th className={thCls}>{groupDef.labelHeader}</th>}
                  <th className={clsx(thCls, 'text-right')}>ใบคืน</th>
                  <th className={clsx(thCls, 'text-right')}>รายการ</th>
                  <th className={clsx(thCls, 'text-right')}>จำนวนสุทธิ</th>
                  <th className={clsx(thCls, 'text-right')}>มูลค่าสุทธิ</th>
                  <th className={clsx(thCls, 'text-right')}>ยอดที่ยกเลิก (162/123)</th>
                </tr>
              </thead>
              <tbody>
                {summaryLoading && !summary ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-[#6A6D70]"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>
                ) : !summary || summary.rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-[#6A6D70]">ไม่พบข้อมูล</td></tr>
                ) : summary.rows.map(r => (
                  <tr
                    key={r.key ?? '-'}
                    onClick={() => drillDown(r.key)}
                    className="border-b border-[#EBEBEB] hover:bg-[#F5FAFF] cursor-pointer"
                  >
                    <td className={tdCls}>
                      {group === 'month' ? monthLabel(r.key)
                        : group === 'reason' ? (r.key === '-' ? <span className="text-[#6A6D70]">(ไม่ระบุ)</span> : r.key)
                        : (
                          <span className="font-mono text-[10px] text-[#0064D9]">
                            {r.key ?? '—'}{r.extra && <span className="text-[#6A6D70]"> · {r.extra}</span>}
                          </span>
                        )}
                    </td>
                    {groupDef.labelHeader && <td className={tdCls}>{r.label ?? '—'}</td>}
                    <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{fmtNum(r.docs)}</td>
                    <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{fmtNum(r.lines)}</td>
                    <td className={clsx(tdCls, 'text-right font-mono tabular-nums', (toNum(r.qty) ?? 0) < 0 && 'text-[#BB0000]')}>{fmtNum(r.qty)}</td>
                    <td className={clsx(tdCls, 'text-right font-mono tabular-nums font-semibold', (toNum(r.amount) ?? 0) < 0 && 'text-[#BB0000]')}>{fmtNum(r.amount, 2)}</td>
                    <td className={clsx(tdCls, 'text-right font-mono tabular-nums text-[#6A6D70]')}>{toNum(r.cancelled_amount) ? fmtNum(r.cancelled_amount, 2) : dash}</td>
                  </tr>
                ))}
              </tbody>
              {summary && summary.rows.length > 0 && (
                <tfoot>
                  <tr className="bg-[#F2F4F7] border-t-2 border-[#D9D9D9] font-semibold">
                    <td className={tdCls} colSpan={groupDef.labelHeader ? 2 : 1}><span className="text-[10px] uppercase text-[#6A6D70]">รวมทั้งหมด</span></td>
                    <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{fmtNum(summary.totals.docs)}</td>
                    <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{fmtNum(summary.totals.lines)}</td>
                    <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{fmtNum(summary.totals.qty)}</td>
                    <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{fmtNum(summary.totals.amount, 2)}</td>
                    <td className={tdCls} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      <PdfViewer
        open={viewDocId != null}
        onClose={() => setViewDocId(null)}
        title={viewingRow ? `ใบคืนสินค้า ${viewingRow.article_doc_no ?? ''}` : 'ใบคืนสินค้า'}
        subtitle={viewingRow ? [fmtDate(viewingRow.doc_date), viewingRow.site_code].filter(Boolean).join(' · ') : undefined}
        src={viewUrlError ? null : viewUrl ?? null}
        loading={viewUrlLoading}
        onDownload={viewDocId != null ? () => downloadPdf(viewDocId) : undefined}
        nav={viewIndex >= 0 ? {
          index: viewIndex,
          total: docIds.length,
          onPrev: () => viewIndex > 0 && setViewDocId(docIds[viewIndex - 1]),
          onNext: () => viewIndex < docIds.length - 1 && setViewDocId(docIds[viewIndex + 1]),
        } : undefined}
      />
    </div>
  )
}
