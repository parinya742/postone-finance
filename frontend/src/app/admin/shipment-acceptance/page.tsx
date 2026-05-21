'use client'

import api from '@/lib/api'
import { ShipmentAcceptanceJoin, ShipmentAcceptanceResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Lock, FileSpreadsheet, AlertTriangle, CheckCircle, GitMerge, Info, Download } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'
import * as XLSX from 'xlsx'

function fmtDate(d: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return String(d)
  return dt.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtDateOnly(d: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString('th-TH', { dateStyle: 'short' })
}

function fmtNum(n: number | null, decimals = 2) {
  if (n == null) return '—'
  return n.toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtKg(val: number | null) {
  if (val == null) return '—'
  const kg = val < 10 ? val : val / 1000
  return kg.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ฟังก์ชันแปลงน้ำหนักให้อยู่ในหน่วยกิโลกรัมเสมอ
function getKg(val: number | null) {
  if (val == null) return null
  // ถ้าค่าน้อยกว่า 10 ถือว่าเป็น Kg อยู่แล้ว (เช่น 0.0140)
  // ถ้ามากกว่า 10 ถือว่าเป็น กรัม ต้องหาร 1000 (เช่น 2348)
  return val < 10 ? val : val / 1000
}

// ฟังก์ชันสำหรับปัดทศนิยมจดหมายขึ้น 2 ตำแหน่ง (เช่น 0.0140 -> 0.02)
function calculateLetterKg(val: number | null) {
  if (val == null) return null
  const kg = getKg(val) as number
  // ป้องกันบั๊ก Float Precision ของ JS โดยใช้ Math.round ช่วยก่อนปัดเศษขึ้น
  return Math.ceil(Math.round(kg * 10000) / 100) / 100
}

// ฟังก์ชันสำหรับปัดเศษ EMS ขึ้นเป็นจำนวนเต็ม (เช่น 2.348 -> 3)
function calculateEmsKg(val: number | null) {
  if (val == null) return null
  const kg = getKg(val) as number
  return Math.ceil(kg)
}

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

function buildExcelRows(items: ShipmentAcceptanceJoin[]) {
  return items.map((item) => {
    // จัดการโลจิกน้ำหนักสำหรับ Export
    let excelKg: number | string = ''
    if (item.weight_grams != null) {
      if (item.dl_calculated_cost != null) {
        // จดหมาย: ปัดทศนิยมขึ้น 2 ตำแหน่ง
        excelKg = calculateLetterKg(item.weight_grams) as number
      } else if (item.ems_calculated_cost != null) {
        // EMS: แปลงเป็นกิโลกรัมแล้วปัดเศษขึ้นเป็นจำนวนเต็ม
        excelKg = calculateEmsKg(item.weight_grams) as number
      } else {
        // อื่นๆ ใช้การแปลงเป็นกิโลกรัมปกติ
        excelKg = item.weight_grams / 1000
      }
    }

    return {
      'Label ID': item.label_id,
      'ชื่อลูกค้า': item.customer_name ?? '',
      'รายละเอียดสินค้า': item.product_details ?? '',
      'PI Number': item.pi_number ?? '',
      'SO Number': item.so_number ?? '',
      'COD (เว็บ Postone)': item.ps_cod_amount ?? '',
      'จัดส่งโดย': item.shipping_by ?? '',
      'ค่าส่ง': item.shipping_cost ?? '',
      'Tracking No': item.barcode ?? '',
      'Due Date': item.due_date ?? '',
      'สถานะล่าสุด': item.latest_status ?? '',
      'ที่ทำการ': item.office_name ?? item.office_code ?? '',
      'TR Number': item.tr_number ?? '',
      'วันฝากส่ง': item.deposit_datetime ?? '',
      'ชื่อผู้รับ': item.recipient_name ?? '',
      'เบอร์ผู้รับ': item.recipient_phone ?? '',
      'รหัสปลายทาง': item.destination_code ?? '',
      'ชื่อปลายทาง': item.destination_name ?? '',
      'น้ำหนัก (g)': item.weight_grams ?? '',
      'น้ำหนัก (กก.)': excelKg,
      'บริการ': item.service_name ?? '',
      'ค่าบริการ': item.service_fee ?? '',
      'ค่าส่ง (คำนวณ)': item.dl_calculated_cost ?? item.ems_calculated_cost ?? '',
      'COD (ไฟล์ LINE)': item.thpa_cod_amount ?? '',
      'เบอร์ Wallet': item.wallet_phone ?? '',
    }
  })
}

export default function ShipmentAcceptancePage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [matchStatus, setMatchStatus] = useState('matched')
  const [serviceType, setServiceType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const resetPage = () => setPage(1)

  const params = { search, match_status: matchStatus, service_type: serviceType || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined, page, per_page: 20 }

  const { data, isLoading } = useQuery<ShipmentAcceptanceResponse>({
    queryKey: ['shipment-acceptance', search, matchStatus, serviceType, dateFrom, dateTo, page],
    queryFn: () =>
      api.get('/shipment-acceptance', { params }).then((r) => r.data),
    enabled: can('shipments.view'),
  })

  if (!can('shipments.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  async function handleExport() {
    setExporting(true)
    try {
      const exportParams = { search, match_status: matchStatus, service_type: serviceType || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined }
      const res = await api.get('/shipment-acceptance/export', { params: exportParams })
      const rows = buildExcelRows(res.data as ShipmentAcceptanceJoin[])
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Shipment Report')
      const date = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `shipment-acceptance-${date}.xlsx`)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  const items = data?.data ?? []
  const totalAll = data?.total_all ?? 0
  const matchedCount = data?.matched_count ?? 0
  const unmatchedCount = data?.unmatched_count ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-800">Data Reconciliation</h1>
          <div className="relative group flex items-center">
            <Info className="w-4 h-4 text-slate-400 hover:text-slate-650 cursor-pointer transition-colors" />
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block w-80 bg-slate-900 text-slate-100 text-xs rounded-lg py-2 px-3 shadow-xl z-20 pointer-events-none border border-slate-800 text-center font-normal leading-normal">
              เปรียบเทียบรายการจาก <span className="text-green-300 font-semibold">ข้อมูลไปรษณีย์ (ไฟล์บริการ)</span> กับข้อมูล <span className="text-blue-300 font-semibold">เว็บ Postone</span> โดยใช้ Barcode จับคู่ — แสดงว่ารายการไหนในไฟล์ LINE ยังไม่มีในระบบ Postone
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
            </div>
          </div>
        </div>
        <p className="text-slate-500 text-sm mt-1">ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} รายการ</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="p-2.5 bg-blue-50 rounded-lg">
            <GitMerge className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">รายการทั้งหมด (ไฟล์ LINE)</p>
            <p className="text-2xl font-bold text-slate-800">{totalAll > 0 ? totalAll.toLocaleString('th-TH') : '—'}</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="p-2.5 bg-green-50 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">พบในเว็บ Postone แล้ว</p>
            <p className="text-2xl font-bold text-green-700">{data ? matchedCount.toLocaleString('th-TH') : '—'}</p>
          </div>
        </div>
        <div className="bg-white border border-red-100 rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="p-2.5 bg-red-50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">ยังไม่พบในเว็บ Postone</p>
            <p className="text-2xl font-bold text-red-600">{data ? unmatchedCount.toLocaleString('th-TH') : '—'}</p>
          </div>
        </div>
      </div>

      {/* Filters + Export */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage() }}
            placeholder="Label ID, ชื่อลูกค้า, Tracking, TR No..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={matchStatus}
          onChange={(e) => { setMatchStatus(e.target.value); resetPage() }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">ทั้งหมด</option>
          <option value="matched">พบในเว็บ Postone</option>
          <option value="unmatched">ยังไม่พบในเว็บ Postone</option>
        </select>
        <select
          value={serviceType}
          onChange={(e) => { setServiceType(e.target.value); resetPage() }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">ทุกประเภทบริการ</option>
          <option value="EMS">EMS</option>
          <option value="จดหมาย">จดหมาย</option>
          <option value="พัสดุ">พัสดุ</option>
          <option value="ลงทะเบียน">ลงทะเบียน</option>
        </select>
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
        <button
          onClick={handleExport}
          disabled={exporting}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'กำลัง Export...' : 'Export Excel'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[2000px]">
          <thead>
            {/* Group headers */}
            <tr className="border-b border-slate-200">
              <GH label="" span={1} color="bg-slate-50 text-slate-400 border-slate-200" />
              <GH label="ข้อมูลไปรษณีย์ (ไฟล์บริการ)" span={12} color="bg-green-50 text-green-500 border-green-100" />
              <GH label="เว็บ Postone" span={10} color="bg-blue-50 text-blue-500 border-blue-100" />
            </tr>
            {/* Column headers */}
            <tr className="bg-slate-50 border-b border-slate-200">
              {/* Status */}
              <th className="px-2 py-3 bg-blue-50 border-x border-blue-100 text-center text-[10px] font-semibold text-blue-400 tracking-widest uppercase whitespace-nowrap"></th>

              {/* Thailand Post columns */}
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">TR Number</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">วันฝากส่ง</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ชื่อผู้รับ</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">เบอร์ผู้รับ</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">รหัสปลายทาง</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ชื่อปลายทาง</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">น้ำหนัก (g/Kg)</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">บริการ</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ค่าบริการ</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ค่าส่ง (คำนวณ)</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">เบอร์ Wallet</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ที่ทำการ</th>
              {/* Postone columns */}
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Label ID</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Product Details</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">PI NO</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">SO NO</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ชื่อลูกค้า</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Tracking No</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">COD</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">จัดส่งโดย</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">สถานะล่าสุด</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {[...Array(23)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={23} className="px-5 py-12 text-center text-slate-400">
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const hasPostone = item.label_id !== null || item.tracking_no !== null
                return (
                  <tr
                    key={item.barcode ?? item.tr_number}
                    className={clsx(
                      'hover:bg-slate-50 transition-colors',
                      !hasPostone && 'bg-red-50/40'
                    )}
                  >
                    {/* Divider */}
                    <td className="px-2 py-3 bg-blue-50 border-x border-blue-100">
                      {hasPostone ? (
                        <span className="flex justify-center">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        </span>
                      ) : (
                        <span className="flex justify-center">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        </span>
                      )}
                    </td>   
                    {/* Thailand Post columns */}
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{item.tr_number ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(item.deposit_datetime)}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{item.recipient_name ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.recipient_phone ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{item.destination_code ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{item.destination_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-right">
                      {item.dl_calculated_cost != null ? (
                        <span className="font-semibold text-blue-600">
                          {fmtNum(calculateLetterKg(item.weight_grams), 2)}
                        </span>
                      ) : item.ems_calculated_cost != null ? (
                        <span className="font-semibold text-orange-600">
                          {fmtNum(calculateEmsKg(item.weight_grams), 0)}
                        </span>
                      ) : (
                        <span className="text-slate-600">{fmtKg(item.weight_grams)}</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{item.service_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-right text-slate-700">{fmtNum(item.service_fee)}</td>
                    
                    <td className="px-4 py-3 text-xs text-right">
                      {item.dl_calculated_cost != null ? (
                        <span className="font-semibold text-blue-600">{fmtNum(item.dl_calculated_cost, 0)}</span>
                      ) : item.ems_calculated_cost != null ? (
                        <span className="font-semibold text-orange-600">{fmtNum(item.ems_calculated_cost, 0)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.wallet_phone ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{item.office_name ?? item.office_code ?? '—'}</td>
                    {/* Postone columns */}
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 whitespace-nowrap">{item.label_id ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{item.product_details ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{item.pi_number ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{item.so_number ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-700 max-w-[140px] truncate">{item.customer_name ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">{item.barcode}</td>
                    <td className="px-4 py-3 text-xs text-right text-slate-700">{item.ps_cod_amount ? `฿${item.ps_cod_amount}` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{item.shipping_by ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[140px] truncate">{item.latest_status ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDateOnly(item.due_date)}</td>
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
