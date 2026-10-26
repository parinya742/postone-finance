'use client'

import api from '@/lib/api'
import { LazadaTransaction, LazadaShop, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Download, ChevronDown, ChevronUp, X, ChevronsUpDown, ArrowUp, ArrowDown, Columns3 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import * as XLSX from 'xlsx'
import {
  createColumnHelper, flexRender,
  getCoreRowModel, getSortedRowModel, useReactTable,
  type SortingState, type VisibilityState, type ColumnDef,
} from '@tanstack/react-table'
import { fmtDate, AmountCell, StatusBadge, SapInput, inputCls, ErpNoAccess, ErpPagination } from '@/components/erp'

// ── Constants ─────────────────────────────────────────────────────────────────

const PAID_STATUS_COLORS: Record<string, string> = {
  Paid:   'bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40',
  paid:   'bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40',
  Unpaid: 'bg-[#FEF9F0] text-[#E9730C] border-[#E9730C]/40',
  Failed: 'bg-[#FFF5F5] text-[#BB0000] border-[#BB0000]/40',
}

const PAID_STATUS_OPTIONS = ['Paid', 'Unpaid', 'Failed']

// ── Column helper ─────────────────────────────────────────────────────────────

const ch = createColumnHelper<LazadaTransaction>()
type ColMeta = { align?: 'left' | 'right' | 'center' }

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc')  return <ArrowUp className="w-3 h-3 text-[#0070F2] shrink-0" />
  if (sorted === 'desc') return <ArrowDown className="w-3 h-3 text-[#0070F2] shrink-0" />
  return <ChevronsUpDown className="w-3 h-3 text-[#C0C5CC] shrink-0" />
}

