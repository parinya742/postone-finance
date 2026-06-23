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
    <span className={isNeg ? 'text-red-600 font-medium' : 'text-slate-700'}>
      {fmtAmt(value)}
    </span>
  )
}

function TextCell({ value, mono = false }: { value: string | null; mono?: boolean }) {
  if (!value) return <span className="text-slate-300">—</span>
  return <span className={mono ? 'font-mono' : ''}>{value}</span>
}

const TH = ({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) => (
  <th className={`px-3 py-2.5 font-medium text-slate-600 whitespace-nowrap text-xs ${right ? 'text-right' : center ? 'text-center' : 'text-left'}`}>
    {children}
  </th>
)

const TD = ({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) => (
  <td className={`px-3 py-2 text-xs text-slate-700 ${right ? 'text-right' : center ? 'text-center' : ''}`}>
    {children}
  </td>
)

export default function ShopeeTransactionsPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [shopName, setShopName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [orderStartDate, setOrderStartDate] = useState('')
  const [orderEndDate, setOrderEndDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')

  const { data: shopsData } = useQuery<PaginatedResponse<ShopeeShop>>({
    queryKey: ['shopee-shops-all'],
    queryFn: () => api.get('/shopee/shops', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('shopee-shops.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<ShopeeTransaction>>({
    queryKey: ['shopee-transactions', search, page, shopName, startDate, endDate, orderStartDate, orderEndDate, paymentMethod],
    queryFn: () =>
      api.get('/shopee/transactions', {
        params: {
          search, page, per_page: 50,
          shop_name: shopName || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          order_start_date: orderStartDate || undefined,
          order_end_date: orderEndDate || undefined,
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
    setOrderStartDate('')
    setOrderEndDate('')
    setPaymentMethod('')
    setPage(1)
  }

  const hasFilter = !!(search || shopName || startDate || endDate || orderStartDate || orderEndDate || paymentMethod)

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

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 whitespace-nowrap">วันที่ payout</span>
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

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 whitespace-nowrap">วันที่สั่งซื้อ</span>
          <input
            type="date"
            value={orderStartDate}
            onChange={(e) => { setOrderStartDate(e.target.value); setPage(1) }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <span className="text-xs text-slate-400">–</span>
          <input
            type="date"
            value={orderEndDate}
            onChange={(e) => { setOrderEndDate(e.target.value); setPage(1) }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

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
          <table className="w-full text-xs" style={{ minWidth: '4200px' }}>
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <TH>ร้านค้า</TH>
                {/* B */ }<TH>หมายเลขคำสั่งซื้อ</TH>
                {/* C */ }<TH>รหัสคืนสินค้า</TH>
                {/* D */ }<TH>ชื่อผู้ใช้ (ผู้ซื้อ)</TH>
                {/* E */ }<TH>วันที่ทำการสั่งซื้อ</TH>
                {/* F */ }<TH>ช่องทางการชำระเงินของผู้ซื้อ</TH>
                {/* G */ }<TH center>Hot Listing</TH>
                {/* H */ }<TH>ช่องทางการชำระเงิน (รายละเอียด)</TH>
                {/* I */ }<TH>แผนการผ่อนชำระ</TH>
                {/* J */ }<TH center>ค่าธรรมเนียม (%)</TH>
                {/* K */ }<TH>วันที่โอนชำระเงินสำเร็จ</TH>
                {/* L */ }<TH right>สินค้าราคาปกติ</TH>
                {/* M */ }<TH right>ส่วนลดสินค้าจากผู้ขาย</TH>
                {/* N */ }<TH right>จำนวนเงินที่ทำการคืนให้ผู้ซื้อ</TH>
                {/* O */ }<TH right>ส่วนลดสินค้าที่ออกโดย Shopee</TH>
                {/* P */ }<TH right>โค้ดส่วนลดที่ออกโดยผู้ขาย</TH>
                {/* Q */ }<TH right>โค้ดส่วนลดร่วมที่ออกโดยผู้ขาย</TH>
                {/* R */ }<TH right>Coins Cashback ที่สนับสนุนโดยผู้ขาย</TH>
                {/* S */ }<TH right>Coins Cashback ร่วมที่สนับสนุนโดยผู้ขาย</TH>
                {/* T */ }<TH right>ค่าจัดส่งที่ชำระโดยผู้ซื้อ</TH>
                {/* U */ }<TH right>ค่าจัดส่งสินค้าที่ออกโดย Shopee</TH>
                {/* V */ }<TH right>ค่าจัดส่งที่ Shopee ชำระโดยชื่อของคุณ</TH>
                {/* W */ }<TH right>ค่าจัดส่งสินค้าคืน</TH>
                {/* X */ }<TH right>ค่าจัดส่งสินค้าคืนผู้ขาย</TH>
                {/* Y */ }<TH right>โปรแกรมประหยัดค่าจัดส่งคืนสินค้า</TH>
                {/* Z */ }<TH right>ค่าคอมมิชชั่น AMS</TH>
                {/* AA */}<TH right>ค่าคอมมิชชั่น</TH>
                {/* AB */}<TH right>ค่าบริการ</TH>
                {/* AC */}<TH right>ค่าธรรมเนียมโครงสร้างพื้นฐานแพลตฟอร์ม</TH>
                {/* AD */}<TH right>ค่าธรรมเนียม ของโปรแกรมประหยัดค่าจัดส่ง</TH>
                {/* AE */}<TH right>ค่าธุรกรรมการชำระเงิน</TH>
                {/* AF */}<TH right>ภาษี</TH>
                {/* AG */}<TH right>ค่าธรรมเนียมเติมเงินโฆษณาจากเงิน Escrow</TH>
                {/* AH */}<TH right>ค่าบริการติดตั้งที่ชำระโดยผู้ซื้อ</TH>
                {/* AI */}<TH right>ค่าบริการติดตั้งจริงจากผู้ให้บริการ</TH>
                {/* AJ */}<TH right>โบนัสส่วนลดเครื่องเก่าแลกใหม่จากผู้ขาย</TH>
                {/* AK */}<TH right>จำนวนเงินทั้งหมดที่โอนแล้ว (฿)</TH>
                {/* AL */}<TH>โค้ดส่วนลด</TH>
                {/* AM */}<TH right>ค่าชดเชยที่หายไป</TH>
                {/* AN */}<TH right>โปรโมชั่นค่าจัดส่งจากผู้ขาย</TH>
                {/* AO */}<TH>Shipping provider</TH>
                {/* AP */}<TH>ชื่อผู้ให้บริการขนส่ง</TH>
                {/* AR */}<TH right>เงินที่คืนไปยังผู้ซื้อ</TH>
                {/* AS */}<TH right>Shopee Coins ที่ใช้กับสินค้าที่ขอคืน</TH>
                {/* AT */}<TH right>โค้ดส่วนลด Shopee ที่ใช้กับสินค้าที่ขอคืน</TH>
                {/* AU */}<TH right>โปรโมชั่นบัตรเครดิตที่ใช้กับสินค้าที่ขอคืน 1</TH>
                {/* AV */}<TH right>โปรโมชั่นบัตรเครดิตที่ใช้กับสินค้าที่ขอคืน 2</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(47)].map((_, j) => (
                      <td key={j} className="px-3 py-2">
                        <div className="h-3 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={47} className="px-5 py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบรายการธุรกรรม
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.order_sn} className="hover:bg-slate-50 transition-colors">
                    <TD><span className="font-medium text-slate-800 whitespace-nowrap">{item.shop_name ?? '—'}</span></TD>
                    <TD><span className="font-mono text-orange-700">{item.order_sn}</span></TD>
                    <TD><TextCell value={item.return_sn} mono /></TD>
                    <TD><TextCell value={item.buyer_username} /></TD>
                    <TD><span className="whitespace-nowrap">{fmtDate(item.order_date)}</span></TD>
                    <TD><TextCell value={item.payment_method} /></TD>
                    <TD center><TextCell value={item.hot_listing} /></TD>
                    <TD>
                      <span className="max-w-[160px] truncate block" title={item.payment_detail ?? ''}>{item.payment_detail ?? '—'}</span>
                    </TD>
                    <TD><TextCell value={item.instalment_plan} /></TD>
                    <TD center><TextCell value={item.fee_pct} /></TD>
                    <TD><span className="whitespace-nowrap">{fmtDate(item.payout_date)}</span></TD>
                    <TD right><AmountCell value={item.original_price} /></TD>
                    <TD right><AmountCell value={item.seller_discount} /></TD>
                    <TD right><AmountCell value={item.refund_to_buyer} /></TD>
                    <TD right><AmountCell value={item.shopee_discount} /></TD>
                    <TD right><AmountCell value={item.seller_voucher} /></TD>
                    <TD right><AmountCell value={item.seller_cojoint_voucher} /></TD>
                    <TD right><AmountCell value={item.coins_cashback_seller} /></TD>
                    <TD right><AmountCell value={item.coins_cashback_cojoint} /></TD>
                    <TD right><AmountCell value={item.buyer_shipping_fee} /></TD>
                    <TD right><AmountCell value={item.shopee_shipping_subsidy} /></TD>
                    <TD right><AmountCell value={item.shopee_paid_shipping_on_behalf} /></TD>
                    <TD right><AmountCell value={item.return_shipping_fee} /></TD>
                    <TD right><AmountCell value={item.return_shipping_seller} /></TD>
                    <TD right><AmountCell value={item.return_shipping_program} /></TD>
                    <TD right><AmountCell value={item.ams_commission} /></TD>
                    <TD right><AmountCell value={item.commission_fee} /></TD>
                    <TD right><AmountCell value={item.service_fee} /></TD>
                    <TD right><AmountCell value={item.platform_infra_fee} /></TD>
                    <TD right><AmountCell value={item.free_shipping_program_fee} /></TD>
                    <TD right><AmountCell value={item.transaction_fee} /></TD>
                    <TD right><AmountCell value={item.tax} /></TD>
                    <TD right><AmountCell value={item.ads_escrow_topup} /></TD>
                    <TD right><AmountCell value={item.installation_fee_buyer} /></TD>
                    <TD right><AmountCell value={item.installation_fee_actual} /></TD>
                    <TD right><AmountCell value={item.trade_in_bonus} /></TD>
                    <TD right>
                      <span className="font-semibold text-green-700">{fmtAmt(item.total_payout)}</span>
                    </TD>
                    <TD><TextCell value={item.voucher_code} mono /></TD>
                    <TD right><AmountCell value={item.lost_compensation} /></TD>
                    <TD right><AmountCell value={item.seller_shipping_promo} /></TD>
                    <TD><TextCell value={item.shipping_provider} /></TD>
                    <TD><TextCell value={item.carrier_name} /></TD>
                    <TD right><AmountCell value={item.refund_to_buyer_return} /></TD>
                    <TD right><AmountCell value={item.coins_used_return} /></TD>
                    <TD right><AmountCell value={item.shopee_voucher_return} /></TD>
                    <TD right><AmountCell value={item.credit_promo_return1} /></TD>
                    <TD right><AmountCell value={item.credit_promo_return2} /></TD>
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
        ข้อมูลดึงจาก Shopee Income Payout Report · แสดงผลตามลำดับคอลัมน์ของ Excel
      </p>
    </div>
  )
}
