'use client'

import api from '@/lib/api'
import { LazadaTransactionWork, LazadaShop, PaginatedResponse } from '@/lib/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import {
  Search, Lock, Download, CalendarCheck,
  ChevronDown, ChevronUp, X, CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import * as XLSX from 'xlsx'

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function fmtAmt(n: number | null) {
  if (n == null) return '—'
  const fmt = Math.abs(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `-${fmt}` : fmt
}

// ── Cell Components ───────────────────────────────────────────────────────────

function AmountCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[#D9D9D9]">—</span>
  return (
    <span className={`font-mono tabular-nums ${value < 0 ? 'text-[#BB0000]' : value > 0 ? 'text-[#107E3E]' : 'text-[#6A6D70]'}`}>
      {fmtAmt(value)}
    </span>
  )
}

function StatusBadge({ value, colorMap }: { value: string | null; colorMap: Record<string, string> }) {
  if (!value) return <span className="text-[#D9D9D9]">—</span>
  const cls = colorMap[value] ?? 'bg-[#F5F5F5] text-[#6A6D70] border-[#D9D9D9]'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold border rounded-sm ${cls}`}>
      {value}
    </span>
  )
}

function TransferDateCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-[#D9D9D9]">—</span>
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-[#EBF5FB] text-[#0070F2] border border-[#0070F2]/30 rounded-sm">
      <CalendarCheck className="w-2.5 h-2.5" />
      {fmtDate(value)}
    </span>
  )
}

// ── Table Primitives ──────────────────────────────────────────────────────────

function TH({ children, right, center, w }: {
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

function TD({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) {
  return (
    <td className={`px-2.5 py-1.5 text-xs text-[#32363A] border-r border-[#EBEBEB] last:border-r-0 ${right ? 'text-right' : center ? 'text-center' : ''}`}>
      {children}
    </td>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAID_STATUS_COLORS: Record<string, string> = {
  Paid:   'bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40',
  paid:   'bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40',
  Unpaid: 'bg-[#FEF9F0] text-[#E9730C] border-[#E9730C]/40',
  Failed: 'bg-[#FFF5F5] text-[#BB0000] border-[#BB0000]/40',
}
const SOURCE_COLORS: Record<string, string> = {
  openapi: 'bg-[#EBF5FB] text-[#0064D9] border-[#0064D9]/30',
  file:    'bg-[#F5F5F5] text-[#6A6D70] border-[#D9D9D9]',
}

const PAID_STATUS_OPTIONS = ['Paid', 'Unpaid', 'Failed']
const SOURCE_OPTIONS      = ['openapi', 'file']

// ── SAP Input/Button Primitives ───────────────────────────────────────────────

function SapInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] text-[#6A6D70] uppercase tracking-wide font-medium whitespace-nowrap">{label}</span>
      {children}
    </div>
  )
}

const inputCls = 'h-8 border border-[#D9D9D9] rounded text-sm text-[#32363A] bg-white px-2.5 focus:outline-none focus:border-[#0070F2] focus:ring-1 focus:ring-[#0070F2]/20'

// ─────────────────────────────────────────────────────────────────────────────

export default function LazadaTransactionsWorkPage() {
  const { can } = useAuth()
  const qc = useQueryClient()

  // Filters
  const [search, setSearch]               = useState('')
  const [page, setPage]                   = useState(1)
  const [shopName, setShopName]           = useState('')
  const [startDate, setStartDate]         = useState('')
  const [endDate, setEndDate]             = useState('')
  const [txType, setTxType]               = useState('')
  const [paidStatus, setPaidStatus]       = useState('')
  const [source, setSource]               = useState('')
  const [transferStatus, setTransferStatus] = useState('')   // 'transferred' | 'not_transferred' | ''
  const [transferredStart, setTransferredStart] = useState('')
  const [transferredEnd, setTransferredEnd]     = useState('')
  const [showAdv, setShowAdv]             = useState(false)
  // auto-expand when transfer filters are set
  const hasTransferFilter = !!(transferStatus || transferredStart || transferredEnd)

  // Bulk state
  const [selectedIds, setSelectedIds]         = useState<Set<number>>(new Set())
  const [allFilterSelected, setAllFilterSelected] = useState(false)
  const [fetchingAllIds, setFetchingAllIds]   = useState(false)
  const [transferDate, setTransferDate]       = useState('')
  const [updating, setUpdating]               = useState(false)
  const [exporting, setExporting]             = useState(false)

  const checkboxMode = !!(startDate && endDate)

  useEffect(() => {
    setSelectedIds(new Set()); setAllFilterSelected(false)
  }, [startDate, endDate, search, shopName, txType, paidStatus, source, transferStatus, transferredStart, transferredEnd, page])

  useEffect(() => {
    if (!checkboxMode) { setSelectedIds(new Set()); setAllFilterSelected(false) }
  }, [checkboxMode])

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: shopsData } = useQuery<PaginatedResponse<LazadaShop>>({
    queryKey: ['lazada-shops-all'],
    queryFn: () => api.get('/lazada/shops', { params: { per_page: 100, is_active: true } }).then(r => r.data),
    enabled: can('lazada-shops.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<LazadaTransactionWork>>({
    queryKey: ['lazada-transactions-work', search, page, shopName, startDate, endDate, txType, paidStatus, source, transferStatus, transferredStart, transferredEnd],
    queryFn: () => api.get('/lazada/transactions-work', {
      params: {
        search: search || undefined, page, per_page: 50,
        shop_name: shopName || undefined,
        start_date: startDate || undefined, end_date: endDate || undefined,
        transaction_type: txType || undefined,
        paid_status: paidStatus || undefined, source: source || undefined,
        transfer_status: transferStatus || undefined,
        transferred_start: transferredStart || undefined,
        transferred_end: transferredEnd || undefined,
      },
    }).then(r => r.data),
    enabled: can('lazada-shops.view'),
  })

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleSelectAllFiltered() {
    setFetchingAllIds(true)
    try {
      const res = await api.get('/lazada/transactions-work/ids', {
        params: {
          search: search || undefined, shop_name: shopName || undefined,
          start_date: startDate || undefined, end_date: endDate || undefined,
          transaction_type: txType || undefined,
          paid_status: paidStatus || undefined, source: source || undefined,
          transfer_status: transferStatus || undefined,
          transferred_start: transferredStart || undefined,
          transferred_end: transferredEnd || undefined,
        },
      })
      setSelectedIds(new Set(res.data.ids as number[]))
      setAllFilterSelected(true)
    } catch {
      alert('เกิดข้อผิดพลาดในการโหลด IDs')
    } finally { setFetchingAllIds(false) }
  }

  async function handleBulkTransfer(date: string | null) {
    if (selectedIds.size === 0) return
    setUpdating(true)
    try {
      await api.patch('/lazada/transactions-work/bulk-transfer', {
        ids: Array.from(selectedIds),
        transferred_at: date,
        start_date: startDate || null,
        end_date: endDate || null,
      })
      setSelectedIds(new Set()); setAllFilterSelected(false); setTransferDate('')
      qc.invalidateQueries({ queryKey: ['lazada-transactions-work'] })
    } catch {
      alert('เกิดข้อผิดพลาด')
    } finally { setUpdating(false) }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get('/lazada/transactions-work', {
        params: {
          search: search || undefined, per_page: 50000,
          shop_name: shopName || undefined,
          start_date: startDate || undefined, end_date: endDate || undefined,
          transaction_type: txType || undefined,
          paid_status: paidStatus || undefined, source: source || undefined,
          transfer_status: transferStatus || undefined,
          transferred_start: transferredStart || undefined,
          transferred_end: transferredEnd || undefined,
        },
      })
      const fetchItems = res.data?.data ?? []
      if (fetchItems.length === 0) { alert('ไม่พบข้อมูลสำหรับส่งออก'); return }
      const rows = fetchItems.map((item: LazadaTransactionWork) => ({
        'Transaction Date': fmtDate(item.transaction_date),
        'วันที่โอน':       fmtDate(item.transferred_at),
        'ร้านค้า':         item.shop_name ?? '',
        'Transaction Type': item.transaction_type ?? '',
        'Fee Name':         item.fee_name ?? '',
        'Transaction Number': item.transaction_number ?? '',
        'Details':          item.details ?? '',
        'Seller SKU':       item.seller_sku ?? '',
        'Lazada SKU':       item.lazada_sku ?? '',
        'Amount':           item.amount ?? '',
        'VAT in Amount':    item.vat_in_amount ?? '',
        'WHT Amount':       item.wht_amount ?? '',
        'WHT included':     item.wht_included_in_amount ?? '',
        'Statement':        item.statement ?? '',
        'Paid Status':      item.paid_status ?? '',
        'Order No.':        item.order_no ?? '',
        'Order Item No.':   item.order_item_no ?? '',
        'Order Item Status': item.order_item_status ?? '',
        'Shipping Provider': item.shipping_provider ?? '',
        'Shipping Speed':   item.shipping_speed ?? '',
        'Shipment Type':    item.shipment_type ?? '',
        'Reference':        item.reference ?? '',
        'Comment':          item.comment ?? '',
        'PaymentRefId':     item.payment_ref_id ?? '',
        'ShortCode':        item.short_code ?? '',
        'Source':           item.source ?? '',
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions Work')
      const filename = `lazada-transactions-work-${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, filename)
      api.post('/audit-logs', {
        action: 'export', target_type: 'lazada-transactions-work',
        target_id: 0, target_name: filename,
        payload: { row_count: fetchItems.length },
      }).catch(() => {})
    } catch {
      alert('เกิดข้อผิดพลาดในการส่งออก')
    } finally { setExporting(false) }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  if (!can('lazada-shops.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#6A6D70]">
        <Lock className="w-10 h-10 mb-3 text-[#D9D9D9]" />
        <p className="text-sm font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const items   = data?.data ?? []
  const shops   = shopsData?.data ?? []
  const allPageIds      = items.map(i => i.id)
  const selectedOnPage  = allPageIds.filter(id => selectedIds.has(id))
  const allOnPageSel    = allPageIds.length > 0 && selectedOnPage.length === allPageIds.length
  const someOnPageSel   = selectedOnPage.length > 0 && !allOnPageSel

  function toggleAll() {
    setAllFilterSelected(false)
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allOnPageSel) allPageIds.forEach(id => next.delete(id))
      else allPageIds.forEach(id => next.add(id))
      return next
    })
  }
  function toggleOne(id: number) {
    setAllFilterSelected(false)
    setSelectedIds(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
  }
  function resetFilters() {
    setSearch(''); setShopName(''); setStartDate(''); setEndDate('')
    setTxType(''); setPaidStatus(''); setSource('')
    setTransferStatus(''); setTransferredStart(''); setTransferredEnd('')
    setPage(1)
  }

  const hasFilter    = !!(search || shopName || startDate || endDate || txType || paidStatus || source || transferStatus || transferredStart || transferredEnd)
  const hasAdvFilter = !!(txType || paidStatus || source || transferStatus || transferredStart || transferredEnd)
  const colCount    = 26 + (checkboxMode ? 1 : 0)

  return (
    <div className="space-y-0 text-[#32363A]">

      {/* ══ Page Header ══════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#D9D9D9] px-4 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-[#6A6D70] uppercase tracking-wide">Lazada / รายการธุรกรรม</p>
          <h1 className="text-sm font-semibold text-[#32363A] leading-tight">จัดการรายการธุรกรรม Lazada</h1>
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
        {/* Filter header row */}
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
              {(showAdv || hasTransferFilter) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Primary filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <SapInput label="ค้นหา">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6A6D70]" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="หมายเลขธุรกรรม, เลขออเดอร์..."
                className={`${inputCls} pl-7 w-56`}
              />
            </div>
          </SapInput>

          <SapInput label="ร้านค้า">
            <select
              value={shopName}
              onChange={e => { setShopName(e.target.value); setPage(1) }}
              className={`${inputCls} pr-7 min-w-[150px]`}
            >
              <option value="">ทั้งหมด</option>
              {shops.map(s => <option key={s.id} value={s.shop_name}>{s.shop_name}</option>)}
            </select>
          </SapInput>

          <SapInput label="Transaction Date (จาก — ถึง)">
            <div className={`flex items-center gap-1.5 px-2.5 h-8 border rounded bg-white transition-colors ${checkboxMode ? 'border-[#0070F2] ring-1 ring-[#0070F2]/20' : 'border-[#D9D9D9]'}`}>
              <CalendarCheck className={`w-3.5 h-3.5 shrink-0 ${checkboxMode ? 'text-[#0070F2]' : 'text-[#6A6D70]'}`} />
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
              {checkboxMode && (
                <span className="text-[9px] font-bold text-[#0070F2] bg-[#EBF5FB] px-1 py-0.5 rounded-sm whitespace-nowrap ml-1">
                  Transfer Mode
                </span>
              )}
            </div>
          </SapInput>
        </div>

        {/* Advanced filters */}
        {(showAdv || hasTransferFilter) && (
          <div className="flex flex-wrap gap-3 items-end mt-3 pt-3 border-t border-[#EBEBEB]">
            <SapInput label="ประเภทธุรกรรม">
              <input
                value={txType}
                onChange={e => { setTxType(e.target.value); setPage(1) }}
                placeholder="พิมพ์เพื่อค้นหา..."
                className={`${inputCls} w-44`}
              />
            </SapInput>
            <SapInput label="สถานะการชำระ">
              <select
                value={paidStatus}
                onChange={e => { setPaidStatus(e.target.value); setPage(1) }}
                className={`${inputCls} pr-7 min-w-[120px]`}
              >
                <option value="">ทั้งหมด</option>
                {PAID_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </SapInput>
            <SapInput label="Source">
              <select
                value={source}
                onChange={e => { setSource(e.target.value); setPage(1) }}
                className={`${inputCls} pr-7 min-w-[100px]`}
              >
                <option value="">ทั้งหมด</option>
                {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </SapInput>

            {/* Divider */}
            <div className="w-px self-stretch bg-[#EBEBEB] mx-1" />

            {/* Transfer status */}
            <SapInput label="สถานะการโอน">
              <select
                value={transferStatus}
                onChange={e => { setTransferStatus(e.target.value); setPage(1) }}
                className={`${inputCls} pr-7 min-w-[130px] ${transferStatus ? 'border-[#0070F2] bg-[#EBF5FB]' : ''}`}
              >
                <option value="">ทั้งหมด</option>
                <option value="transferred">โอนแล้ว</option>
                <option value="not_transferred">ยังไม่โอน</option>
              </select>
            </SapInput>

            {/* Transfer date range */}
            <SapInput label="วันที่โอน (จาก — ถึง)">
              <div className={`flex items-center gap-1.5 px-2.5 h-8 border rounded bg-white transition-colors ${(transferredStart || transferredEnd) ? 'border-[#0070F2] ring-1 ring-[#0070F2]/20 bg-[#EBF5FB]' : 'border-[#D9D9D9]'}`}>
                <CalendarCheck className={`w-3.5 h-3.5 shrink-0 ${(transferredStart || transferredEnd) ? 'text-[#0070F2]' : 'text-[#6A6D70]'}`} />
                <input
                  type="date"
                  value={transferredStart}
                  onChange={e => { setTransferredStart(e.target.value); setPage(1) }}
                  className="border-0 bg-transparent text-xs text-[#32363A] focus:outline-none w-32"
                />
                <span className="text-[#D9D9D9] text-xs">—</span>
                <input
                  type="date"
                  value={transferredEnd}
                  onChange={e => { setTransferredEnd(e.target.value); setPage(1) }}
                  className="border-0 bg-transparent text-xs text-[#32363A] focus:outline-none w-32"
                />
              </div>
            </SapInput>
          </div>
        )}
      </div>

      {/* ══ Select-All Banner ═════════════════════════════════════════════════ */}
      {checkboxMode && allOnPageSel && !allFilterSelected && data && data.total > items.length && (
        <div className="flex items-center gap-2 bg-[#EBF5FB] border-x border-b border-[#0070F2]/30 px-4 py-2 text-xs text-[#0064D9]">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#0070F2] shrink-0" />
          <span>เลือกครบ {items.length} รายการในหน้านี้แล้ว ·</span>
          <button
            onClick={handleSelectAllFiltered}
            disabled={fetchingAllIds}
            className="underline font-semibold hover:no-underline disabled:opacity-60"
          >
            {fetchingAllIds ? 'กำลังโหลด...' : `เลือกทั้งหมด ${data.total.toLocaleString('th-TH')} รายการในตัวกรองนี้`}
          </button>
        </div>
      )}
      {checkboxMode && allFilterSelected && selectedIds.size > 0 && (
        <div className="flex items-center gap-2 bg-[#EBF5FB] border-x border-b border-[#0070F2]/30 px-4 py-2 text-xs text-[#0064D9]">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#0070F2] shrink-0" />
          <span className="font-semibold">เลือกทั้งหมด {selectedIds.size.toLocaleString('th-TH')} รายการในตัวกรองนี้แล้ว ·</span>
          <button onClick={() => { setSelectedIds(new Set()); setAllFilterSelected(false) }} className="underline hover:no-underline">
            ยกเลิก
          </button>
        </div>
      )}

      {/* ══ Table Toolbar ═════════════════════════════════════════════════════ */}
      <div className="bg-white border-x border-b border-[#D9D9D9] px-3 py-2 flex items-center gap-3 min-h-[44px]">

        {/* Left: selection status + actions */}
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {checkboxMode ? (
            selectedIds.size > 0 ? (
              <>
                <span className="text-xs font-semibold text-[#0070F2] bg-[#EBF5FB] border border-[#0070F2]/30 px-2 py-1 rounded-sm">
                  {selectedIds.size.toLocaleString('th-TH')} รายการที่เลือก
                </span>
                <div className="w-px h-5 bg-[#D9D9D9]" />
                <input
                  type="date"
                  value={transferDate}
                  onChange={e => setTransferDate(e.target.value)}
                  className="h-7 border border-[#D9D9D9] rounded text-xs px-2 text-[#32363A] focus:outline-none focus:border-[#0070F2]"
                />
                <button
                  onClick={() => handleBulkTransfer(transferDate)}
                  disabled={!transferDate || updating}
                  className="flex items-center gap-1 h-7 px-3 bg-[#0070F2] hover:bg-[#0064D9] disabled:opacity-40 text-white text-xs font-semibold rounded transition-colors"
                >
                  <CalendarCheck className="w-3 h-3" />
                  {updating ? 'กำลังอัพเดท...' : 'อัพเดทวันที่โอน'}
                </button>
                <button
                  onClick={() => { if (confirm(`ล้างวันที่โอนของ ${selectedIds.size} รายการที่เลือก?`)) handleBulkTransfer(null) }}
                  disabled={updating}
                  className="h-7 px-3 border border-[#D9D9D9] hover:bg-[#F5F5F5] disabled:opacity-40 text-xs text-[#32363A] rounded transition-colors"
                >
                  ล้างวันที่โอน
                </button>
                <button
                  onClick={() => { setSelectedIds(new Set()); setAllFilterSelected(false) }}
                  className="flex items-center gap-1 h-7 px-2 text-xs text-[#6A6D70] hover:text-[#32363A] transition-colors"
                >
                  <X className="w-3 h-3" /> ยกเลิกการเลือก
                </button>
              </>
            ) : (
              <span className="text-xs text-[#6A6D70]">
                เลือก 0 รายการ · คลิกแถวหรือ ✓ เพื่อเลือก
              </span>
            )
          ) : (
            <span className="text-xs text-[#6A6D70]">
              เลือก <strong className="text-[#0070F2]">ช่วงวันที่ Transaction Date</strong> เพื่อเปิดใช้งาน Transfer Mode
            </span>
          )}
        </div>

        {/* Right: record count */}
        <span className="text-xs text-[#6A6D70] whitespace-nowrap shrink-0">
          {isLoading ? '...' : `${data?.total?.toLocaleString('th-TH') ?? 0} รายการ`}
        </span>
      </div>

      {/* ══ Data Table ════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#D9D9D9] border-t-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: checkboxMode ? '2940px' : '2900px' }}>
          <thead>
            <tr className="bg-[#F2F4F7] border-b-2 border-[#0070F2]">
              {checkboxMode && (
                <th className="w-9 px-2.5 py-2 border-r border-[#D9D9D9]">
                  <HeaderCheckbox checked={allOnPageSel} indeterminate={someOnPageSel} onChange={toggleAll} />
                </th>
              )}
              <TH w="90px">Tx Date</TH>
              <TH w="110px">วันที่โอน</TH>
              <TH w="130px">ร้านค้า</TH>
              <TH w="160px">Transaction Type</TH>
              <TH w="140px">Fee Name</TH>
              <TH w="140px">Transaction Number</TH>
              <TH w="200px">Details</TH>
              <TH w="100px">Seller SKU</TH>
              <TH w="100px">Lazada SKU</TH>
              <TH w="90px" right>Amount</TH>
              <TH w="90px" right>VAT</TH>
              <TH w="80px" right>WHT</TH>
              <TH w="60px" center>WHT Inc.</TH>
              <TH w="160px">Statement</TH>
              <TH w="80px" center>Paid</TH>
              <TH w="120px">Order No.</TH>
              <TH w="110px">Order Item No.</TH>
              <TH w="120px">Item Status</TH>
              <TH w="120px">Shipping Provider</TH>
              <TH w="90px">Speed</TH>
              <TH w="90px">Shipment</TH>
              <TH w="110px">Reference</TH>
              <TH w="160px">Comment</TH>
              <TH w="120px">PaymentRefId</TH>
              <TH w="80px">ShortCode</TH>
              <TH w="70px" center>Source</TH>
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
              items.map(item => {
                const isSel = selectedIds.has(item.id)
                return (
                  <tr
                    key={item.id}
                    onClick={checkboxMode ? () => toggleOne(item.id) : undefined}
                    className={`border-b border-[#EBEBEB] transition-colors ${
                      isSel
                        ? 'bg-[#D1E8FF]'
                        : checkboxMode
                          ? 'hover:bg-[#EBF5FB] cursor-pointer'
                          : 'hover:bg-[#F9FAFB]'
                    }`}
                  >
                    {checkboxMode && (
                      <td className="px-2.5 py-1.5 text-center border-r border-[#EBEBEB]">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleOne(item.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-3.5 h-3.5 rounded-sm border-[#D9D9D9] text-[#0070F2] focus:ring-[#0070F2]"
                        />
                      </td>
                    )}
                    <TD><span className="text-[#6A6D70]">{fmtDate(item.transaction_date)}</span></TD>
                    <TD><TransferDateCell value={item.transferred_at} /></TD>
                    <TD><span className="font-semibold text-[#32363A]">{item.shop_name}</span></TD>
                    <TD><span className="max-w-[160px] truncate block" title={item.transaction_type ?? ''}>{item.transaction_type ?? '—'}</span></TD>
                    <TD><span className="max-w-[140px] truncate block text-[#6A6D70]" title={item.fee_name ?? ''}>{item.fee_name ?? '—'}</span></TD>
                    <TD><span className="font-mono text-[#0064D9] text-[10px]">{item.transaction_number ?? '—'}</span></TD>
                    <TD><span className="max-w-[200px] truncate block text-[#6A6D70]" title={item.details ?? ''}>{item.details ?? '—'}</span></TD>
                    <TD><span className="font-mono text-[10px]">{item.seller_sku ?? '—'}</span></TD>
                    <TD><span className="font-mono text-[10px]">{item.lazada_sku ?? '—'}</span></TD>
                    <TD right><AmountCell value={item.amount} /></TD>
                    <TD right><AmountCell value={item.vat_in_amount} /></TD>
                    <TD right><AmountCell value={item.wht_amount} /></TD>
                    <TD center>
                      {item.wht_included_in_amount ? (
                        <span className={`text-[10px] font-semibold ${item.wht_included_in_amount.toLowerCase() === 'yes' ? 'text-[#0070F2]' : 'text-[#6A6D70]'}`}>
                          {item.wht_included_in_amount}
                        </span>
                      ) : <span className="text-[#D9D9D9]">—</span>}
                    </TD>
                    <TD><span className="max-w-[160px] truncate block text-[#6A6D70]" title={item.statement ?? ''}>{item.statement ?? '—'}</span></TD>
                    <TD center><StatusBadge value={item.paid_status} colorMap={PAID_STATUS_COLORS} /></TD>
                    <TD><span className="font-mono text-[10px]">{item.order_no ?? '—'}</span></TD>
                    <TD><span className="font-mono text-[10px]">{item.order_item_no ?? '—'}</span></TD>
                    <TD><span className="text-[#6A6D70]">{item.order_item_status ?? '—'}</span></TD>
                    <TD><span className="text-[#6A6D70]">{item.shipping_provider ?? '—'}</span></TD>
                    <TD><span className="text-[#6A6D70]">{item.shipping_speed ?? '—'}</span></TD>
                    <TD><span className="text-[#6A6D70]">{item.shipment_type ?? '—'}</span></TD>
                    <TD><span className="font-mono text-[10px]">{item.reference ?? '—'}</span></TD>
                    <TD><span className="max-w-[160px] truncate block text-[#6A6D70]" title={item.comment ?? ''}>{item.comment ?? '—'}</span></TD>
                    <TD><span className="font-mono text-[10px]">{item.payment_ref_id ?? '—'}</span></TD>
                    <TD><span className="text-[#6A6D70]">{item.short_code ?? '—'}</span></TD>
                    <TD center><StatusBadge value={item.source} colorMap={SOURCE_COLORS} /></TD>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* ── Pagination ──────────────────────────────────────────────────── */}
        {data && (
          <div className="px-4 py-2.5 border-t border-[#D9D9D9] flex items-center justify-between bg-[#F9FAFB]">
            <span className="text-xs text-[#6A6D70]">
              {data.total > 0
                ? `แสดง ${((data.current_page - 1) * data.per_page) + 1}–${Math.min(data.current_page * data.per_page, data.total)} จาก ${data.total.toLocaleString('th-TH')} รายการ`
                : '0 รายการ'}
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
        )}
      </div>
    </div>
  )
}

function HeaderCheckbox({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate: boolean; onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-3.5 h-3.5 rounded-sm border-[#D9D9D9] text-[#0070F2] focus:ring-[#0070F2]"
    />
  )
}
