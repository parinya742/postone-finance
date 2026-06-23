'use client'

import api from '@/lib/api'
import {
  ShopeeWalletSyncLog,
  ShopeeOrderSyncLog,
  ShopeeIncomeSyncLog,
  ShopeeShop,
  PaginatedResponse,
} from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Lock, Activity, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'

type Tab = 'wallet' | 'order' | 'income'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { dateStyle: 'short' })
}

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-[#DCFCE7] text-[#107E3E]',
  completed: 'bg-[#DCFCE7] text-[#107E3E]',
  failed: 'bg-[#FEE2E2] text-[#BB0000]',
  error: 'bg-[#FEE2E2] text-[#BB0000]',
  pending: 'bg-[#FEF3C7] text-[#E9730C]',
  running: 'bg-[#DBEAFE] text-[#0070F2]',
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[#6A6D70]">—</span>
  const cls = STATUS_COLORS[status.toLowerCase()] ?? 'bg-[#F3F3F3] text-[#6A6D70]'
  const icon = status.toLowerCase() === 'success' || status.toLowerCase() === 'completed'
    ? <CheckCircle className="w-3 h-3" />
    : status.toLowerCase() === 'failed' || status.toLowerCase() === 'error'
    ? <XCircle className="w-3 h-3" />
    : status.toLowerCase() === 'running'
    ? <RefreshCw className="w-3 h-3 animate-spin" />
    : <Clock className="w-3 h-3" />
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', cls)}>
      {icon}
      {status}
    </span>
  )
}

function MessageCell({ msg }: { msg: string | null }) {
  if (!msg) return <span className="text-[#6A6D70]">—</span>
  return (
    <span
      className="text-xs text-[#32363A] max-w-[300px] block truncate"
      title={msg}
    >
      {msg}
    </span>
  )
}

function Filters({
  shops,
  shopName, onShopName,
  status, onStatus,
  startDate, onStartDate,
  endDate, onEndDate,
  hasFilter, onReset,
}: {
  shops: ShopeeShop[]
  shopName: string; onShopName: (v: string) => void
  status: string; onStatus: (v: string) => void
  startDate: string; onStartDate: (v: string) => void
  endDate: string; onEndDate: (v: string) => void
  hasFilter: boolean; onReset: () => void
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={shopName}
        onChange={(e) => onShopName(e.target.value)}
        className="border border-[#D9D9D9] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070F2] bg-white text-[#32363A]"
      >
        <option value="">ทุกร้านค้า</option>
        {shops.map((s) => (
          <option key={s.shop_id} value={s.shop_name ?? s.shop_id}>{s.shop_name ?? s.shop_id}</option>
        ))}
      </select>

      <select
        value={status}
        onChange={(e) => onStatus(e.target.value)}
        className="border border-[#D9D9D9] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070F2] bg-white text-[#32363A]"
      >
        <option value="">ทุกสถานะ</option>
        <option value="success">Success</option>
        <option value="failed">Failed</option>
        <option value="pending">Pending</option>
        <option value="running">Running</option>
      </select>

      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartDate(e.target.value)}
        className="border border-[#D9D9D9] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070F2] text-[#32363A]"
        title="วันที่เริ่มต้น"
      />
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndDate(e.target.value)}
        className="border border-[#D9D9D9] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070F2] text-[#32363A]"
        title="วันที่สิ้นสุด"
      />

      {hasFilter && (
        <button
          onClick={onReset}
          className="px-3 py-2 text-sm text-[#6A6D70] hover:text-[#32363A] border border-[#D9D9D9] rounded hover:bg-[#F5F5F5] transition-colors"
        >
          ล้างตัวกรอง
        </button>
      )}
    </div>
  )
}

function Pagination({
  page, lastPage, total, onPrev, onNext,
}: {
  page: number; lastPage: number; total: number
  onPrev: () => void; onNext: () => void
}) {
  if (lastPage <= 1) return null
  return (
    <div className="px-5 py-3 border-t border-[#E8E8E8] flex items-center justify-between text-sm text-[#6A6D70]">
      <span>หน้า {page} จาก {lastPage} (ทั้งหมด {total.toLocaleString('th-TH')} รายการ)</span>
      <div className="flex gap-2">
        <button disabled={page === 1} onClick={onPrev} className="px-3 py-1.5 border border-[#D9D9D9] rounded disabled:opacity-50 hover:bg-[#F5F5F5]">ก่อนหน้า</button>
        <button disabled={page === lastPage} onClick={onNext} className="px-3 py-1.5 border border-[#D9D9D9] rounded disabled:opacity-50 hover:bg-[#F5F5F5]">ถัดไป</button>
      </div>
    </div>
  )
}

