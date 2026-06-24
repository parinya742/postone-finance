'use client'

import api from '@/lib/api'
import { ShopeeOrderItem, ShopeeShop, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Lock, ShoppingBag, ExternalLink } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { dateStyle: 'short' })
}

function fmtAmt(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function AmountCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-300">—</span>
  const isNeg = value < 0
  return (
    <span className={isNeg ? 'text-red-600 font-medium' : 'text-slate-700'}>
      {fmtAmt(value)}
    </span>
  )
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  SHIPPED: 'bg-blue-100 text-blue-700',
  READY_TO_SHIP: 'bg-sky-100 text-sky-700',
  PROCESSED: 'bg-yellow-100 text-yellow-700',
  CANCELLED: 'bg-red-100 text-red-700',
  UNPAID: 'bg-slate-100 text-slate-500',
  IN_CANCEL: 'bg-orange-100 text-orange-700',
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-slate-300">—</span>
  const cls = STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600'
  return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${cls}`}>{status}</span>
}

export default function ShopeeOrdersPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [shopName, setShopName] = useState('')
  const [orderStatus, setOrderStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data: shopsData } = useQuery<PaginatedResponse<ShopeeShop>>({
    queryKey: ['shopee-shops-all'],
    queryFn: () => api.get('/shopee/shops', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('shopee-shops.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<ShopeeOrderItem>>({
    queryKey: ['shopee-orders', search, page, shopName, orderStatus, startDate, endDate],
    queryFn: () =>
      api.get('/shopee/orders', {
        params: {
          search,
          page,
          per_page: 50,
          shop_name: shopName || undefined,
          order_status: orderStatus || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
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
    setOrderStatus('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const hasFilter = !!(search || shopName || orderStatus || startDate || endDate)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-orange-500" />
          <h1 className="text-2xl font-bold text-slate-800">รายการออเดอร์ Shopee</h1>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} รายการ
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Order SN, SKU, ชื่อสินค้า, Buyer..."
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
          value={orderStatus}
          onChange={(e) => { setOrderStatus(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
        >
          <option value="">ทุกสถานะ</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="SHIPPED">SHIPPED</option>
          <option value="READY_TO_SHIP">READY_TO_SHIP</option>
          <option value="PROCESSED">PROCESSED</option>
          <option value="CANCELLED">CANCELLED</option>
          <option value="UNPAID">UNPAID</option>
          <option value="IN_CANCEL">IN_CANCEL</option>
        </select>

        <input
          type="date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="วันที่สั่งซื้อ เริ่มต้น"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="วันที่สั่งซื้อ สิ้นสุด"
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
          <table className="w-full text-sm min-w-[1400px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">วันที่สั่ง</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">สถานะ</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ร้านค้า</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Order SN</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Buyer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">สินค้า</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">SKU</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ตัวเลือก</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">จำนวน</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ราคาขาย (฿)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ยอดสุทธิ (฿)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ยอดรวม (฿)</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">จังหวัด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(13)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-5 py-12 text-center text-slate-400">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบรายการออเดอร์
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={`${item.order_sn}-${item.sku_ref}-${item.variation_name}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      <div>{fmtDate(item.create_time)}</div>
                      {item.pay_time && (
                        <div className="text-slate-400 text-[10px]">ชำระ {fmtDate(item.pay_time)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={item.order_status} />
                      {item.cancel_reason && (
                        <div className="text-[10px] text-red-500 mt-0.5 max-w-[120px] truncate" title={item.cancel_reason}>{item.cancel_reason}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                      {item.shop_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-orange-700 max-w-[160px] truncate" title={item.order_sn}>
                      {item.order_sn}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[120px] truncate" title={item.buyer_username ?? ''}>
                      {item.buyer_username ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 max-w-[200px] truncate" title={item.item_name ?? ''}>
                      {item.item_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-[120px] truncate" title={item.sku_ref}>
                      {item.sku_ref}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[140px] truncate" title={item.variation_name}>
                      {item.variation_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-700">
                      {item.qty ?? '—'}
                      {item.qty_returned ? <span className="text-red-500 ml-1">(-{item.qty_returned})</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AmountCell value={item.selling_price} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AmountCell value={item.net_price} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <AmountCell value={item.total_amount} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {item.province ?? '—'}
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
        ข้อมูลดึงจาก Shopee Order Items ผ่าน n8n · กรองตามวันที่ create_time
      </p>
    </div>
  )
}
