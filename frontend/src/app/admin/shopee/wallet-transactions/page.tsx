'use client'

import api from '@/lib/api'
import { ShopeeWalletTransaction, ShopeeShop, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Lock, Wallet, ExternalLink, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtAmt(n: number | null) {
  if (n == null) return '—'
  const formatted = Math.abs(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `-${formatted}` : formatted
}

function AmountCell({ value, moneyFlow }: { value: number | null; moneyFlow?: string | null }) {
  if (value == null) return <span className="text-slate-300">—</span>
  const isOut = moneyFlow === 'out' || value < 0
  return (
    <span className={isOut ? 'text-red-600 font-medium' : 'text-green-700 font-medium'}>
      {isOut && value > 0 ? '-' : ''}{fmtAmt(Math.abs(value))}
    </span>
  )
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
}

export default function ShopeeWalletTransactionsPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [shopName, setShopName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [txType, setTxType] = useState('')
  const [moneyFlow, setMoneyFlow] = useState('')

  const { data: shopsData } = useQuery<PaginatedResponse<ShopeeShop>>({
    queryKey: ['shopee-shops-all'],
    queryFn: () => api.get('/shopee/shops', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('shopee-shops.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<ShopeeWalletTransaction>>({
    queryKey: ['shopee-wallet-transactions', search, page, shopName, startDate, endDate, txType, moneyFlow],
    queryFn: () =>
      api.get('/shopee/wallet-transactions', {
        params: {
          search,
          page,
          per_page: 50,
          shop_name: shopName || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          transaction_type: txType || undefined,
          money_flow: moneyFlow || undefined,
        },
      }).then((r) => r.data),
    enabled: can('shopee-shops.view'),
  })

  if (!can('shopee-shops.view')) {
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
    setMoneyFlow('')
    setPage(1)
  }

  const hasFilter = !!(search || shopName || startDate || endDate || txType || moneyFlow)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Wallet className="w-6 h-6 text-orange-500" />
          <h1 className="text-2xl font-bold text-slate-800">ธุรกรรม Shopee Wallet</h1>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} รายการ · ซิงค์อัตโนมัติผ่าน n8n
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Transaction ID, Order SN, Buyer..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <select
          value={shopName}
          onChange={(e) => { setShopName(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
        >
          <option value="">ทุกร้านค้า</option>
          {shops.map((s) => (
            <option key={s.shop_id} value={s.shop_name ?? s.shop_id}>{s.shop_name ?? s.shop_id}</option>
          ))}
        </select>

        <select
          value={moneyFlow}
          onChange={(e) => { setMoneyFlow(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
        >
          <option value="">ทิศทางเงิน (ทั้งหมด)</option>
          <option value="in">รับเงิน (in)</option>
          <option value="out">จ่ายเงิน (out)</option>
        </select>

        <input
          type="date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="วันที่เริ่มต้น"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="วันที่สิ้นสุด"
        />

        <input
          value={txType}
          onChange={(e) => { setTxType(e.target.value); setPage(1) }}
          placeholder="ประเภทธุรกรรม"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 min-w-[180px]"
        />

        {hasFilter && (
          <button
            onClick={resetFilters}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1400px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">วันที่-เวลา</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ร้านค้า</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Transaction ID</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ประเภท</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ทิศทาง</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">จำนวน (฿)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ยอดคงเหลือ (฿)</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Order SN</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Buyer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">รายละเอียด</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600 whitespace-nowrap">สถานะ</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Escrow (฿)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(12)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-5 py-12 text-center text-slate-400">
                    <Wallet className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบรายการธุรกรรม Wallet
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {fmtDateTime(item.create_time)}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                      {item.shop_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-orange-700 max-w-[180px] truncate" title={item.transaction_id}>
                      {item.transaction_id}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[150px]">
                      <div className="truncate" title={item.transaction_type ?? ''}>
                        {item.transaction_type ?? '—'}
                      </div>
                      {item.transaction_tab_type && (
                        <div className="text-[10px] text-slate-400 truncate">{item.transaction_tab_type}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.money_flow === 'in' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                          <ArrowDownCircle className="w-3.5 h-3.5" />
                          รับ
                        </span>
                      ) : item.money_flow === 'out' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                          <ArrowUpCircle className="w-3.5 h-3.5" />
                          จ่าย
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AmountCell value={item.amount} moneyFlow={item.money_flow} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.current_balance != null ? (
                        <span className="text-xs text-slate-700 font-medium">
                          {item.current_balance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 max-w-[150px] truncate" title={item.order_sn ?? ''}>
                      {item.order_sn || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[120px] truncate" title={item.buyer_username ?? item.buyer_name ?? ''}>
                      {item.buyer_username || item.buyer_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate" title={item.description ?? ''}>
                      {item.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.status ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status.toLowerCase()] ?? 'bg-slate-100 text-slate-600'}`}>
                          {item.status}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AmountCell value={item.escrow_amount} />
                    </td>
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
        ข้อมูลดึงจาก Shopee Wallet Statement ผ่าน n8n · กรองตามวันที่ create_time
      </p>
    </div>
  )
}