function WalletSyncLogTab({ shops }: { shops: ShopeeShop[] }) {
  const [shopName, setShopName] = useState('')
  const [status, setStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<PaginatedResponse<ShopeeWalletSyncLog>>({
    queryKey: ['shopee-wallet-sync-logs', shopName, status, startDate, endDate, page],
    queryFn: () =>
      api.get('/shopee/wallet-sync-logs', {
        params: {
          shop_name: shopName || undefined,
          status: status || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          page,
          per_page: 50,
        },
      }).then((r) => r.data),
  })

  const items = data?.data ?? []
  const hasFilter = !!(shopName || status || startDate || endDate)

  const reset = () => { setShopName(''); setStatus(''); setStartDate(''); setEndDate(''); setPage(1) }

  return (
    <div className="space-y-4">
      <Filters
        shops={shops}
        shopName={shopName} onShopName={(v) => { setShopName(v); setPage(1) }}
        status={status} onStatus={(v) => { setStatus(v); setPage(1) }}
        startDate={startDate} onStartDate={(v) => { setStartDate(v); setPage(1) }}
        endDate={endDate} onEndDate={(v) => { setEndDate(v); setPage(1) }}
        hasFilter={hasFilter} onReset={reset}
      />

      <div className="bg-white border border-[#D9D9D9] rounded">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-[#F5F5F5] border-b border-[#D9D9D9]">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">วันที่-เวลา</th>
                <th className="text-left px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">ร้านค้า</th>
                <th className="text-left px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">ช่วงวันที่</th>
                <th className="text-center px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">จำนวน TX</th>
                <th className="text-center px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">File ID</th>
                <th className="text-center px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">สถานะ</th>
                <th className="text-left px-4 py-3 font-medium text-[#6A6D70]">ข้อความ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8E8]">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-[#F3F3F3] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#6A6D70]">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบข้อมูล Wallet Sync Log
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F5F5F5] transition-colors">
                    <td className="px-4 py-3 text-xs text-[#6A6D70] whitespace-nowrap">{fmtDateTime(item.created_at)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-[#32363A] whitespace-nowrap">{item.shop_name ?? item.shop_id ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#6A6D70] whitespace-nowrap">
                      {item.range_from && item.range_to
                        ? `${fmtDate(item.range_from)} – ${fmtDate(item.range_to)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-medium text-[#32363A]">{item.tx_count?.toLocaleString('th-TH') ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-xs font-mono text-[#6A6D70]">{item.file_id ?? '—'}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3"><MessageCell msg={item.message} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data && <Pagination page={page} lastPage={data.last_page} total={data.total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />}
      </div>
    </div>
  )
}

function OrderSyncLogTab({ shops }: { shops: ShopeeShop[] }) {
  const [shopName, setShopName] = useState('')
  const [status, setStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<PaginatedResponse<ShopeeOrderSyncLog>>({
    queryKey: ['shopee-order-sync-logs', shopName, status, startDate, endDate, page],
    queryFn: () =>
      api.get('/shopee/order-sync-logs', {
        params: {
          shop_name: shopName || undefined,
          status: status || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          page,
          per_page: 50,
        },
      }).then((r) => r.data),
  })

  const items = data?.data ?? []
  const hasFilter = !!(shopName || status || startDate || endDate)

  const reset = () => { setShopName(''); setStatus(''); setStartDate(''); setEndDate(''); setPage(1) }

  return (
    <div className="space-y-4">
      <Filters
        shops={shops}
        shopName={shopName} onShopName={(v) => { setShopName(v); setPage(1) }}
        status={status} onStatus={(v) => { setStatus(v); setPage(1) }}
        startDate={startDate} onStartDate={(v) => { setStartDate(v); setPage(1) }}
        endDate={endDate} onEndDate={(v) => { setEndDate(v); setPage(1) }}
        hasFilter={hasFilter} onReset={reset}
      />

      <div className="bg-white border border-[#D9D9D9] rounded">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-[#F5F5F5] border-b border-[#D9D9D9]">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">วันที่-เวลา</th>
                <th className="text-left px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">ร้านค้า</th>
                <th className="text-left px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">ช่วงวันที่</th>
                <th className="text-center px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">จำนวน Order</th>
                <th className="text-center px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">File ID</th>
                <th className="text-center px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">สถานะ</th>
                <th className="text-left px-4 py-3 font-medium text-[#6A6D70]">ข้อความ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8E8]">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-[#F3F3F3] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#6A6D70]">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบข้อมูล Order Sync Log
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F5F5F5] transition-colors">
                    <td className="px-4 py-3 text-xs text-[#6A6D70] whitespace-nowrap">{fmtDateTime(item.created_at)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-[#32363A] whitespace-nowrap">{item.shop_name ?? item.shop_id ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#6A6D70] whitespace-nowrap">
                      {item.range_from && item.range_to
                        ? `${fmtDate(item.range_from)} – ${fmtDate(item.range_to)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-medium text-[#32363A]">{item.order_count?.toLocaleString('th-TH') ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-xs font-mono text-[#6A6D70]">{item.file_id ?? '—'}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3"><MessageCell msg={item.message} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data && <Pagination page={page} lastPage={data.last_page} total={data.total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />}
      </div>
    </div>
  )
}

function IncomeSyncLogTab({ shops }: { shops: ShopeeShop[] }) {
  const [shopName, setShopName] = useState('')
  const [status, setStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<PaginatedResponse<ShopeeIncomeSyncLog>>({
    queryKey: ['shopee-income-sync-logs', shopName, status, startDate, endDate, page],
    queryFn: () =>
      api.get('/shopee/income-sync-logs', {
        params: {
          shop_name: shopName || undefined,
          status: status || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          page,
          per_page: 50,
        },
      }).then((r) => r.data),
  })

  const items = data?.data ?? []
  const hasFilter = !!(shopName || status || startDate || endDate)

  const reset = () => { setShopName(''); setStatus(''); setStartDate(''); setEndDate(''); setPage(1) }

  return (
    <div className="space-y-4">
      <Filters
        shops={shops}
        shopName={shopName} onShopName={(v) => { setShopName(v); setPage(1) }}
        status={status} onStatus={(v) => { setStatus(v); setPage(1) }}
        startDate={startDate} onStartDate={(v) => { setStartDate(v); setPage(1) }}
        endDate={endDate} onEndDate={(v) => { setEndDate(v); setPage(1) }}
        hasFilter={hasFilter} onReset={reset}
      />

      <div className="bg-white border border-[#D9D9D9] rounded">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-[#F5F5F5] border-b border-[#D9D9D9]">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">วันที่-เวลา</th>
                <th className="text-left px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">ร้านค้า</th>
                <th className="text-left px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">วันที่ Payout</th>
                <th className="text-center px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">จำนวน Order</th>
                <th className="text-center px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">File ID</th>
                <th className="text-center px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">สถานะ</th>
                <th className="text-left px-4 py-3 font-medium text-[#6A6D70]">ข้อความ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8E8]">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-[#F3F3F3] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#6A6D70]">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบข้อมูล Income Payout Sync Log
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F5F5F5] transition-colors">
                    <td className="px-4 py-3 text-xs text-[#6A6D70] whitespace-nowrap">{fmtDateTime(item.created_at)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-[#32363A] whitespace-nowrap">{item.shop_name ?? item.shop_id ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#6A6D70] whitespace-nowrap">{fmtDate(item.payout_date)}</td>
                    <td className="px-4 py-3 text-center text-xs font-medium text-[#32363A]">{item.order_count?.toLocaleString('th-TH') ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-xs font-mono text-[#6A6D70]">{item.file_id ?? '—'}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3"><MessageCell msg={item.message} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data && <Pagination page={page} lastPage={data.last_page} total={data.total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />}
      </div>
    </div>
  )
}

export default function ShopeeSyncLogsPage() {
  const { can } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('wallet')

  const { data: shopsData } = useQuery<PaginatedResponse<ShopeeShop>>({
    queryKey: ['shopee-shops-all'],
    queryFn: () => api.get('/shopee/shops', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('shopee-shops.view'),
  })

  if (!can('shopee-shops.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#6A6D70]">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const shops = shopsData?.data ?? []

  const tabs: { key: Tab; label: string }[] = [
    { key: 'income', label: 'รายการซิงค์รายรับ' },
    { key: 'order', label: 'รายการซิงค์ออเดอร์' },
    { key: 'wallet', label: 'รายการซิงค์ยอดผู้ขาย' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="w-6 h-6 text-[#0070F2]" />
        <div>
          <h1 className="text-xl font-semibold text-[#32363A]">Shopee Sync Logs</h1>
          <p className="text-[#6A6D70] text-sm mt-0.5">ประวัติการซิงค์ข้อมูล Shopee</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#D9D9D9]">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'px-5 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150 -mb-px',
                activeTab === tab.key
                  ? 'text-[#0070F2] border-[#0070F2]'
                  : 'text-[#6A6D70] border-transparent hover:text-[#32363A] hover:border-[#D9D9D9]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'income' && <IncomeSyncLogTab shops={shops} />}
      {activeTab === 'order' && <OrderSyncLogTab shops={shops} />}
      {activeTab === 'wallet' && <WalletSyncLogTab shops={shops} />}
    </div>
  )
}
