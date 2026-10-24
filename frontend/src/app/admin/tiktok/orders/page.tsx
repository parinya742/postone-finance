'use client'

import api from '@/lib/api'
import { TikTokOrderLine, TikTokShop, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Lock, ShoppingBag, ExternalLink, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

type Num = string | number | null

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { dateStyle: 'short' })
}

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtAmt(n: Num) {
  if (n == null || n === '') return '—'
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function AmountCell({ value }: { value: Num }) {
  if (value == null || value === '') return <span className="text-slate-300">—</span>
  return (
    <span className={Number(value) < 0 ? 'text-red-600 font-medium' : 'text-slate-700'}>
      {fmtAmt(value)}
    </span>
  )
}

const STATUS_COLORS: Record<string, string> = {
  'เสร็จสมบูรณ์': 'bg-green-100 text-green-700',
  'จัดส่งแล้ว': 'bg-blue-100 text-blue-700',
  'ที่จะจัดส่ง': 'bg-sky-100 text-sky-700',
  'ยังไม่ได้ชำระเงิน': 'bg-slate-100 text-slate-500',
  'ยกเลิกแล้ว': 'bg-red-100 text-red-700',
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-slate-300">—</span>
  const cls = STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600'
  return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${cls}`}>{status}</span>
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className="text-slate-800 text-xs text-right break-all">{children ?? '—'}</span>
    </div>
  )
}

function OrderLineDetail({ item, onClose }: { item: TikTokOrderLine; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-white shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500">Order ID</p>
            <p className="font-mono text-sm font-semibold text-rose-700">{item.order_id}</p>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={item.order_status} />
              {item.order_substatus && <span className="text-[10px] text-slate-500">{item.order_substatus}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <section>
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">สินค้า</h3>
            <DetailRow label="ชื่อสินค้า">{item.product_name}</DetailRow>
            <DetailRow label="ตัวเลือก">{item.variation}</DetailRow>
            <DetailRow label="Seller SKU">{item.seller_sku}</DetailRow>
            <DetailRow label="SKU ID">{item.sku_id}</DetailRow>
            <DetailRow label="หมวดหมู่">{item.product_category}</DetailRow>
            <DetailRow label="จำนวน">{item.quantity}{item.return_quantity ? ` (คืน ${item.return_quantity})` : ''}</DetailRow>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">ยอดเงิน (฿)</h3>
            <DetailRow label="ราคาต่อหน่วย">{fmtAmt(item.unit_original_price)}</DetailRow>
            <DetailRow label="ยอดก่อนส่วนลด">{fmtAmt(item.subtotal_before_discount)}</DetailRow>
            <DetailRow label="ส่วนลดแพลตฟอร์ม">{fmtAmt(item.platform_discount)}</DetailRow>
            <DetailRow label="ส่วนลดผู้ขาย">{fmtAmt(item.seller_discount)}</DetailRow>
            <DetailRow label="ยอดหลังส่วนลด">{fmtAmt(item.subtotal_after_discount)}</DetailRow>
            <DetailRow label="ค่าส่งเดิม">{fmtAmt(item.original_shipping_fee)}</DetailRow>
            <DetailRow label="ส่วนลดค่าส่ง (ผู้ขาย)">{fmtAmt(item.shipping_fee_seller_discount)}</DetailRow>
            <DetailRow label="ส่วนลดค่าส่ง (แพลตฟอร์ม)">{fmtAmt(item.shipping_fee_platform_discount)}</DetailRow>
            <DetailRow label="ค่าส่งหลังส่วนลด">{fmtAmt(item.shipping_fee_after_discount)}</DetailRow>
            <DetailRow label="ส่วนลดการชำระเงิน">{fmtAmt(item.payment_platform_discount)}</DetailRow>
            <DetailRow label="ภาษี">{fmtAmt(item.taxes)}</DetailRow>
            <DetailRow label="ยอดคำสั่งซื้อ"><span className="font-semibold">{fmtAmt(item.order_amount)}</span></DetailRow>
            <DetailRow label="ยอดคืนเงิน">{fmtAmt(item.order_refund_amount)}</DetailRow>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">เวลา</h3>
            <DetailRow label="สร้างคำสั่งซื้อ">{fmtDateTime(item.created_time)}</DetailRow>
            <DetailRow label="ชำระเงิน">{fmtDateTime(item.paid_time)}</DetailRow>
            <DetailRow label="พร้อมจัดส่ง (RTS)">{fmtDateTime(item.rts_time)}</DetailRow>
            <DetailRow label="จัดส่ง">{fmtDateTime(item.shipped_time)}</DetailRow>
            <DetailRow label="ส่งถึง">{fmtDateTime(item.delivered_time)}</DetailRow>
            <DetailRow label="ยกเลิก">{fmtDateTime(item.cancelled_time)}</DetailRow>
            {item.cancel_reason && <DetailRow label="เหตุผลยกเลิก">{item.cancel_by ? `${item.cancel_reason} (${item.cancel_by})` : item.cancel_reason}</DetailRow>}
            {item.cancel_return_type && <DetailRow label="ประเภทยกเลิก/คืน">{item.cancel_return_type}</DetailRow>}
          </section>

          <section>
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">การจัดส่ง / ช่องทาง</h3>
            <DetailRow label="ขนส่ง">{item.shipping_provider}</DetailRow>
            <DetailRow label="Tracking">{item.tracking_id}</DetailRow>
            <DetailRow label="Package ID">{item.package_id}</DetailRow>
            <DetailRow label="ตัวเลือกจัดส่ง">{item.delivery_option}</DetailRow>
            <DetailRow label="Fulfillment">{item.fulfillment_type}</DetailRow>
            <DetailRow label="คลัง">{item.warehouse_name}</DetailRow>
            <DetailRow label="วิธีชำระเงิน">{item.payment_method}</DetailRow>
            <DetailRow label="ช่องทางขาย">{item.order_channel}</DetailRow>
            <DetailRow label="Creator">{item.creator_handle}</DetailRow>
          </section>
        </div>
      </div>
    </div>
  )
}

function TikTokOrdersContent() {
  const { can } = useAuth()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [shopCode, setShopCode] = useState('')
  const [orderStatus, setOrderStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [fileId, setFileId] = useState(searchParams.get('file_id') ?? '')
  const [selected, setSelected] = useState<TikTokOrderLine | null>(null)

  const { data: shopsData } = useQuery<PaginatedResponse<TikTokShop>>({
    queryKey: ['tiktok-shops-all'],
    queryFn: () => api.get('/tiktok/shops', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('tiktok-shops.view'),
  })

  const { data: statuses } = useQuery<string[]>({
    queryKey: ['tiktok-order-statuses'],
    queryFn: () => api.get('/tiktok/order-statuses').then((r) => r.data),
    enabled: can('tiktok-shops.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<TikTokOrderLine>>({
    queryKey: ['tiktok-orders', search, page, shopCode, orderStatus, startDate, endDate, fileId],
    queryFn: () =>
      api.get('/tiktok/orders', {
        params: {
          search,
          page,
          per_page: 50,
          shop_code: shopCode || undefined,
          order_status: orderStatus || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          file_id: fileId || undefined,
        },
      }).then((r) => r.data),
    enabled: can('tiktok-shops.view'),
  })

  if (!can('tiktok-shops.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const items = data?.data ?? []
  const shops = (shopsData?.data ?? []).filter((s) => s.shops_code)

  const resetFilters = () => {
    setSearch('')
    setShopCode('')
    setOrderStatus('')
    setStartDate('')
    setEndDate('')
    setFileId('')
    setPage(1)
  }

  const hasFilter = !!(search || shopCode || orderStatus || startDate || endDate || fileId)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-rose-500" />
          <h1 className="text-2xl font-bold text-slate-800">รายการคำสั่งซื้อ TikTok</h1>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} รายการ (แยกตามสินค้า)
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Order ID, SKU, ชื่อสินค้า, Tracking, Creator..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <select
          value={shopCode}
          onChange={(e) => { setShopCode(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
        >
          <option value="">ทุกร้านค้า</option>
          {shops.map((s) => (
            <option key={s.id} value={s.shops_code!}>{s.seller_name ?? s.shops_code}</option>
          ))}
        </select>

        <select
          value={orderStatus}
          onChange={(e) => { setOrderStatus(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
        >
          <option value="">ทุกสถานะ</option>
          {(statuses ?? []).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <input
          type="date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          title="วันที่สั่งซื้อ เริ่มต้น"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          title="วันที่สั่งซื้อ สิ้นสุด"
        />

        {fileId && (
          <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 rounded-lg text-sm">
            ไฟล์ #{fileId}
            <button onClick={() => { setFileId(''); setPage(1) }} className="hover:text-rose-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        )}

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
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Order ID</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">สินค้า</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Seller SKU</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ตัวเลือก</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">จำนวน</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ก่อนส่วนลด (฿)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ส่วนลด (฿)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ค่าส่ง (฿)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ยอดคำสั่งซื้อ (฿)</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ขนส่ง / Tracking</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ชำระเงิน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(14)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-5 py-12 text-center text-slate-400">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบรายการคำสั่งซื้อ
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const discount = Number(item.platform_discount ?? 0) + Number(item.seller_discount ?? 0)
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        <div>{fmtDate(item.created_time)}</div>
                        {item.paid_time && (
                          <div className="text-slate-400 text-[10px]">ชำระ {fmtDate(item.paid_time)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={item.order_status} />
                        {item.order_substatus && (
                          <div className="text-[10px] text-slate-500 mt-0.5">{item.order_substatus}</div>
                        )}
                        {item.cancel_reason && (
                          <div className="text-[10px] text-red-500 mt-0.5 max-w-[120px] truncate" title={item.cancel_reason}>{item.cancel_reason}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <p className="font-medium text-slate-700">{item.shop_name ?? '—'}</p>
                        <span className="font-mono text-[10px] text-rose-600">{item.shop_code}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-rose-700 whitespace-nowrap">
                        {item.order_id}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 max-w-[220px] truncate" title={item.product_name ?? ''}>
                        {item.product_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {item.seller_sku ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[140px] truncate" title={item.variation ?? ''}>
                        {item.variation || '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-700">
                        {item.quantity ?? '—'}
                        {item.return_quantity ? <span className="text-red-500 ml-1">(-{item.return_quantity})</span> : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AmountCell value={item.subtotal_before_discount} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {discount ? <span className="text-orange-600">-{fmtAmt(discount)}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AmountCell value={item.shipping_fee_after_discount} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        <AmountCell value={item.order_amount} />
                        {item.order_refund_amount != null && Number(item.order_refund_amount) !== 0 && (
                          <div className="text-[10px] text-red-500 font-normal">คืน {fmtAmt(item.order_refund_amount)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <p className="text-slate-700">{item.shipping_provider ?? '—'}</p>
                        {item.tracking_id && <span className="font-mono text-[10px] text-slate-500">{item.tracking_id}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {item.payment_method ?? '—'}
                      </td>
                    </tr>
                  )
                })
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
        ข้อมูลจากไฟล์ส่งออกคำสั่งซื้อ TikTok ผ่าน n8n · กรองตามวันที่สร้างคำสั่งซื้อ · คลิกแถวเพื่อดูรายละเอียด
      </p>

      {selected && <OrderLineDetail item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

export default function TikTokOrdersPage() {
  return (
    <Suspense>
      <TikTokOrdersContent />
    </Suspense>
  )
}
