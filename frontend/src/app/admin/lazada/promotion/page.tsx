'use client'

import api from '@/lib/api'
import {
  LazadaSvcTransaction, LazadaSvcSummary, LazadaSvcOptions, LazadaShop, PaginatedResponse,
} from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Download, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import * as XLSX from 'xlsx'
import {
  fmtAmt, TH, TD, AmountCell, StatusBadge, SapInput, inputCls, ErpNoAccess, ErpPagination,
} from '@/components/erp'

type SvcResponse = PaginatedResponse<LazadaSvcTransaction> & { summary: LazadaSvcSummary }

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

const num = (v: string | number | null) => (v == null || v === '' ? null : Number(v))

// ── Constants ─────────────────────────────────────────────────────────────────

// Display order for the KPI strip; unknown operations are appended after these
const OPERATION_ORDER = ['เติมเงิน', 'การหักเงิน', 'คืนเงิน', 'การปรับ-หัก']

const OPERATION_COLORS: Record<string, string> = {
  'เติมเงิน':     'bg-[#EBF5FE] text-[#0064D9] border-[#0070F2]/40',
  'การหักเงิน':   'bg-[#FFF5F5] text-[#BB0000] border-[#BB0000]/40',
  'คืนเงิน':      'bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40',
  'การปรับ-หัก':  'bg-[#FEF9F0] text-[#E9730C] border-[#E9730C]/40',
}

// ── KPI strip ─────────────────────────────────────────────────────────────────

