'use client'

import api from '@/lib/api'
import { LazadaTransaction, LazadaShop, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Lock, Receipt, ExternalLink, Download } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import * as XLSX from 'xlsx'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtAmt(n: number | null) {
  if (n == null) return '—'
  const formatted = Math.abs(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `-${formatted}` : formatted
}

function AmountCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-300">—</span>
  const isNeg = value < 0
  return (
    <span className={isNeg ? 'text-red-600 font-medium' : 'text-green-700 font-medium'}>
      {fmtAmt(value)}
    </span>
  )
}

function TextCell({ value, mono = false }: { value: string | null; mono?: boolean }) {
  if (!value) return <span className="text-slate-300">—</span>
  return <span className={mono ? 'font-mono' : ''}>{value}</span>
}

function TH({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) {
  return (
    <th className={`px-3 py-2.5 font-medium text-slate-600 whitespace-nowrap text-xs ${right ? 'text-right' : center ? 'text-center' : 'text-left'}`}>
      {children}
    </th>
  )
}

function TD({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) {
  return (
    <td className={`px-3 py-2 text-xs text-slate-700 ${right ? 'text-right' : center ? 'text-center' : ''}`}>
      {children}
    </td>
  )
}

const PAID_STATUS_COLORS: Record<string, string> = {
  paid:   'bg-green-100 text-green-700',
  Paid:   'bg-green-100 text-green-700',
  Unpaid: 'bg-yellow-100 text-yellow-700',
  Failed: 'bg-red-100 text-red-700',
}

const PAID_STATUS_OPTIONS = ['Paid', 'Unpaid', 'Failed']

export default function LazadaTransactionsPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [shopName, setShopName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [txType, setTxType] = useState('')
  const [paidStatus, setPaidStatus] = useState('')
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get('/lazada/transactions', {
        params: {
          search: search || undefined,
          per_page: 50000,
          shop_name: shopName || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          transaction_type: txType || undefined,
          paid_status: paidStatus || undefined,
        },
      })
      const fetchItems = res.data?.data ?? []
      if (fetchItems.length === 0) {
        alert('ไม่พบข้อมูลสำหรับส่งออก')
        return
      }

      const rows = fetchItems.map((item: LazadaTransaction) => ({
        'Transaction Date': item.transaction_date ? new Date(item.transaction_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—',
        'ร้านค้า': item.shop_name ?? '',
        'Transaction Type': item.transaction_type ?? '',
        'Fee Name': item.fee_name ?? '',
        'Transaction Number': item.transaction_number ?? '',
        'Details': item.details ?? '',
        'Seller SKU': item.seller_sku ?? '',
        'Lazada SKU': item.lazada_sku ?? '',
        'Amount': item.amount ?? '',
        'VAT in Amount': item.vat_in_amount ?? '',
        'WHT Amount': item.wht_amount ?? '',
        'WHT included in Amount': item.wht_included_in_amount ?? '',
        'Statement': item.statement ?? '',
        'Paid Status': item.paid_status ?? '',
        'Order No.': item.order_no ?? '',
        'Order Item No.': item.order_item_no ?? '',
        'Order Item Status': item.order_item_status ?? '',
        'Shipping Provider': item.shipping_provider ?? '',
        'Shipping Speed': item.shipping_speed ?? '',
        'Shipment Type': item.shipment_type ?? '',
        'Reference': item.reference ?? '',
        'Comment': item.comment ?? '',
        'PaymentRefId': item.payment_ref_id ?? '',
        'ShortCode': item.short_code ?? '',
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions')

      const dateStr = new Date().toISOString().slice(0, 10)
      const filename = `lazada-transactions-${dateStr}.xlsx`
      XLSX.writeFile(wb, filename)

      api.post('/audit-logs', {
        action: 'export',
        target_type: 'lazada-transactions',
        target_id: 0,
        target_name: filename,
        payload: {
          row_count: fetchItems.length,
          filters: {
            search: search || null,
            shop_name: shopName || null,
            start_date: startDate || null,
            end_date: endDate || null,
            transaction_type: txType || null,
            paid_status: paidStatus || null,
          },
        },
      }).catch(() => {})
    } catch (err) {
      console.error('Export failed:', err)
      alert('เกิดข้อผิดพลาดในการส่งออก')
    } finally {
      setExporting(false)
    }
  }

  const { data: shopsData } = useQuery<PaginatedResponse<LazadaShop>>({
    queryKey: ['lazada-shops-all'],
    queryFn: () => api.get('/lazada/shops', { params: { per_page: 100, is_active: true } }).then((r) => r.data),
    enabled: can('lazada-shops.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<LazadaTransaction>>({
    queryKey: ['lazada-transactions', search, page, shopName, startDate, endDate, txType, paidStatus],
    queryFn: () =>
      api.get('/lazada/transactions', {
        params: {
          search: search || undefined,
          page,
          per_page: 50,
          shop_name: shopName || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          transaction_type: txType || undefined,
          paid_status: paidStatus || undefined,
        },
      }).then((r) => r.data),
    enabled: can('lazada-shops.view'),
  })

  if (!can('lazada-shops.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const items = data?.data ?? []
  const shops = shopsData?.data ?? []

  const resetFilters = () => {
    setSearch('')
    setShopName('')
    setStartDate('')
    setEndDate('')
    setTxType('')
    setPaidStatus('')
    setPage(1)
  }

  const hasFilter = !!(search || shopName || startDate || endDate || txType || paidStatus)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-bold text-slate-800">รายการธุรกรรม Lazada</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} รายการ
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'กำลังส่งออก...' : 'Export Excel'}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="หมายเลขธุรกรรม, เลขออเดอร์, รายละเอียด..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Shop */}
        <select
          value={shopName}
          onChange={(e) => { setShopName(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
        >
          <option value="">ทุกร้านค้า</option>
          {shops.map((s) => (
            <option key={s.id} value={s.shop_name}>{s.shop_name}</option>
          ))}
        </select>

        {/* Transaction Date range */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 whitespace-nowrap">Transaction Date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <span className="text-xs text-slate-400">–</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Transaction Type */}
        <input
          value={txType}
          onChange={(e) => { setTxType(e.target.value); setPage(1) }}
          placeholder="ประเภทธุรกรรม..."
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 min-w-[180px]"
        />

        {/* Paid Status */}
        <select
          value={paidStatus}
          onChange={(e) => { setPaidStatus(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
        >
          <option value="">ทุกสถานะ</option>
          {PAID_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {hasFilter && (
          <button
            onClick={resetFilters}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: '2400px' }}>
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <TH>Transaction Date</TH>
                <TH>ร้านค้า</TH>
                <TH>Transaction Type</TH>
                <TH>Fee Name</TH>
                <TH>Transaction Number</TH>
                <TH>Details</TH>
                <TH>Seller SKU</TH>
                <TH>Lazada SKU</TH>
                <TH right>Amount</TH>
                <TH right>VAT in Amount</TH>
                <TH right>WHT Amount</TH>
                <TH center>WHT included in Amount</TH>
                <TH>Statement</TH>
                <TH center>Paid Status</TH>
                <TH>Order No.</TH>
                <TH>Order Item No.</TH>
                <TH>Order Item Status</TH>
                <TH>Shipping Provider</TH>
                <TH>Shipping Speed</TH>
                <TH>Shipment Type</TH>
                <TH>Reference</TH>
                <TH>Comment</TH>
                <TH>PaymentRefId</TH>
                <TH>ShortCode</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(24)].map((_, j) => (
                      <td key={j} className="px-3 py-2">
                        <div className="h-3 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={24} className="px-5 py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบรายการธุรกรรม
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <TD>{fmtDate(item.transaction_date)}</TD>
                    <TD><span className="font-medium text-slate-800">{item.shop_name}</span></TD>
                    <TD>
                      <span className="max-w-[160px] truncate block" title={item.transaction_type ?? ''}>{item.transaction_type ?? '—'}</span>
                    </TD>
                    <TD>
                      <span className="max-w-[140px] truncate block text-slate-500" title={item.fee_name ?? ''}>{item.fee_name ?? '—'}</span>
                    </TD>
                    <TD><span className="font-mono text-blue-700">{item.transaction_number ?? '—'}</span></TD>
                    <TD>
                      <span className="max-w-[200px] truncate block text-slate-500" title={item.details ?? ''}>{item.details ?? '—'}</span>
                    </TD>
                    <TD><TextCell value={item.seller_sku} mono /></TD>
                    <TD><TextCell value={item.lazada_sku} mono /></TD>
                    <TD right><AmountCell value={item.amount} /></TD>
                    <TD right><AmountCell value={item.vat_in_amount} /></TD>
                    <TD right><AmountCell value={item.wht_amount} /></TD>
                    <TD center>
                      {item.wht_included_in_amount ? (
                        <span className={`px-1.5 py-0.5 rounded text-xs ${item.wht_included_in_amount.toLowerCase() === 'yes' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                          {item.wht_included_in_amount}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </TD>
                    <TD>
                      <span className="max-w-[160px] truncate block text-slate-500" title={item.statement ?? ''}>{item.statement ?? '—'}</span>
                    </TD>
                    <TD center>
                      {item.paid_status ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAID_STATUS_COLORS[item.paid_status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {item.paid_status}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </TD>
                    <TD><span className="font-mono">{item.order_no ?? '—'}</span></TD>
                    <TD><span className="font-mono">{item.order_item_no ?? '—'}</span></TD>
                    <TD><TextCell value={item.order_item_status} /></TD>
                    <TD><TextCell value={item.shipping_provider} /></TD>
                    <TD><TextCell value={item.shipping_speed} /></TD>
                    <TD><TextCell value={item.shipment_type} /></TD>
                    <TD><TextCell value={item.reference} mono /></TD>
                    <TD>
                      <span className="max-w-[160px] truncate block text-slate-500" title={item.comment ?? ''}>{item.comment ?? '—'}</span>
                    </TD>
                    <TD><TextCell value={item.payment_ref_id} mono /></TD>
                    <TD><TextCell value={item.short_code} /></TD>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.last_page > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <span>หน้า {data.current_page} จาก {data.last_page} (ทั้งหมด {data.total?.toLocaleString('th-TH')} รายการ)</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50">ก่อนหน้า</button>
              <button disabled={page === data.last_page} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50">ถัดไป</button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1">
        <ExternalLink className="w-3.5 h-3.5" />
        ข้อมูลดึงจาก Lazada Finance Statement · แสดงผลตามลำดับคอลัมน์ของ Excel
      </p>
    </div>
  )
}
