'use client'

import api from '@/lib/api'
import { LazadaTransaction, LazadaShop, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Lock, Download, ChevronDown, ChevronUp, X } from 'lucide-react'
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

const PAID_STATUS_OPTIONS = ['Paid', 'Unpaid', 'Failed']

// ── SAP Input Primitive ───────────────────────────────────────────────────────

function SapInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] text-[#6A6D70] uppercase tracking-wide font-medium whitespace-nowrap">{label}</span>
      {children}
    </div>
  )
}

const inputCls = 'h-8 border border-[#D9D9D9] rounded text-sm text-[#32363A] bg-white px-2.5 focus:outline-none focus:border-[#0070F2] focus:ring-1 focus:ring-[#0070F2]/20'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LazadaTransactionsPage() {
  const { can } = useAuth()

  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(1)
  const [shopName, setShopName]     = useState('')
  const [startDate, setStartDate]   = useState('')
  const [endDate, setEndDate]       = useState('')
  const [txType, setTxType]         = useState('')
  const [paidStatus, setPaidStatus] = useState('')
  const [showAdv, setShowAdv]       = useState(false)
  const [exporting, setExporting]   = useState(false)

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: shopsData } = useQuery<PaginatedResponse<LazadaShop>>({
    queryKey: ['lazada-shops-all'],
    queryFn: () => api.get('/lazada/shops', { params: { per_page: 100, is_active: true } }).then(r => r.data),
    enabled: can('lazada-shops.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<LazadaTransaction>>({
    queryKey: ['lazada-transactions', search, page, shopName, startDate, endDate, txType, paidStatus],
    queryFn: () => api.get('/lazada/transactions', {
      params: {
        search: search || undefined, page, per_page: 50,
        shop_name: shopName || undefined,
        start_date: startDate || undefined, end_date: endDate || undefined,
        transaction_type: txType || undefined,
        paid_status: paidStatus || undefined,
      },
    }).then(r => r.data),
    enabled: can('lazada-shops.view'),
  })

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get('/lazada/transactions', {
        params: {
          search: search || undefined, per_page: 50000,
          shop_name: shopName || undefined,
          start_date: startDate || undefined, end_date: endDate || undefined,
          transaction_type: txType || undefined,
          paid_status: paidStatus || undefined,
        },
      })
      const fetchItems = res.data?.data ?? []
      if (fetchItems.length === 0) { alert('ไม่พบข้อมูลสำหรับส่งออก'); return }
      const rows = fetchItems.map((item: LazadaTransaction) => ({
        'Transaction Date':          fmtDate(item.transaction_date),
        'ร้านค้า':                   item.shop_name ?? '',
        'Transaction Type':          item.transaction_type ?? '',
        'Fee Name':                  item.fee_name ?? '',
        'Transaction Number':        item.transaction_number ?? '',
        'Details':                   item.details ?? '',
        'Seller SKU':                item.seller_sku ?? '',
        'Lazada SKU':                item.lazada_sku ?? '',
        'Amount':                    item.amount ?? '',
        'VAT in Amount':             item.vat_in_amount ?? '',
        'WHT Amount':                item.wht_amount ?? '',
        'WHT included in Amount':    item.wht_included_in_amount ?? '',
        'Statement':                 item.statement ?? '',
        'Paid Status':               item.paid_status ?? '',
        'Order No.':                 item.order_no ?? '',
        'Order Item No.':            item.order_item_no ?? '',
        'Order Item Status':         item.order_item_status ?? '',
        'Shipping Provider':         item.shipping_provider ?? '',
        'Shipping Speed':            item.shipping_speed ?? '',
        'Shipment Type':             item.shipment_type ?? '',
        'Reference':                 item.reference ?? '',
        'Comment':                   item.comment ?? '',
        'PaymentRefId':              item.payment_ref_id ?? '',
        'ShortCode':                 item.short_code ?? '',
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
      const filename = `lazada-transactions-${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, filename)
      api.post('/audit-logs', {
        action: 'export', target_type: 'lazada-transactions',
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

  const items = data?.data ?? []
  const shops = shopsData?.data ?? []

  function resetFilters() {
    setSearch(''); setShopName(''); setStartDate(''); setEndDate('')
    setTxType(''); setPaidStatus(''); setPage(1)
  }

  const hasFilter    = !!(search || shopName || startDate || endDate || txType || paidStatus)
  const hasAdvFilter = !!(txType || paidStatus)

  return (
    <div className="space-y-0 text-[#32363A]">

      {/* ══ Page Header ══════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#D9D9D9] px-4 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-[#6A6D70] uppercase tracking-wide">Lazada / รายการธุรกรรม</p>
          <h1 className="text-sm font-semibold text-[#32363A] leading-tight">รายการธุรกรรม Lazada</h1>
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
        {/* Filter header */}
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
        </div>

        {/* Advanced filters */}
        {(showAdv || hasAdvFilter) && (
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
          </div>
        )}
      </div>

      {/* ══ Table Toolbar ═════════════════════════════════════════════════════ */}
      <div className="bg-white border-x border-b border-[#D9D9D9] px-3 py-2 flex items-center justify-end min-h-[36px]">
        <span className="text-xs text-[#6A6D70]">
          {isLoading ? '...' : `${data?.total?.toLocaleString('th-TH') ?? 0} รายการ`}
        </span>
      </div>

      {/* ══ Data Table ════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#D9D9D9] border-t-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: '2500px' }}>
          <thead>
            <tr className="bg-[#F2F4F7] border-b-2 border-[#0070F2]">
              <TH w="90px">Tx Date</TH>
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
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i} className="border-b border-[#EBEBEB]">
                  {[...Array(24)].map((_, j) => (
                    <td key={j} className="px-2.5 py-1.5 border-r border-[#EBEBEB]">
                      <div className="h-2.5 bg-[#F2F4F7] rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={24} className="px-5 py-12 text-center text-[#6A6D70] text-sm">
                  ไม่พบรายการที่ตรงกับเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              items.map(item => (
                <tr key={item.id} className="border-b border-[#EBEBEB] hover:bg-[#F9FAFB] transition-colors">
                  <TD><span className="text-[#6A6D70]">{fmtDate(item.transaction_date)}</span></TD>
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
                </tr>
              ))
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
