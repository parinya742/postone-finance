'use client'

import api from '@/lib/api'
import { ShopeeTransaction, ShopeeShop, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Lock, Receipt, ExternalLink } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { dateStyle: 'short' })
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

export default function ShopeeTransactionsPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [shopName, setShopName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')

  const { data: shopsData } = useQuery<PaginatedResponse<ShopeeShop>>({
    queryKey: ['shopee-shops-all'],
    queryFn: () => api.get('/shopee/shops', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('shopee-shops.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<ShopeeTransaction>>({
    queryKey: ['shopee-transactions', search, page, shopName, startDate, endDate, paymentMethod],
    queryFn: () =>
      api.get('/shopee/transactions', {
        params: {
          search,
          page,
          per_page: 50,
          shop_name: shopName || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          payment_method: paymentMethod || undefined,
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
    setPaymentMethod('')
    setPage(1)
  }

  const hasFilter = !!(search || shopName || startDate || endDate || paymentMethod)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Receipt className="w-6 h-6 text-orange-500" />
          <h1 className="text-2xl font-bold text-slate-800">รายการธุรกรรม Shopee</h1>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} รายการ · ซิงค์อัตโนมัติทุกวัน
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Order SN, Buyer Username..."
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

        <input
          type="date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="วันที่ payout เริ่มต้น"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="วันที่ payout สิ้นสุด"
        />

        <input
          value={paymentMethod}
          onChange={(e) => { setPaymentMethod(e.target.value); setPage(1) }}
          placeholder="วิธีชำระเงิน"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 min-w-[160px]"
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

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1300px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">วันที่ Payout</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ร้านค้า</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Order SN</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Buyer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">วิธีชำระ</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ราคาต้น (฿)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Commission (฿)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Service Fee (฿)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Tx Fee (฿)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ยอดสุทธิ (฿)</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600 whitespace-nowrap">File ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(11)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบรายการธุรกรรม
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.order_sn} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      <div>{fmtDate(item.payout_date)}</div>
                      {item.order_date && (
                        <div className="text-slate-400 text-[10px]">สั่ง {fmtDate(item.order_date)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-slate-700">{item.shop_name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-orange-700 max-w-[160px] truncate" title={item.order_sn}>
                      {item.order_sn}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[120px] truncate" title={item.buyer_username ?? ''}>
                      {item.buyer_username ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[100px] truncate" title={item.payment_method ?? ''}>
                      {item.payment_method ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AmountCell value={item.original_price} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AmountCell value={item.commission_fee} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AmountCell value={item.service_fee} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AmountCell value={item.transaction_fee} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AmountCell value={item.total_payout} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 text-center">{item.file_id ?? '—'}</td>
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
        ข้อมูลดึงจาก Shopee Income Payout Report ผ่าน n8n · กรองตามวันที่ payout_date
      </p>
    </div>
  )
}
