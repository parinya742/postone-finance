'use client'

import api from '@/lib/api'
import { TikTokTransaction, TikTokShop, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Lock, Receipt, ExternalLink, Download } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import * as XLSX from 'xlsx'

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
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

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  SUCCESS:    'bg-green-100 text-green-700',
  FAILED:     'bg-red-100 text-red-700',
  PROCESSING: 'bg-yellow-100 text-yellow-700',
  CANCELLED:  'bg-slate-100 text-slate-600',
}

export default function TikTokTransactionsPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [shopName, setShopName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [txType, setTxType] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get('/tiktok/transactions', {
        params: {
          search: search || undefined,
          per_page: 50000,
          shop_name: shopName || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          transaction_type: txType || undefined,
          payment_status: paymentStatus || undefined,
        },
      })
      const fetchItems = res.data?.data ?? []
      if (fetchItems.length === 0) {
        alert('ไม่พบข้อมูลสำหรับส่งออก')
        return
      }

      const rows = fetchItems.map((item: TikTokTransaction) => ({
        'ร้านค้า': item.shop_name ?? item.seller_id ?? '',
        'หมายเลขคำสั่งซื้อ/การปรับ': item.order_id ?? '',
        'ประเภทธุรกรรม': item.transaction_type ?? '',
        'เวลาที่สร้างคำสั่งซื้อ': item.order_create_time ? new Date(item.order_create_time).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—',
        'เวลาที่ชำระคำสั่งซื้อ': item.order_paid_time ? new Date(item.order_paid_time).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—',
        'สกุลเงิน': item.currency ?? '',
        'จำนวนเงินที่ชำระทั้งหมด': item.total_payment_amount ?? '',
        'รายได้รวม': item.revenue_amount ?? '',
        'ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย': item.product_amount_after_seller_discount ?? '',
        'ยอดรวมค่าสินค้าก่อนหักส่วนลด': item.product_amount_before_discount ?? '',
        'ส่วนลดจากร้านค้า': item.seller_discount ?? '',
        'ยอดรวมเงินคืนหลังหักส่วนลดจากร้านค้า': item.refund_after_seller_discount ?? '',
        'ยอดรวมเงินคืนก่อนหักส่วนลดจากร้านค้า': item.refund_before_seller_discount ?? '',
        'เงินคืนจากส่วนลดร้านค้า': item.refund_seller_discount ?? '',
        'ค่าธรรมเนียมทั้งหมด': item.total_fee ?? '',
        'ค่าธรรมเนียมคำสั่งซื้อ': item.order_fee ?? '',
        'ค่าคอมมิชชั่น TikTok Shop': item.tiktok_commission ?? '',
        'การผ่อนชำระด้วยบัตรเครดิต': item.credit_card_installment ?? '',
        'ยอดรวมค่าจัดส่งที่ร้านค้าจ่ายจริง': item.seller_shipping_cost ?? '',
        'ค่าธรรมเนียมการจัดส่งจริง': item.actual_shipping_fee ?? '',
        'ส่วนลดค่าจัดส่งจากแพลตฟอร์ม': item.platform_shipping_discount ?? '',
        'ค่าธรรมเนียมการจัดส่งของลูกค้า': item.customer_shipping_fee ?? '',
        'ค่าจัดส่งสินค้าคืนตามจริง': item.return_shipping_fee ?? '',
        'เงินคืนสำหรับค่าจัดส่ง': item.shipping_refund ?? '',
        'เงินสนับสนุนการจัดส่ง': item.shipping_subsidy ?? '',
        'ค่าจัดส่งสินค้าที่แลกเปลี่ยน': item.exchange_shipping_fee ?? '',
        'ค่าจัดส่งสินค้าทดแทน': item.replacement_shipping_fee ?? '',
        'ค่าคอมมิชชั่นแอฟฟิลิเอต': item.affiliate_commission ?? '',
        'ค่าคอมมิชชั่นไม่ใช่แอฟฟิลิเอต (ก่อน PIT)': item.non_affiliate_commission_before_pit ?? '',
        'PIT จากคอมมิชชั่นแอฟฟิลิเอต': item.affiliate_commission_pit ?? '',
        'ค่าคอมมิชชั่นพาร์ทเนอร์แอฟฟิลิเอต': item.affiliate_partner_commission ?? '',
        'ค่าคอมมิชชั่นโฆษณาร้านค้าแอฟฟิลิเอต': item.affiliate_shop_ads_commission ?? '',
        'ค่าคอมมิชชั่นโฆษณาแอฟฟิลิเอต (ก่อน PIT)': item.affiliate_shop_ads_commission_before_pit ?? '',
        'PIT จากค่าคอมมิชชั่นโฆษณาแอฟฟิลิเอต': item.affiliate_shop_ads_commission_pit ?? '',
        'เงินมัดจำค่าคอมมิชชั่นแอฟฟิลิเอต': item.affiliate_commission_deposit ?? '',
        'การคืนเงินค่าคอมมิชชั่นแอฟฟิลิเอต': item.affiliate_commission_refund ?? '',
        'ค่าคอมมิชชั่นโฆษณาร้านค้าพาร์ทเนอร์': item.affiliate_partner_shop_ads_commission ?? '',
        'ค่าธรรมเนียม SFP': item.sfp_service_fee ?? '',
        'ค่าธรรมเนียมคืนเงินโบนัส': item.bonus_refund_service_fee ?? '',
        'ค่าบริการคูปองไลฟ์คุ้ม': item.live_coupon_service_fee ?? '',
        'ค่าบริการคูปอง Xtra': item.xtra_coupon_service_fee ?? '',
        'ค่าบริการ EAMS': item.eams_program_fee ?? '',
        'ค่าบริการแฟลชเซล': item.flash_sale_service_fee ?? '',
        'ค่าธรรมเนียม PayLater': item.paylater_fee ?? '',
        'ค่าธรรมเนียมสนับสนุนการเติบโต': item.shop_growth_support_fee ?? '',
        'ค่าธรรมเนียมโครงสร้างพื้นฐาน': item.infrastructure_fee ?? '',
        'ค่าทรัพยากรแคมเปญ': item.campaign_resource_fee ?? '',
        'ค่าธรรมเนียมพรีออเดอร์': item.preorder_fee ?? '',
        'คูปอง GMV Max': item.gmv_max_coupon ?? '',
        'ภาษีการขายคูปอง GMV Max': item.gmv_max_coupon_sales_tax ?? '',
        'ค่าโฆษณา GMV Max': item.gmv_max_ads_fee ?? '',
        'จำนวนการปรับยอด': item.adjustment_amount ?? '',
        'หมายเลขคำสั่งซื้อที่เกี่ยวข้อง': item.related_order_id ?? '',
        'การชำระเงินของลูกค้า': item.customer_payment ?? '',
        'การคืนเงินจากลูกค้า': item.customer_refund ?? '',
        'คูปองส่วนลดร่วมของผู้ขาย': item.seller_joint_coupon ?? '',
        'การคืนเงินคูปองส่วนลดร่วมผู้ขาย': item.seller_joint_coupon_refund ?? '',
        'ส่วนลดจากแพลตฟอร์ม': item.platform_discount ?? '',
        'การคืนเงินส่วนลดจากแพลตฟอร์ม': item.platform_discount_refund ?? '',
        'คูปองส่วนลดร่วมของแพลตฟอร์ม': item.platform_joint_coupon ?? '',
        'การคืนเงินคูปองส่วนลดร่วมแพลตฟอร์ม': item.platform_joint_coupon_refund ?? '',
        'ส่วนลดค่าจัดส่งจากร้านค้า': item.seller_shipping_discount ?? '',
        'น้ำหนักพัสดุโดยประมาณ': item.estimated_parcel_weight ?? '',
        'น้ำหนักที่เรียกเก็บเงิน': item.charged_weight ?? '',
        'รายละเอียดสินค้าที่ขายได้': item.product_details ?? '',
        'ธนาคารของลูกค้า': item.customer_bank ?? '',
        'หมายเลขใบแจ้งยอด': item.statement_id ?? '',
        'หมายเลขการชำระเงิน': item.payment_id ?? '',
        'สถานะการชำระเงิน': item.payment_status ?? '',
        'เวลาที่ชำระเงิน': item.payment_time ? new Date(item.payment_time).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—',
        'เวลาของใบแจ้งยอด': item.statement_time ? new Date(item.statement_time).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—',
        'ยอดขายสุทธิ': item.net_sales_amount ?? '',
        'ค่าธรรมเนียมรวมใบแจ้งยอด': item.fee_amount ?? '',
        'ยอดเงินสุทธิ (Settlement)': item.settlement_amount ?? '',
        'ค่าจัดส่งรวมใบแจ้งยอด': item.shipping_cost_amount ?? '',
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'TikTok Transactions')

      const dateStr = new Date().toISOString().slice(0, 10)
      const filename = `tiktok-transactions-${dateStr}.xlsx`
      XLSX.writeFile(wb, filename)

      api.post('/audit-logs', {
        action: 'export',
        target_type: 'tiktok-transactions',
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
            payment_status: paymentStatus || null,
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

  const { data: shopsData } = useQuery<PaginatedResponse<TikTokShop>>({
    queryKey: ['tiktok-shops-all'],
    queryFn: () => api.get('/tiktok/shops', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('tiktok-shops.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<TikTokTransaction>>({
    queryKey: ['tiktok-transactions', search, page, shopName, startDate, endDate, txType, paymentStatus],
    queryFn: () =>
      api.get('/tiktok/transactions', {
        params: {
          search: search || undefined,
          page,
          per_page: 50,
          shop_name: shopName || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          transaction_type: txType || undefined,
          payment_status: paymentStatus || undefined,
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
  const shops = shopsData?.data ?? []

  const resetFilters = () => {
    setSearch('')
    setShopName('')
    setStartDate('')
    setEndDate('')
    setTxType('')
    setPaymentStatus('')
    setPage(1)
  }

  const hasFilter = !!(search || shopName || startDate || endDate || txType || paymentStatus)

  const COLS = 76 // A-BW (75) + ร้านค้า

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-rose-500" />
            <h1 className="text-2xl font-bold text-slate-800">รายการธุรกรรม TikTok</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} รายการ
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'กำลังส่งออก...' : 'Export Excel'}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Order ID, Payment ID, Statement ID, สินค้า..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <select
          value={shopName}
          onChange={(e) => { setShopName(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
        >
          <option value="">ทุกร้านค้า</option>
          {shops.map((s) => (
            <option key={s.id} value={s.seller_name ?? s.seller_id}>{s.seller_name ?? s.seller_id}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 whitespace-nowrap">เวลาชำระ</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <span className="text-xs text-slate-400">–</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <input
          value={txType}
          onChange={(e) => { setTxType(e.target.value); setPage(1) }}
          placeholder="ประเภทธุรกรรม..."
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 min-w-[160px]"
        />

        <select
          value={paymentStatus}
          onChange={(e) => { setPaymentStatus(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
        >
          <option value="">ทุกสถานะ</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="PROCESSING">PROCESSING</option>
          <option value="FAILED">FAILED</option>
          <option value="CANCELLED">CANCELLED</option>
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
          <table className="w-full text-xs" style={{ minWidth: '6000px' }}>
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <TH>ร้านค้า</TH>
                {/* A */}<TH>หมายเลขคำสั่งซื้อ/การปรับ</TH>
                {/* B */}<TH>ประเภทธุรกรรม</TH>
                {/* C */}<TH>เวลาที่สร้างคำสั่งซื้อ</TH>
                {/* D */}<TH>เวลาที่ชำระคำสั่งซื้อ</TH>
                {/* E */}<TH center>สกุลเงิน</TH>
                {/* F */}<TH right>จำนวนเงินที่ชำระทั้งหมด</TH>
                {/* G */}<TH right>รายได้รวม</TH>
                {/* H */}<TH right>ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย</TH>
                {/* I */}<TH right>ยอดรวมค่าสินค้าก่อนหักส่วนลด</TH>
                {/* J */}<TH right>ส่วนลดจากร้านค้า</TH>
                {/* K */}<TH right>ยอดรวมเงินคืนหลังหักส่วนลดจากร้านค้า</TH>
                {/* L */}<TH right>ยอดรวมเงินคืนก่อนหักส่วนลดจากร้านค้า</TH>
                {/* M */}<TH right>เงินคืนจากส่วนลดร้านค้า</TH>
                {/* N */}<TH right>ค่าธรรมเนียมทั้งหมด</TH>
                {/* O */}<TH right>ค่าธรรมเนียมคำสั่งซื้อ</TH>
                {/* P */}<TH right>ค่าคอมมิชชั่น TikTok Shop</TH>
                {/* Q */}<TH right>การผ่อนชำระด้วยบัตรเครดิต</TH>
                {/* R */}<TH right>ยอดรวมค่าจัดส่งที่ร้านค้าจ่ายจริง</TH>
                {/* S */}<TH right>ค่าธรรมเนียมการจัดส่งจริง</TH>
                {/* T */}<TH right>ส่วนลดค่าจัดส่งจากแพลตฟอร์ม</TH>
                {/* U */}<TH right>ค่าธรรมเนียมการจัดส่งของลูกค้า</TH>
                {/* V */}<TH right>ค่าจัดส่งสินค้าคืนตามจริง</TH>
                {/* W */}<TH right>เงินคืนสำหรับค่าจัดส่ง</TH>
                {/* X */}<TH right>เงินสนับสนุนการจัดส่ง</TH>
                {/* Y */}<TH right>ค่าจัดส่งสินค้าที่แลกเปลี่ยน</TH>
                {/* Z */}<TH right>ค่าจัดส่งสินค้าทดแทน</TH>
                {/* AA */}<TH right>ค่าคอมมิชชั่นแอฟฟิลิเอต</TH>
                {/* AB */}<TH right>ค่าคอมมิชชั่นไม่ใช่แอฟฟิลิเอต (ก่อน PIT)</TH>
                {/* AC */}<TH right>PIT จากคอมมิชชั่นแอฟฟิลิเอต</TH>
                {/* AD */}<TH right>ค่าคอมมิชชั่นพาร์ทเนอร์แอฟฟิลิเอต</TH>
                {/* AE */}<TH right>ค่าคอมมิชชั่นโฆษณาร้านค้าแอฟฟิลิเอต</TH>
                {/* AF */}<TH right>ค่าคอมมิชชั่นโฆษณาแอฟฟิลิเอต (ก่อน PIT)</TH>
                {/* AG */}<TH right>PIT จากค่าคอมมิชชั่นโฆษณาแอฟฟิลิเอต</TH>
                {/* AH */}<TH right>เงินมัดจำค่าคอมมิชชั่นแอฟฟิลิเอต</TH>
                {/* AI */}<TH right>การคืนเงินค่าคอมมิชชั่นแอฟฟิลิเอต</TH>
                {/* AJ */}<TH right>ค่าคอมมิชชั่นโฆษณาร้านค้าพาร์ทเนอร์</TH>
                {/* AK */}<TH right>ค่าธรรมเนียม SFP</TH>
                {/* AL */}<TH right>ค่าธรรมเนียมคืนเงินโบนัส</TH>
                {/* AM */}<TH right>ค่าบริการคูปองไลฟ์คุ้ม</TH>
                {/* AN */}<TH right>ค่าบริการคูปอง Xtra</TH>
                {/* AO */}<TH right>ค่าบริการ EAMS</TH>
                {/* AP */}<TH right>ค่าบริการแฟลชเซล</TH>
                {/* AQ */}<TH right>ค่าธรรมเนียม PayLater</TH>
                {/* AR */}<TH right>ค่าธรรมเนียมสนับสนุนการเติบโต</TH>
                {/* AS */}<TH right>ค่าธรรมเนียมโครงสร้างพื้นฐาน</TH>
                {/* AT */}<TH right>ค่าทรัพยากรแคมเปญ</TH>
                {/* AU */}<TH right>ค่าธรรมเนียมพรีออเดอร์</TH>
                {/* AV */}<TH right>คูปอง GMV Max</TH>
                {/* AW */}<TH right>ภาษีการขายคูปอง GMV Max</TH>
                {/* AX */}<TH right>ค่าโฆษณา GMV Max</TH>
                {/* AZ */}<TH right>จำนวนการปรับยอด</TH>
                {/* BA */}<TH>หมายเลขคำสั่งซื้อที่เกี่ยวข้อง</TH>
                {/* BB */}<TH right>การชำระเงินของลูกค้า</TH>
                {/* BC */}<TH right>การคืนเงินจากลูกค้า</TH>
                {/* BD */}<TH right>คูปองส่วนลดร่วมของผู้ขาย</TH>
                {/* BE */}<TH right>การคืนเงินคูปองส่วนลดร่วมผู้ขาย</TH>
                {/* BF */}<TH right>ส่วนลดจากแพลตฟอร์ม</TH>
                {/* BG */}<TH right>การคืนเงินส่วนลดจากแพลตฟอร์ม</TH>
                {/* BH */}<TH right>คูปองส่วนลดร่วมของแพลตฟอร์ม</TH>
                {/* BI */}<TH right>การคืนเงินคูปองส่วนลดร่วมแพลตฟอร์ม</TH>
                {/* BJ */}<TH right>ส่วนลดค่าจัดส่งจากร้านค้า</TH>
                {/* BK */}<TH right>น้ำหนักพัสดุโดยประมาณ</TH>
                {/* BL */}<TH right>น้ำหนักที่เรียกเก็บเงิน</TH>
                {/* BM */}<TH>รายละเอียดสินค้าที่ขายได้</TH>
                {/* BN */}<TH>ธนาคารของลูกค้า</TH>
                {/* BO */}<TH>หมายเลขใบแจ้งยอด</TH>
                {/* BP */}<TH>หมายเลขการชำระเงิน</TH>
                {/* BQ */}<TH center>สถานะการชำระเงิน</TH>
                {/* BR */}<TH>เวลาที่ชำระเงิน</TH>
                {/* BS */}<TH>เวลาของใบแจ้งยอด</TH>
                {/* BT */}<TH right>ยอดขายสุทธิ</TH>
                {/* BU */}<TH right>ค่าธรรมเนียมรวมใบแจ้งยอด</TH>
                {/* BV */}<TH right>ยอดเงินสุทธิ (Settlement)</TH>
                {/* BW */}<TH right>ค่าจัดส่งรวมใบแจ้งยอด</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(COLS)].map((_, j) => (
                      <td key={j} className="px-3 py-2">
                        <div className="h-3 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={COLS} className="px-5 py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบรายการธุรกรรม
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <TD><span className="font-medium text-slate-800 whitespace-nowrap">{item.shop_name}</span></TD>
                    <TD><span className="font-mono text-blue-700">{item.order_id ?? '—'}</span></TD>
                    <TD><span className="max-w-[160px] truncate block" title={item.transaction_type ?? ''}>{item.transaction_type ?? '—'}</span></TD>
                    <TD><span className="whitespace-nowrap">{fmtDateTime(item.order_create_time)}</span></TD>
                    <TD><span className="whitespace-nowrap">{fmtDateTime(item.order_paid_time)}</span></TD>
                    <TD center><TextCell value={item.currency} /></TD>
                    <TD right><AmountCell value={item.total_payment_amount} /></TD>
                    <TD right><AmountCell value={item.revenue_amount} /></TD>
                    <TD right><AmountCell value={item.product_amount_after_seller_discount} /></TD>
                    <TD right><AmountCell value={item.product_amount_before_discount} /></TD>
                    <TD right><AmountCell value={item.seller_discount} /></TD>
                    <TD right><AmountCell value={item.refund_after_seller_discount} /></TD>
                    <TD right><AmountCell value={item.refund_before_seller_discount} /></TD>
                    <TD right><AmountCell value={item.refund_seller_discount} /></TD>
                    <TD right><AmountCell value={item.total_fee} /></TD>
                    <TD right><AmountCell value={item.order_fee} /></TD>
                    <TD right><AmountCell value={item.tiktok_commission} /></TD>
                    <TD right><AmountCell value={item.credit_card_installment} /></TD>
                    <TD right><AmountCell value={item.seller_shipping_cost} /></TD>
                    <TD right><AmountCell value={item.actual_shipping_fee} /></TD>
                    <TD right><AmountCell value={item.platform_shipping_discount} /></TD>
                    <TD right><AmountCell value={item.customer_shipping_fee} /></TD>
                    <TD right><AmountCell value={item.return_shipping_fee} /></TD>
                    <TD right><AmountCell value={item.shipping_refund} /></TD>
                    <TD right><AmountCell value={item.shipping_subsidy} /></TD>
                    <TD right><AmountCell value={item.exchange_shipping_fee} /></TD>
                    <TD right><AmountCell value={item.replacement_shipping_fee} /></TD>
                    <TD right><AmountCell value={item.affiliate_commission} /></TD>
                    <TD right><AmountCell value={item.non_affiliate_commission_before_pit} /></TD>
                    <TD right><AmountCell value={item.affiliate_commission_pit} /></TD>
                    <TD right><AmountCell value={item.affiliate_partner_commission} /></TD>
                    <TD right><AmountCell value={item.affiliate_shop_ads_commission} /></TD>
                    <TD right><AmountCell value={item.affiliate_shop_ads_commission_before_pit} /></TD>
                    <TD right><AmountCell value={item.affiliate_shop_ads_commission_pit} /></TD>
                    <TD right><AmountCell value={item.affiliate_commission_deposit} /></TD>
                    <TD right><AmountCell value={item.affiliate_commission_refund} /></TD>
                    <TD right><AmountCell value={item.affiliate_partner_shop_ads_commission} /></TD>
                    <TD right><AmountCell value={item.sfp_service_fee} /></TD>
                    <TD right><AmountCell value={item.bonus_refund_service_fee} /></TD>
                    <TD right><AmountCell value={item.live_coupon_service_fee} /></TD>
                    <TD right><AmountCell value={item.xtra_coupon_service_fee} /></TD>
                    <TD right><AmountCell value={item.eams_program_fee} /></TD>
                    <TD right><AmountCell value={item.flash_sale_service_fee} /></TD>
                    <TD right><AmountCell value={item.paylater_fee} /></TD>
                    <TD right><AmountCell value={item.shop_growth_support_fee} /></TD>
                    <TD right><AmountCell value={item.infrastructure_fee} /></TD>
                    <TD right><AmountCell value={item.campaign_resource_fee} /></TD>
                    <TD right><AmountCell value={item.preorder_fee} /></TD>
                    <TD right><AmountCell value={item.gmv_max_coupon} /></TD>
                    <TD right><AmountCell value={item.gmv_max_coupon_sales_tax} /></TD>
                    <TD right><AmountCell value={item.gmv_max_ads_fee} /></TD>
                    <TD right><AmountCell value={item.adjustment_amount} /></TD>
                    <TD><TextCell value={item.related_order_id} mono /></TD>
                    <TD right><AmountCell value={item.customer_payment} /></TD>
                    <TD right><AmountCell value={item.customer_refund} /></TD>
                    <TD right><AmountCell value={item.seller_joint_coupon} /></TD>
                    <TD right><AmountCell value={item.seller_joint_coupon_refund} /></TD>
                    <TD right><AmountCell value={item.platform_discount} /></TD>
                    <TD right><AmountCell value={item.platform_discount_refund} /></TD>
                    <TD right><AmountCell value={item.platform_joint_coupon} /></TD>
                    <TD right><AmountCell value={item.platform_joint_coupon_refund} /></TD>
                    <TD right><AmountCell value={item.seller_shipping_discount} /></TD>
                    <TD right><AmountCell value={item.estimated_parcel_weight} /></TD>
                    <TD right><AmountCell value={item.charged_weight} /></TD>
                    <TD><span className="max-w-[200px] truncate block text-slate-500" title={item.product_details ?? ''}>{item.product_details ?? '—'}</span></TD>
                    <TD><TextCell value={item.customer_bank} /></TD>
                    <TD><span className="font-mono text-slate-600">{item.statement_id ?? '—'}</span></TD>
                    <TD><span className="font-mono text-slate-600">{item.payment_id ?? '—'}</span></TD>
                    <TD center>
                      {item.payment_status ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_STATUS_COLORS[item.payment_status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {item.payment_status}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </TD>
                    <TD><span className="whitespace-nowrap">{fmtDateTime(item.payment_time)}</span></TD>
                    <TD><span className="whitespace-nowrap">{fmtDateTime(item.statement_time)}</span></TD>
                    <TD right><AmountCell value={item.net_sales_amount} /></TD>
                    <TD right><AmountCell value={item.fee_amount} /></TD>
                    <TD right>
                      <span className="font-semibold text-green-700">{fmtAmt(item.settlement_amount)}</span>
                    </TD>
                    <TD right><AmountCell value={item.shipping_cost_amount} /></TD>
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
        ข้อมูลดึงจาก TikTok Shop Finance · แสดงผลตามลำดับคอลัมน์ของ Excel
      </p>
    </div>
  )
}