// ── Column definitions (module-level for stability) ───────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COLUMNS: ColumnDef<LazadaTransaction, any>[] = [
  ch.accessor('transaction_date', {
    header: 'Tx Date', size: 90,
    cell: i => <span className="text-[#6A6D70]">{fmtDate(i.getValue())}</span>,
  }),
  ch.accessor('shop_name', {
    header: 'ร้านค้า', size: 130,
    cell: i => <span className="font-semibold">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('transaction_type', {
    header: 'Transaction Type', size: 160,
    cell: i => <span className="max-w-[160px] truncate block" title={i.getValue() ?? ''}>{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('fee_name', {
    header: 'Fee Name', size: 140,
    cell: i => <span className="max-w-[140px] truncate block text-[#6A6D70]" title={i.getValue() ?? ''}>{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('transaction_number', {
    header: 'Transaction Number', size: 140,
    cell: i => <span className="font-mono text-[#0064D9] text-[10px]">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('details', {
    header: 'Details', size: 200,
    cell: i => <span className="max-w-[200px] truncate block text-[#6A6D70]" title={i.getValue() ?? ''}>{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('seller_sku', {
    header: 'Seller SKU', size: 100,
    cell: i => <span className="font-mono text-[10px]">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('lazada_sku', {
    header: 'Lazada SKU', size: 100,
    cell: i => <span className="font-mono text-[10px]">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('amount', {
    header: 'Amount', size: 90,
    meta: { align: 'right' } satisfies ColMeta,
    cell: i => <AmountCell value={i.getValue()} />,
  }),
  ch.accessor('vat_in_amount', {
    header: 'VAT', size: 90,
    meta: { align: 'right' } satisfies ColMeta,
    cell: i => <AmountCell value={i.getValue()} />,
  }),
  ch.accessor('wht_amount', {
    header: 'WHT', size: 80,
    meta: { align: 'right' } satisfies ColMeta,
    cell: i => <AmountCell value={i.getValue()} />,
  }),
  ch.accessor('wht_included_in_amount', {
    header: 'WHT Inc.', size: 60,
    meta: { align: 'center' } satisfies ColMeta,
    cell: i => {
      const v = i.getValue()
      if (!v) return <span className="text-[#D9D9D9]">—</span>
      return <span className={`text-[10px] font-semibold ${v.toLowerCase() === 'yes' ? 'text-[#0070F2]' : 'text-[#6A6D70]'}`}>{v}</span>
    },
  }),
  ch.accessor('statement', {
    header: 'Statement', size: 160,
    cell: i => <span className="max-w-[160px] truncate block text-[#6A6D70]" title={i.getValue() ?? ''}>{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('paid_status', {
    header: 'Paid', size: 80,
    meta: { align: 'center' } satisfies ColMeta,
    cell: i => <StatusBadge value={i.getValue()} colorMap={PAID_STATUS_COLORS} />,
  }),
  ch.accessor('order_no', {
    header: 'Order No.', size: 120,
    cell: i => <span className="font-mono text-[10px]">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('order_item_no', {
    header: 'Order Item No.', size: 110,
    cell: i => <span className="font-mono text-[10px]">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('order_item_status', {
    header: 'Item Status', size: 120,
    cell: i => <span className="text-[#6A6D70]">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('shipping_provider', {
    header: 'Shipping Provider', size: 120,
    cell: i => <span className="text-[#6A6D70]">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('shipping_speed', {
    header: 'Speed', size: 90,
    cell: i => <span className="text-[#6A6D70]">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('shipment_type', {
    header: 'Shipment', size: 90,
    cell: i => <span className="text-[#6A6D70]">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('reference', {
    header: 'Reference', size: 110,
    cell: i => <span className="font-mono text-[10px]">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('comment', {
    header: 'Comment', size: 160,
    cell: i => <span className="max-w-[160px] truncate block text-[#6A6D70]" title={i.getValue() ?? ''}>{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('payment_ref_id', {
    header: 'PaymentRefId', size: 120,
    cell: i => <span className="font-mono text-[10px]">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('short_code', {
    header: 'ShortCode', size: 80,
    cell: i => <span className="text-[#6A6D70]">{i.getValue() ?? '—'}</span>,
  }),
]

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

  const [sorting, setSorting]                   = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [showColMenu, setShowColMenu]           = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: shopsData } = useQuery<PaginatedResponse<LazadaShop>>({
    queryKey: ['lazada-shops-all'],
    queryFn: () => api.get('/lazada/shops', { params: { per_page: 100, is_active: true } }).then(r => r.data),
    enabled: can('lazada-transactions.view'),
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
    enabled: can('lazada-transactions.view'),
  })

  // ── Export ────────────────────────────────────────────────────────────────

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

  if (!can('lazada-transactions.view')) return <ErpNoAccess />

  const items = data?.data ?? []
  const shops = shopsData?.data ?? []

  function resetFilters() {
    setSearch(''); setShopName(''); setStartDate(''); setEndDate('')
    setTxType(''); setPaidStatus(''); setPage(1)
  }

  const hasFilter    = !!(search || shopName || startDate || endDate || txType || paidStatus)
  const hasAdvFilter = !!(txType || paidStatus)

  // ── Table instance ─────────────────────────────────────────────────────────

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo(() => COLUMNS, [])

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const visibleCount = table.getVisibleLeafColumns().length

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

        {(showAdv || hasAdvFilter) && (
          <div className="flex flex-wrap gap-3 items-end mt-3 pt-3 border-t border-[#EBEBEB]">
            <SapInput label="ประเภทธุรกรรม  (Transaction Type)">
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

      {/* ══ Table Toolbar ════════════════════════════════════════════════════ */}
      <div className="bg-white border-x border-b border-[#D9D9D9] px-3 py-2 flex items-center justify-between min-h-[36px]">
        <span className="text-xs text-[#6A6D70]">
          {isLoading ? '...' : `${data?.total?.toLocaleString('th-TH') ?? 0} รายการ`}
        </span>

        {/* Column visibility toggle */}
        <div className="relative" ref={colMenuRef}>
          <button
            onClick={() => setShowColMenu(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 border border-[#D9D9D9] rounded text-xs text-[#6A6D70] bg-white hover:bg-[#F5F5F5] transition-colors"
          >
            <Columns3 className="w-3.5 h-3.5" />
            คอลัมน์
            <ChevronDown className="w-3 h-3" />
          </button>
          {showColMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-[#D9D9D9] rounded shadow-lg z-20 py-1 min-w-[190px] max-h-80 overflow-y-auto">
              {table.getAllLeafColumns().map(col => (
                <label
                  key={col.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#32363A] hover:bg-[#F9FAFB] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={col.getToggleVisibilityHandler()}
                    className="w-3 h-3 accent-[#0070F2]"
                  />
                  {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                </label>
              ))}
              <div className="border-t border-[#EBEBEB] mt-1 pt-1 px-3 pb-0.5">
                <button
                  onClick={() => table.resetColumnVisibility()}
                  className="text-[11px] text-[#6A6D70] hover:text-[#0070F2] py-0.5 transition-colors"
                >
                  แสดงทั้งหมด
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ Data Table ════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#D9D9D9] border-t-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="bg-[#F2F4F7] border-b-2 border-[#0070F2]">
                {hg.headers.map(header => {
                  const meta    = header.column.columnDef.meta as ColMeta | undefined
                  const align   = meta?.align ?? 'left'
                  const sorted  = header.column.getIsSorted()
                  const canSort = header.column.getCanSort()
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.column.columnDef.size, minWidth: header.column.columnDef.size }}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={[
                        'px-2.5 py-2 text-[10px] font-semibold text-[#354A5E] uppercase tracking-wider whitespace-nowrap',
                        'border-r border-[#D9D9D9] last:border-r-0',
                        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
                        canSort ? 'cursor-pointer hover:bg-[#E8EDF3] select-none' : '',
                      ].join(' ')}
                    >
                      {header.isPlaceholder ? null : (
                        <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon sorted={sorted} />
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i} className="border-b border-[#EBEBEB]">
                  {[...Array(visibleCount)].map((_, j) => (
                    <td key={j} className="px-2.5 py-1.5 border-r border-[#EBEBEB]">
                      <div className="h-2.5 bg-[#F2F4F7] rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={visibleCount} className="px-5 py-12 text-center text-[#6A6D70] text-sm">
                  ไม่พบรายการที่ตรงกับเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="border-b border-[#EBEBEB] hover:bg-[#F9FAFB] transition-colors">
                  {row.getVisibleCells().map(cell => {
                    const meta  = cell.column.columnDef.meta as ColMeta | undefined
                    const align = meta?.align ?? 'left'
                    return (
                      <td
                        key={cell.id}
                        className={[
                          'px-2.5 py-1.5 text-xs text-[#32363A] border-r border-[#EBEBEB] last:border-r-0',
                          align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '',
                        ].join(' ')}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
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