function SummaryStrip({ summary, loading }: { summary?: LazadaSvcSummary; loading: boolean }) {
  const rows = [...(summary?.by_operation ?? [])].sort((a, b) => {
    const ia = OPERATION_ORDER.indexOf(a.operation ?? ''), ib = OPERATION_ORDER.indexOf(b.operation ?? '')
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
  const net = summary?.net ?? 0

  return (
    <div className="bg-white border-x border-b border-[#D9D9D9] grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-[#EBEBEB]">
      {loading
        ? [...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-3 space-y-2">
              <div className="h-2.5 w-16 bg-[#F2F4F7] rounded animate-pulse" />
              <div className="h-5 w-24 bg-[#F2F4F7] rounded animate-pulse" />
            </div>
          ))
        : (
          <>
            {rows.map(r => {
              const amt = num(r.amount) ?? 0
              return (
                <div key={r.operation ?? '-'} className="px-4 py-3">
                  <p className="text-[10px] text-[#6A6D70] uppercase tracking-wide">{r.operation ?? '—'}</p>
                  <p className={`text-lg font-semibold tabular-nums leading-tight ${amt < 0 ? 'text-[#BB0000]' : 'text-[#32363A]'}`}>
                    {fmtAmt(amt)}
                  </p>
                  <p className="text-[10px] text-[#6A6D70]">{Number(r.count).toLocaleString('th-TH')} รายการ</p>
                </div>
              )
            })}
            <div className="px-4 py-3 bg-[#F9FAFB]">
              <p className="text-[10px] text-[#6A6D70] uppercase tracking-wide font-semibold">ยอดสุทธิ</p>
              <p className={`text-lg font-bold tabular-nums leading-tight ${net < 0 ? 'text-[#BB0000]' : 'text-[#107E3E]'}`}>
                {fmtAmt(net)}
              </p>
              <p className="text-[10px] text-[#6A6D70]">THB</p>
            </div>
          </>
        )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function LazadaPromotionContent() {
  const { can } = useAuth()
  const searchParams = useSearchParams()

  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(1)
  const [sellerKey, setSellerKey] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [operation, setOperation] = useState('')
  const [program, setProgram]     = useState('')
  const [objective, setObjective] = useState('')
  const [fileId, setFileId]       = useState(searchParams.get('file_id') ?? '')
  const [showAdv, setShowAdv]     = useState(false)
  const [exporting, setExporting] = useState(false)

  const filterParams = {
    search: search || undefined,
    seller_key: sellerKey || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    operation: operation || undefined,
    program: program || undefined,
    objective: objective || undefined,
    export_file_id: fileId || undefined,
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: shopsData } = useQuery<PaginatedResponse<LazadaShop>>({
    queryKey: ['lazada-shops-all'],
    queryFn: () => api.get('/lazada/shops', { params: { per_page: 100, is_active: true } }).then(r => r.data),
    enabled: can('lazada-promotion.view'),
  })

  const { data: options } = useQuery<LazadaSvcOptions>({
    queryKey: ['lazada-svc-options'],
    queryFn: () => api.get('/lazada/svc-options').then(r => r.data),
    enabled: can('lazada-promotion.view'),
  })

  const { data, isLoading } = useQuery<SvcResponse>({
    queryKey: ['lazada-svc-transactions', page, filterParams],
    queryFn: () => api.get('/lazada/svc-transactions', { params: { ...filterParams, page, per_page: 50 } }).then(r => r.data),
    enabled: can('lazada-promotion.view'),
  })

  // ── Export ────────────────────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get<SvcResponse>('/lazada/svc-transactions', { params: { ...filterParams, per_page: 50000 } })
      const rows = res.data?.data ?? []
      if (rows.length === 0) { alert('ไม่พบข้อมูลสำหรับส่งออก'); return }
      const sheet = rows.map(t => ({
        'Credit Transaction Time': fmtDateTime(t.credit_transaction_time),
        'Order Create Time':       fmtDateTime(t.order_create_time),
        'ร้านค้า':                 t.shop_name ?? t.seller_key,
        'Seller Key':              t.seller_key,
        'Statement Id':            t.statement_id,
        'Business Type':           t.business_type ?? '',
        'Operation':               t.operation ?? '',
        'Amount':                  num(t.amount) ?? '',
        'Currency':                t.currency ?? '',
        'Program':                 t.program ?? '',
        'Objective':               t.objective ?? '',
        'Order Number':            t.order_number ?? '',
        'Order Line Id':           t.order_line_id ?? '',
        'Promotion Id':            t.promotion_id ?? '',
        'Remarks':                 t.remarks ?? '',
      }))
      const ws = XLSX.utils.json_to_sheet(sheet)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Promotion Tools')
      const filename = `lazada-promotion-tools-${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, filename)
      api.post('/audit-logs', {
        action: 'export', target_type: 'lazada-svc-transactions',
        target_id: 0, target_name: filename,
        payload: { row_count: rows.length },
      }).catch(() => {})
    } catch {
      alert('เกิดข้อผิดพลาดในการส่งออก')
    } finally { setExporting(false) }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  if (!can('lazada-promotion.view')) return <ErpNoAccess />

  const items = data?.data ?? []
  const shops = shopsData?.data ?? []

  function resetFilters() {
    setSearch(''); setSellerKey(''); setStartDate(''); setEndDate('')
    setOperation(''); setProgram(''); setObjective(''); setFileId(''); setPage(1)
  }

  const hasAdvFilter = !!(program || objective)
  const hasFilter    = !!(search || sellerKey || startDate || endDate || operation || fileId || hasAdvFilter)
  const colCount     = 10

  return (
    <div className="space-y-0 text-[#32363A]">

      {/* ══ Page Header ══════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#D9D9D9] px-4 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-[#6A6D70] uppercase tracking-wide">Lazada / เครื่องมือโปรโมทสินค้า</p>
          <h1 className="text-sm font-semibold text-[#32363A] leading-tight">รายการเครื่องมือโปรโมทสินค้า (Marketing Balance)</h1>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0070F2] hover:bg-[#0064D9] disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'กำลังส่งออก...' : 'Export Excel'}
        </button>
      </div>

      {/* ══ Filter Bar ═══════════════════════════════════════════════════════ */}
      <div className="bg-[#F9FAFB] border-x border-b border-[#D9D9D9] px-4 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-semibold text-[#6A6D70] uppercase tracking-wider">ตัวกรอง</span>
          <div className="flex items-center gap-1.5">
            {hasFilter && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#6A6D70] hover:text-[#32363A] border border-[#D9D9D9] rounded bg-white hover:bg-[#F5F5F5] transition-colors"
              >
                <X className="w-3 h-3" /> ล้างตัวกรอง
              </button>
            )}
            <button
              onClick={() => setShowAdv(v => !v)}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] border rounded transition-colors ${hasAdvFilter ? 'border-[#0070F2] text-[#0070F2] bg-[#EBF5FB]' : 'border-[#D9D9D9] text-[#6A6D70] bg-white hover:bg-[#F5F5F5]'}`}
            >
              ตัวกรองเพิ่มเติม
              {hasAdvFilter && <span className="w-1.5 h-1.5 rounded-full bg-[#0070F2] ml-0.5" />}
              {(showAdv || hasAdvFilter) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <SapInput label="ค้นหา">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6A6D70]" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Statement, เลขออเดอร์, Promotion ID..."
                className={`${inputCls} pl-7 w-60`}
              />
            </div>
          </SapInput>

          <SapInput label="ร้านค้า">
            <select
              value={sellerKey}
              onChange={e => { setSellerKey(e.target.value); setPage(1) }}
              className={`${inputCls} pr-7 min-w-[150px]`}
            >
              <option value="">ทั้งหมด</option>
              {shops.map(s => <option key={s.id} value={s.short_code}>{s.shop_name}</option>)}
            </select>
          </SapInput>

          <SapInput label="ประเภทรายการ (Operation)">
            <select
              value={operation}
              onChange={e => { setOperation(e.target.value); setPage(1) }}
              className={`${inputCls} pr-7 min-w-[130px]`}
            >
              <option value="">ทั้งหมด</option>
              {(options?.operations ?? []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </SapInput>

          <SapInput label="Credit Transaction Time (จาก — ถึง)">
            <div className={`flex items-center gap-1.5 px-2.5 h-8 border rounded bg-white transition-colors ${(startDate || endDate) ? 'border-[#0070F2] ring-1 ring-[#0070F2]/20' : 'border-[#D9D9D9]'}`}>
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setPage(1) }}
                className="border-0 bg-transparent text-xs text-[#32363A] focus:outline-none w-32"
              />
              <span className="text-[#D9D9D9] text-xs">—</span>
              <input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setPage(1) }}
                className="border-0 bg-transparent text-xs text-[#32363A] focus:outline-none w-32"
              />
            </div>
          </SapInput>

          {fileId && (
            <span className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs border border-[#0070F2] text-[#0070F2] bg-[#EBF5FB] rounded">
              ไฟล์ #{fileId}
              <button onClick={() => { setFileId(''); setPage(1) }} className="hover:text-[#0064D9]" title="ล้างตัวกรองไฟล์">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>

        {(showAdv || hasAdvFilter) && (
          <div className="flex flex-wrap gap-3 items-end mt-3 pt-3 border-t border-[#EBEBEB]">
            <SapInput label="Program">
              <select
                value={program}
                onChange={e => { setProgram(e.target.value); setPage(1) }}
                className={`${inputCls} pr-7 min-w-[150px]`}
              >
                <option value="">ทั้งหมด</option>
                {(options?.programs ?? []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </SapInput>
            <SapInput label="Objective">
              <select
                value={objective}
                onChange={e => { setObjective(e.target.value); setPage(1) }}
                className={`${inputCls} pr-7 min-w-[170px]`}
              >
                <option value="">ทั้งหมด</option>
                {(options?.objectives ?? []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </SapInput>
          </div>
        )}
      </div>

      {/* ══ Summary ══════════════════════════════════════════════════════════ */}
      <SummaryStrip summary={data?.summary} loading={isLoading} />

      {/* ══ Data Table ════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#D9D9D9] border-t-0 overflow-x-auto mt-3">
        <table className="w-full text-xs border-collapse min-w-[1300px]">
          <thead>
            <tr className="bg-[#F2F4F7] border-b-2 border-[#0070F2]">
              <TH w="130px">Credit Tx Time</TH>
              <TH w="150px">ร้านค้า</TH>
              <TH w="110px" center>Operation</TH>
              <TH w="110px" right>Amount (฿)</TH>
              <TH w="120px">Business Type</TH>
              <TH w="150px">Program / Objective</TH>
              <TH w="140px">Order Number</TH>
              <TH w="140px">Promotion ID</TH>
              <TH w="130px">Statement ID</TH>
              <TH w="130px">Order Create Time</TH>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i} className="border-b border-[#EBEBEB]">
                  {[...Array(colCount)].map((_, j) => (
                    <td key={j} className="px-2.5 py-1.5 border-r border-[#EBEBEB]">
                      <div className="h-2.5 bg-[#F2F4F7] rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-5 py-12 text-center text-[#6A6D70] text-sm">
                  ไม่พบรายการที่ตรงกับเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              items.map(t => (
                <tr key={t.id} className="border-b border-[#EBEBEB] hover:bg-[#F9FAFB] transition-colors">
                  <TD><span className="text-[#6A6D70] whitespace-nowrap">{fmtDateTime(t.credit_transaction_time)}</span></TD>
                  <TD>
                    <p className="font-semibold truncate max-w-[150px]" title={t.shop_name ?? ''}>{t.shop_name ?? '—'}</p>
                    <span className="text-[10px] text-[#6A6D70] font-mono">{t.seller_key}</span>
                  </TD>
                  <TD center><StatusBadge value={t.operation} colorMap={OPERATION_COLORS} /></TD>
                  <TD right><AmountCell value={num(t.amount)} /></TD>
                  <TD><span className="text-[#6A6D70]">{t.business_type ?? '—'}</span></TD>
                  <TD>
                    <p className="font-mono text-[10px]">{t.program ?? '—'}</p>
                    {t.objective && t.objective !== t.program && (
                      <p className="font-mono text-[10px] text-[#6A6D70]">{t.objective}</p>
                    )}
                  </TD>
                  <TD>
                    <p className="font-mono text-[10px] text-[#0064D9]">{t.order_number ?? '—'}</p>
                    {t.order_line_id && <p className="font-mono text-[10px] text-[#6A6D70]">Line {t.order_line_id}</p>}
                  </TD>
                  <TD><span className="font-mono text-[10px]">{t.promotion_id ?? '—'}</span></TD>
                  <TD><span className="font-mono text-[10px] text-[#6A6D70]">{t.statement_id}</span></TD>
                  <TD><span className="text-[#6A6D70] whitespace-nowrap">{fmtDateTime(t.order_create_time)}</span></TD>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data && <ErpPagination data={data} page={page} setPage={setPage} />}
      </div>
    </div>
  )
}

export default function LazadaPromotionPage() {
  return (
    <Suspense>
      <LazadaPromotionContent />
    </Suspense>
  )
}
