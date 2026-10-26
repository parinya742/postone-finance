'use client'

import api from '@/lib/api'
import { LazadaTransactionWork, LazadaShop, PaginatedResponse } from '@/lib/types'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Search, Download, CalendarCheck,
  ChevronDown, ChevronUp, X, CheckCircle2, RefreshCw, SlidersHorizontal,
  AlertTriangle, ShieldCheck, ChevronsUpDown, ArrowUp, ArrowDown,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import * as XLSX from 'xlsx'
import {
  createColumnHelper, flexRender,
  getCoreRowModel, getSortedRowModel, useReactTable,
  type SortingState, type VisibilityState, type ColumnDef,
} from '@tanstack/react-table'
import { fmtDate, AmountCell, StatusBadge, SapInput, inputCls, ErpNoAccess, ErpPagination } from '@/components/erp'

// ── Page-specific cell ────────────────────────────────────────────────────────

function TransferDateCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-[#D9D9D9]">—</span>
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-[#EBF5FB] text-[#0070F2] border border-[#0070F2]/30 rounded-sm">
      <CalendarCheck className="w-2.5 h-2.5" />
      {fmtDate(value)}
    </span>
  )
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc')  return <ArrowUp className="w-3 h-3 text-[#0070F2] shrink-0" />
  if (sorted === 'desc') return <ArrowDown className="w-3 h-3 text-[#0070F2] shrink-0" />
  return <ChevronsUpDown className="w-3 h-3 text-[#C0C5CC] shrink-0" />
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

// ── TanStack column helper ────────────────────────────────────────────────────

const ch = createColumnHelper<LazadaTransactionWork>()
type ColMeta = { align?: 'left' | 'right' | 'center' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COLUMNS: ColumnDef<LazadaTransactionWork, any>[] = [
  ch.accessor('transaction_date', {
    id: 'tx_date', header: 'Tx Date', size: 90,
    cell: i => <span className="text-[#6A6D70]">{fmtDate(i.getValue())}</span>,
  }),
  ch.accessor('transferred_at', {
    header: 'วันที่โอน', size: 110,
    cell: i => <TransferDateCell value={i.getValue()} />,
  }),
  ch.accessor('shop_name', {
    header: 'ร้านค้า', size: 130,
    cell: i => <span className="font-semibold text-[#32363A]">{i.getValue() ?? '—'}</span>,
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
    header: 'Tx Number', size: 140,
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
    id: 'wht_included', header: 'WHT Inc.', size: 60,
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
  ch.accessor('cust_code', {
    header: 'Cust Code', size: 100,
    cell: i => <span className="font-mono text-[10px] text-[#0064D9]">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('cust_billname', {
    header: 'Cust Name', size: 180,
    cell: i => <span className="max-w-[180px] truncate block" title={i.getValue() ?? ''}>{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('docuno', {
    header: 'Docuno', size: 120,
    cell: i => <span className="font-mono text-[10px] text-[#107E3E]">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('docudate', {
    header: 'Docudate', size: 90,
    cell: i => <span className="text-[#6A6D70]">{fmtDate(i.getValue())}</span>,
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
  ch.accessor('source', {
    header: 'Source', size: 70,
    meta: { align: 'center' } satisfies ColMeta,
    cell: i => <StatusBadge value={i.getValue()} colorMap={SOURCE_COLORS} />,
  }),
]

// ── Column Definitions for ColumnPicker ───────────────────────────────────────
// Keys must match the TanStack column IDs above (id field or accessor key)

type ColDef = { key: string; label: string }

const COLUMN_DEFS: ColDef[] = [
  { key: 'tx_date',            label: 'Tx Date' },
  { key: 'transferred_at',     label: 'วันที่โอน' },
  { key: 'shop_name',          label: 'ร้านค้า' },
  { key: 'transaction_type',   label: 'Transaction Type' },
  { key: 'fee_name',           label: 'Fee Name' },
  { key: 'transaction_number', label: 'Tx Number' },
  { key: 'details',            label: 'Details' },
  { key: 'seller_sku',         label: 'Seller SKU' },
  { key: 'lazada_sku',         label: 'Lazada SKU' },
  { key: 'amount',             label: 'Amount' },
  { key: 'vat_in_amount',      label: 'VAT' },
  { key: 'wht_amount',         label: 'WHT' },
  { key: 'wht_included',       label: 'WHT Inc.' },
  { key: 'statement',          label: 'Statement' },
  { key: 'paid_status',        label: 'Paid' },
  { key: 'order_no',           label: 'Order No.' },
  { key: 'cust_code',          label: 'Cust Code' },
  { key: 'cust_billname',      label: 'Cust Name' },
  { key: 'docuno',             label: 'Docuno' },
  { key: 'docudate',           label: 'Docudate' },
  { key: 'order_item_no',      label: 'Order Item No.' },
  { key: 'order_item_status',  label: 'Item Status' },
  { key: 'shipping_provider',  label: 'Shipping Provider' },
  { key: 'shipping_speed',     label: 'Speed' },
  { key: 'shipment_type',      label: 'Shipment' },
  { key: 'reference',          label: 'Reference' },
  { key: 'comment',            label: 'Comment' },
  { key: 'payment_ref_id',     label: 'PaymentRefId' },
  { key: 'short_code',         label: 'ShortCode' },
  { key: 'source',             label: 'Source' },
]

const PREF_KEY = 'columns.lazada-transactions-work'

// ── Column Picker Dropdown ────────────────────────────────────────────────────

function ColumnPicker({ hidden, onToggle, onReset, saving }: {
  hidden: Set<string>
  onToggle: (key: string) => void
  onReset: () => void
  saving: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const hiddenCount = hidden.size

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded transition-colors ${hiddenCount > 0 ? 'border-[#0070F2] text-[#0070F2] bg-[#EBF5FB]' : 'border-[#D9D9D9] text-[#32363A] bg-white hover:bg-[#F5F5F5]'}`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        คอลัมน์
        {hiddenCount > 0 && (
          <span className="bg-[#0070F2] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            -{hiddenCount}
          </span>
        )}
        {saving && <span className="w-1.5 h-1.5 rounded-full bg-[#6A6D70] animate-pulse ml-0.5" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[#D9D9D9] rounded shadow-lg w-52">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#EBEBEB]">
            <span className="text-[10px] font-semibold text-[#6A6D70] uppercase tracking-wider">เลือกคอลัมน์</span>
            {hiddenCount > 0 && (
              <button onClick={onReset} className="text-[10px] text-[#0070F2] hover:underline font-medium">
                แสดงทั้งหมด
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {COLUMN_DEFS.map(col => (
              <label key={col.key} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#F9FAFB] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!hidden.has(col.key)}
                  onChange={() => onToggle(col.key)}
                  className="w-3.5 h-3.5 rounded-sm border-[#D9D9D9] text-[#0070F2] focus:ring-[#0070F2]"
                />
                <span className="text-xs text-[#32363A]">{col.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

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
  const [transferStatus, setTransferStatus] = useState('')
  const [transferredStart, setTransferredStart] = useState('')
  const [transferredEnd, setTransferredEnd]     = useState('')
  const [diStatus, setDiStatus]           = useState('')
  const [showAdv, setShowAdv]             = useState(false)
  const hasTransferFilter = !!(transferStatus || transferredStart || transferredEnd)
  const hasDiFilter       = !!diStatus

  // Bulk state
  const [selectedIds, setSelectedIds]         = useState<Set<number>>(new Set())
  const [allFilterSelected, setAllFilterSelected] = useState(false)
  const [fetchingAllIds, setFetchingAllIds]   = useState(false)
  const [transferDate, setTransferDate]       = useState('')
  const [updating, setUpdating]               = useState(false)
  const [exporting, setExporting]             = useState(false)
  const [syncing, setSyncing]                 = useState(false)
  const [syncResult, setSyncResult]           = useState<{ custRows: number; docRows: number; custFound: number; docFound: number } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; msg: string; danger?: boolean; onConfirm?: () => void
  }>({ open: false, title: '', msg: '' })

  // Column visibility (server-persisted)
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set())
  const prefSynced = useRef(false)

  // Sort state
  const [sorting, setSorting] = useState<SortingState>([])

  const checkboxMode = !!(startDate && endDate)

  useEffect(() => {
    setSelectedIds(new Set()); setAllFilterSelected(false)
  }, [startDate, endDate, search, shopName, txType, paidStatus, source, transferStatus, transferredStart, transferredEnd, diStatus])

  useEffect(() => {
    if (!checkboxMode) { setSelectedIds(new Set()); setAllFilterSelected(false) }
  }, [checkboxMode])

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: shopsData } = useQuery<PaginatedResponse<LazadaShop>>({
    queryKey: ['lazada-shops-all'],
    queryFn: () => api.get('/lazada/shops', { params: { per_page: 100, is_active: true } }).then(r => r.data),
    enabled: can('lazada-transactions-work.view'),
  })

  const { data: prefData } = useQuery<{ value: { hidden: string[] } | null }>({
    queryKey: ['user-prefs', PREF_KEY],
    queryFn: () => api.get(`/user-preferences/${PREF_KEY}`).then(r => r.data),
    staleTime: Infinity,
  })

  useEffect(() => {
    if (prefData && !prefSynced.current) {
      prefSynced.current = true
      setHiddenCols(new Set(prefData.value?.hidden ?? []))
    }
  }, [prefData])

  const savePrefMutation = useMutation({
    mutationFn: (hidden: string[]) =>
      api.put(`/user-preferences/${PREF_KEY}`, { value: { hidden } }),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<LazadaTransactionWork>>({
    queryKey: ['lazada-transactions-work', search, page, shopName, startDate, endDate, txType, paidStatus, source, transferStatus, transferredStart, transferredEnd, diStatus],
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
        di_status: diStatus || undefined,
      },
    }).then(r => r.data),
    enabled: can('lazada-transactions-work.view'),
  })

  // ── TanStack Table ────────────────────────────────────────────────────────

  const items = data?.data ?? []
  const shops = shopsData?.data ?? []

  const columnVisibility = useMemo<VisibilityState>(() => {
    const v: VisibilityState = {}
    hiddenCols.forEach(k => { v[k] = false })
    return v
  }, [hiddenCols])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo(() => COLUMNS, [])

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
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
          di_status: diStatus || undefined,
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
          di_status: diStatus || undefined,
        },
      })
      const fetchItems = res.data?.data ?? []
      if (fetchItems.length === 0) { alert('ไม่พบข้อมูลสำหรับส่งออก'); return }
      const rows = fetchItems.map((item: LazadaTransactionWork) => ({
        'Transaction Date': fmtDate(item.transaction_date),
        'วันที่โอน':        fmtDate(item.transferred_at),
        'ร้านค้า':          item.shop_name ?? '',
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
        'Cust Code':        item.cust_code ?? '',
        'Cust Name':        item.cust_billname ?? '',
        'Docuno':           item.docuno ?? '',
        'Docudate':         fmtDate(item.docudate),
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

  async function handleSyncCustomers() {
    setSyncing(true); setSyncResult(null)
    try {
      const res = await api.post('/lazada/transactions-work/sync-customers', {
        start_date: startDate || null,
        end_date:   endDate   || null,
        shop_name:  shopName  || null,
        force:      true,
      })
      setSyncResult({ custRows: res.data.cust_rows, docRows: res.data.doc_rows, custFound: res.data.cust_found, docFound: res.data.doc_found })
      qc.invalidateQueries({ queryKey: ['lazada-transactions-work'] })
    } catch {
      alert('เกิดข้อผิดพลาดในการ Re-sync')
    } finally { setSyncing(false) }
  }

  function toggleCol(key: string) {
    setHiddenCols(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      savePrefMutation.mutate(Array.from(next))
      return next
    })
  }

  function resetCols() {
    setHiddenCols(new Set())
    savePrefMutation.mutate([])
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  if (!can('lazada-transactions-work.view')) return <ErpNoAccess />

  const allPageIds     = items.map(i => i.id)
  const selectedOnPage = allPageIds.filter(id => selectedIds.has(id))
  const allOnPageSel   = allPageIds.length > 0 && selectedOnPage.length === allPageIds.length
  const someOnPageSel  = selectedOnPage.length > 0 && !allOnPageSel

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
    setDiStatus(''); setPage(1)
  }

  const hasFilter    = !!(search || shopName || startDate || endDate || txType || paidStatus || source || transferStatus || transferredStart || transferredEnd || diStatus)
  const hasAdvFilter = !!(txType || paidStatus || source || transferStatus || transferredStart || transferredEnd || diStatus)

  const visibleLeafCols = table.getVisibleLeafColumns()
  const visibleCount    = visibleLeafCols.length + (checkboxMode ? 1 : 0)
  const minWidth        = visibleLeafCols.reduce((s, c) => s + (c.getSize() ?? 0), 0) + (checkboxMode ? 36 : 0) + 'px'

  return (
    <div className="space-y-0 text-[#32363A]">

      {/* ══ Page Header ══════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#D9D9D9] px-4 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-[#6A6D70] uppercase tracking-wide">Lazada / รายการธุรกรรม</p>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-[#32363A] leading-tight">จัดการรายการธุรกรรม Lazada</h1>
            {(data as any)?.last_sync_at && (
              <span className="text-[10px] text-[#6A6D70] bg-[#F5F5F5] px-1.5 py-0.5 rounded border border-[#D9D9D9] flex items-center gap-1">
                <RefreshCw className="w-2.5 h-2.5" />
                Sync ล่าสุด: {new Date((data as any).last_sync_at).toLocaleString('th-TH', { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ColumnPicker
            hidden={hiddenCols}
            onToggle={toggleCol}
            onReset={resetCols}
            saving={savePrefMutation.isPending}
          />
          {can('lazada-transactions-work.edit') && (
          <button
            onClick={handleSyncCustomers}
            disabled={syncing}
            title="ดึงข้อมูล Cust Code/Cust Name (WINS_681) และ Docuno/Docudate (WINS_682) ใหม่"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#D9D9D9] hover:bg-[#F5F5F5] disabled:opacity-50 text-[#32363A] text-xs font-semibold rounded transition-colors bg-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'กำลัง Sync...' : 'Re-sync Cust'}
          </button>
          )}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0070F2] hover:bg-[#0064D9] disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'กำลังส่งออก...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* ── Sync Result Banner ──────────────────────────────────────────────── */}
      {syncResult && (
        <div className="bg-[#F1FAF4] border-x border-b border-[#107E3E]/30 px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-[#107E3E]">
            Re-sync สำเร็จ · Cust: พบ <strong>{syncResult.custFound.toLocaleString('th-TH')}</strong> order · อัพเดท <strong>{syncResult.custRows.toLocaleString('th-TH')}</strong> แถว · DI: พบ <strong>{syncResult.docFound.toLocaleString('th-TH')}</strong> order · อัพเดท <strong>{syncResult.docRows.toLocaleString('th-TH')}</strong> แถว
          </span>
          <button onClick={() => setSyncResult(null)} className="text-[#6A6D70] hover:text-[#32363A]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
              {(showAdv || hasTransferFilter || hasDiFilter) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
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

        {(showAdv || hasTransferFilter || hasDiFilter) && (
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

            <div className="w-px self-stretch bg-[#EBEBEB] mx-1" />

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

            <SapInput label="สถานะ DI">
              <select
                value={diStatus}
                onChange={e => { setDiStatus(e.target.value); setPage(1) }}
                className={`${inputCls} pr-7 min-w-[150px] ${diStatus ? 'border-[#0070F2] bg-[#EBF5FB]' : ''}`}
              >
                <option value="">ทั้งหมด</option>
                <option value="no_di">ไม่มี DI (Docuno ว่าง)</option>
                <option value="has_di">มี DI แล้ว</option>
              </select>
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
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {checkboxMode ? (
            selectedIds.size > 0 ? (
              <>
                <span className="text-xs font-semibold text-[#0070F2] bg-[#EBF5FB] border border-[#0070F2]/30 px-2 py-1 rounded-sm">
                  {selectedIds.size.toLocaleString('th-TH')} รายการที่เลือก
                </span>
                {can('lazada-transactions-work.edit') && (<>
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
                  onClick={() => {
                    setConfirmDialog({
                      open: true,
                      title: 'ยืนยันการล้างวันที่โอน',
                      msg: `คุณต้องการล้างวันที่โอนของ ${selectedIds.size.toLocaleString('th-TH')} รายการที่เลือกใช่หรือไม่?`,
                      danger: true,
                      onConfirm: () => handleBulkTransfer(null)
                    })
                  }}
                  disabled={updating}
                  className="h-7 px-3 border border-[#D9D9D9] hover:bg-[#F5F5F5] disabled:opacity-40 text-xs text-[#32363A] rounded transition-colors"
                >
                  ล้างวันที่โอน
                </button>
                </>)}
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
              เลือก <strong className="text-[#0070F2]">ช่วงวันที่ Transaction Date</strong> เพื่ออัพเดทวันที่โอน
            </span>
          )}
        </div>
        <span className="text-xs text-[#6A6D70] whitespace-nowrap shrink-0">
          {isLoading ? '...' : `${data?.total?.toLocaleString('th-TH') ?? 0} รายการ`}
        </span>
      </div>

      {/* ══ Data Table ════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#D9D9D9] border-t-0 overflow-auto max-h-[calc(100vh-244px)] lg:max-h-[calc(100vh-260px)]">
        <table className="w-full text-xs border-collapse" style={{ minWidth }}>
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="bg-[#F2F4F7] border-b-2 border-[#0070F2]">
                {checkboxMode && (
                  <th className="w-9 px-2.5 py-2 border-r border-[#D9D9D9]">
                    <HeaderCheckbox checked={allOnPageSel} indeterminate={someOnPageSel} onChange={toggleAll} />
                  </th>
                )}
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
              table.getRowModel().rows.map(row => {
                const item = row.original
                const isSel = selectedIds.has(item.id)
                return (
                  <tr
                    key={row.id}
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
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {data && <ErpPagination data={data} page={page} setPage={setPage} />}

      {/* ── Confirm Dialog ────────────────────────────────────────────────── */}
      {confirmDialog.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className={`px-5 py-4 border-b flex items-center gap-3 ${confirmDialog.danger ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
              {confirmDialog.danger ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <ShieldCheck className="w-5 h-5 text-slate-600" />}
              <h3 className={`font-semibold ${confirmDialog.danger ? 'text-red-900' : 'text-slate-900'}`}>
                {confirmDialog.title}
              </h3>
            </div>
            <div className="px-5 py-6">
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{confirmDialog.msg}</p>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  setConfirmDialog({ ...confirmDialog, open: false })
                  confirmDialog.onConfirm?.()
                }}
                className={`px-4 py-2 text-xs font-medium text-white rounded-lg transition-all shadow-sm ${
                  confirmDialog.danger
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                }`}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
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
