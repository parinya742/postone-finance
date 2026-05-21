'use client'

import api from '@/lib/api'
import { LineSoJoin, PaginatedResponse, PostoneAccountType } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Lock, FileSpreadsheet, AlertTriangle, Download } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'
import * as XLSX from 'xlsx'

const COL_COUNT = 27

function fmtDate(d: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return String(d)
  return dt.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtNum(n: number | null, decimals = 2) {
  if (n == null) return '—'
  return n.toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtKg(grams: number | null) {
  if (grams == null) return '—'
  return (grams / 1000).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Group header cell
function GH({ label, span, color }: { label: string; span: number; color: string }) {
  return (
    <th
      colSpan={span}
      className={clsx('px-3 py-1.5 text-center text-[10px] font-semibold tracking-widest uppercase border-x', color)}
    >
      {label}
    </th>
  )
}

function buildExcelRows(items: LineSoJoin[]) {
  return items.map((item) => ({
    'วันฝากส่ง': item.deposit_datetime ?? '',
    'Barcode': item.barcode ?? '',
    'รหัสปลายทาง': item.destination_code ?? '',
    'ชื่อปลายทาง': item.destination_name ?? '',
    'น้ำหนัก (g)': item.weight_grams ?? '',
    'บริการ': item.service_name ?? '',
    'ค่าบริการ': item.service_fee ?? '',
    'SO Date': item.SODate ?? '',
    'SO No': item.SoNo ?? '',
    'PI No': item.PINo ? item.PINo : (item.account_type_name ? `ไม่พบ (${item.account_type_name})` : 'ไม่พบ'),
    'DI No': item.DINo ?? '',
    'PO No': item.PONo ?? '',
    'รหัสลูกค้า': item.CustID ?? '',
    'ชื่อลูกค้า': item.CustName ?? '',
    'จำนวน': item.NumOfItem ?? '',
    'รหัสเซลล์': item.FieldSaleID ?? '',
    'ชื่อเซลล์': item.FieldSaleName ?? '',
    'Area': item.Area ?? '',
    'CreateBy': item.CreateBy ?? '',
    'ชื่อผู้สร้าง': item.CreateByName ?? '',
    'Doc Remark': item.DocRemark ?? '',
    'ACC Remark': item.ACCRemark ?? '',
    'ชื่อผู้รับ': item.customer_name ?? '',
    'สินค้า': item.product_details ?? '',
    'น้ำหนัก (กก.)': item.weight_grams ? (item.weight_grams / 1000) : '',
    'ค่าขนส่ง': item.service_fee ?? '',
    'อัตราพื้นที่พิเศษ': item.special_zone_rate ?? '',
  }))
}

export default function LineSoPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [noIscode, setNoIscode] = useState(false)
  const [noPiNumber, setNoPiNumber] = useState(false)
  const [area, setArea] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const resetPage = () => setPage(1)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get('/iscode/line-so/export', { params: { search, date_from: dateFrom || undefined, date_to: dateTo || undefined, no_iscode: noIscode ? 1 : undefined, no_pi_number: noPiNumber ? 1 : undefined, area: area || undefined } })
      const rows = buildExcelRows(res.data as LineSoJoin[])
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Line SO Report')
      const date = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `line-so-${date}.xlsx`)
    } catch (err) {
      console.error(err)
    } finally {
      setExporting(false)
    }
  }

  const { data, isLoading } = useQuery<PaginatedResponse<LineSoJoin>>({
    queryKey: ['line-so', search, dateFrom, dateTo, noIscode, noPiNumber, area, page],
    queryFn: () =>
      api.get('/iscode/line-so', { params: { search, date_from: dateFrom || undefined, date_to: dateTo || undefined, no_iscode: noIscode ? 1 : undefined, no_pi_number: noPiNumber ? 1 : undefined, area: area || undefined, page, per_page: 15 } }).then((r) => r.data),
    enabled: can('line-so.view'),
  })

  const { data: accountTypes } = useQuery<PaginatedResponse<PostoneAccountType>>({
    queryKey: ['account-types-all'],
    queryFn: () => api.get('/account-types', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('line-so.view'),
  })

  if (!can('line-so.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const items = data?.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ตรวจสอบข้อมูลไปรษณีย์ (Report)</h1>
        <p className="text-slate-500 text-sm mt-1">
          ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} รายการ · ตรวจสอบข้อมูลไปรษณีย์ ผ่าน PINo SoNo
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage() }}
            placeholder="Barcode, PI No, SO No, PO No, ชื่อลูกค้า..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">วันฝากส่ง</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); resetPage() }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-slate-400 text-sm">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); resetPage() }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={area}
          onChange={(e) => { setArea(e.target.value); resetPage() }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">ทุก Area</option>
          <optgroup label="ข้อมูล ISCODE">
            <option value="BKK">BKK</option>
            <option value="UPC">UPC</option>
            <option value="MT">MT</option>
            <option value="ช่าง">ช่าง</option>
            <option value="เคลมสินค้า Customer Service">เคลมสินค้า Customer Service</option>
            <option value="PRODUCT SPECIALIST">PRODUCT SPECIALIST</option>
            <option value="แผนกการตลาดออนไลน์เบิกสินค้าตัวอย่าง">แผนกการตลาดออนไลน์เบิกสินค้าตัวอย่าง</option>
            <option value="แผนกการตลาดออนไลน์(เคลมสินค้า)">แผนกการตลาดออนไลน์(เคลมสินค้า)</option>
            <option value="แผนกการตลาด Branding Media">แผนกการตลาด Branding Media</option>
            <option value="แผนกการตลาดเบิกสินค้าตัวอย่าง">แผนกการตลาดเบิกสินค้าตัวอย่าง</option>
            <option value="ผู้บริหารเบิกสินค้า">ผู้บริหารเบิกสินค้า</option>
          </optgroup>
          {accountTypes?.data && accountTypes.data.length > 0 && (
            <optgroup label="Account Type (ไม่มีข้อมูล ISCODE)">
              {accountTypes.data.map((at) => (
                <option key={at.id} value={at.name}>
                  {at.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          onClick={() => { setNoPiNumber((v) => !v); resetPage() }}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
            noPiNumber
              ? 'bg-red-50 border-red-400 text-red-700 hover:bg-red-100'
              : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
          )}
        >
          <AlertTriangle className="w-4 h-4" />
          ไม่พบ PI No
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'กำลัง Export...' : 'Export Excel'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: '2400px' }}>
          <thead>
            {/* Group headers */}
            <tr className="border-b border-slate-200">
              <GH label="ข้อมูลไปรษณีย์จากไฟล์บริการ" span={7} color="bg-green-50 text-green-500 border-green-100" />
              <GH label="ISCODE" span={15} color="bg-violet-50 text-violet-500 border-violet-100" />
              <GH label="ระบบไปรษณีย์" span={2} color="bg-blue-50 text-blue-400 border-blue-100" />
              <GH label="ข้อมูลไปรษณีย์จากไฟล์บริการ" span={2} color="bg-green-50 text-green-500 border-green-100" />
              <GH label="พื้นที่พิเศษ" span={1} color="bg-orange-50 text-orange-500 border-orange-100" />
            </tr>
            {/* Column headers */}
            <tr className="bg-slate-50 border-b border-slate-200">
              {/* LINE group 1 */}
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">วันฝากส่ง</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Barcode</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">รหัสปลายทาง</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ชื่อปลายทาง</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">น้ำหนัก (g)</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">บริการ</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ค่าบริการ</th>
              {/* ISCODE group */}
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">SO Date</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">SO No</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">PI No</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">DI No</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">PO No</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">รหัสลูกค้า</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ชื่อลูกค้า</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">จำนวน</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">รหัสเซลล์</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ชื่อเซลล์</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Area</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">CreateBy</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ชื่อผู้สร้าง</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Doc Remark</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ACC Remark</th>
              {/* Postone group */}
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ชื่อผู้รับ</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">สินค้า</th>
              {/* LINE group 2 */}
              <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">น้ำหนัก (กก.)</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ค่าขนส่ง</th>
              {/* Special Zone group */}
              <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">อัตราพื้นที่พิเศษ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {[...Array(COL_COUNT)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={COL_COUNT} className="px-5 py-12 text-center text-slate-400">
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const hasIscode = item.PINo !== null
                return (
                  <tr
                    key={`${item.barcode ?? ''}-${idx}`}
                    className={clsx(
                      'hover:bg-slate-50 transition-colors',
                      !hasIscode && 'bg-amber-50/40'
                    )}
                  >
                    {/* LINE group 1 */}
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(item.deposit_datetime)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-green-700 whitespace-nowrap">{item.barcode}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{item.destination_code ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{item.destination_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-right text-slate-600">{fmtNum(item.weight_grams, 0)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{item.service_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-right text-slate-700">{fmtNum(item.service_fee)}</td>
                    {/* ISCODE group */}
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(item.SODate)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-violet-700 whitespace-nowrap">{item.SoNo ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-violet-700 whitespace-nowrap">
                      {item.PINo ?? (
                        <span className="text-amber-500 flex items-center gap-1">
                          {/* <AlertTriangle className="w-3 h-3" /> {item.account_type_name ? `ไม่พบ (${item.account_type_name})` : 'ไม่พบ'} */}
                          <AlertTriangle className="w-3 h-3" /> ไม่พบ
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{item.DINo ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{item.PONo ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{item.CustID ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-800 max-w-[160px] truncate">{item.CustName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-right text-slate-600">{item.NumOfItem ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{item.FieldSaleID ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{item.FieldSaleName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">{item.Area ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{item.CreateBy ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{item.CreateByName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">{item.DocRemark ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">{item.ACCRemark ?? '—'}</td>
                    {/* Postone group */}
                    <td className="px-4 py-3 text-xs text-slate-700 max-w-[140px] truncate">
                      {item.customer_name ?? (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[160px] truncate">{item.product_details ?? '—'}</td>
                    {/* LINE group 2 */}
                    <td className="px-4 py-3 text-xs text-right text-slate-600">{fmtKg(item.weight_grams)}</td>
                    <td className="px-4 py-3 text-xs text-right text-slate-700">{fmtNum(item.service_fee)}</td>
                    {/* Special Zone group */}
                    <td className="px-4 py-3 text-xs text-right font-semibold text-orange-700">
                      {item.special_zone_rate != null ? fmtNum(item.special_zone_rate, 0) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

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
    </div>
  )
}
