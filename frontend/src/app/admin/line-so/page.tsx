'use client'

import api from '@/lib/api'
import { LineSoJoin, PaginatedResponse, PostoneAccountType } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Search, Lock, FileSpreadsheet, AlertTriangle, Download, Copy, Check, ChevronsUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'
import * as XLSX from 'xlsx'
import {
  createColumnHelper, flexRender,
  getCoreRowModel, getSortedRowModel, useReactTable,
  type SortingState, type ColumnDef,
} from '@tanstack/react-table'

// ── Area combobox ─────────────────────────────────────────────────────────────

const ISCODE_AREAS = [
  'TT BKK', 'TT UPC', 'MT', 'YP',
  'Claim & Customer Service', 'Product Special list',
  'ONL เบิกสินค้าตัวอย่าง', 'ONL เคลมสินค้า',
  'MKT', 'MKT เบิกสินค้าตัวอย่าง', 'CEO เบิกสินค้าตัวอย่าง',
  'Aftersale service',
]

function AreaCombobox({
  value, onChange, fieldSaleAreas, accountTypeNames,
}: {
  value: string; onChange: (v: string) => void
  fieldSaleAreas?: string[]; accountTypeNames?: string[]
}) {
  const [inputVal, setInputVal] = useState(value)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setInputVal(value) }, [value])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setInputVal(value)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [value])

  const q = inputVal.toLowerCase()
  const filtered = {
    iscode:      ISCODE_AREAS.filter(a => a.toLowerCase().includes(q)),
    fieldSale:   (fieldSaleAreas ?? []).filter(a => a.toLowerCase().includes(q)),
    accountType: (accountTypeNames ?? []).filter(a => a.toLowerCase().includes(q)),
  }
  const hasResults = filtered.iscode.length > 0 || filtered.fieldSale.length > 0 || filtered.accountType.length > 0

  function select(v: string) { onChange(v); setInputVal(v); setOpen(false) }

  const itemCls = (v: string) =>
    clsx('block w-full text-left px-4 py-1.5 text-sm hover:bg-[#EBF5FE] transition-colors',
      value === v && 'bg-[#EBF5FE] text-[#0070F2] font-medium')
  const groupCls = 'sticky top-0 px-3 py-1 text-[10px] font-semibold text-[#6A6D70] uppercase tracking-wider bg-[#F5F5F5] border-b border-[#EBEBEB]'

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center border border-[#89919A] rounded bg-white focus-within:border-[#0070F2] focus-within:ring-1 focus-within:ring-[#0070F2]">
        <input
          value={inputVal}
          onChange={(e) => { setInputVal(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="ทุก Area"
          className="flex-1 px-3 py-2 text-sm text-[#32363A] placeholder:text-[#6A6D70] bg-transparent outline-none min-w-[120px]"
        />
        {value && (
          <button onMouseDown={(e) => { e.preventDefault(); select('') }} className="px-2 text-[#89919A] hover:text-[#32363A] text-lg leading-none">×</button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 bg-white border border-[#EBEBEB] rounded shadow-lg max-h-72 overflow-y-auto">
          {!q && <button onClick={() => select('')} className={itemCls('')}>ทุก Area</button>}
          {filtered.iscode.length > 0 && (
            <><div className={groupCls}>ข้อมูล ISCODE</div>{filtered.iscode.map(a => <button key={a} onClick={() => select(a)} className={itemCls(a)}>{a}</button>)}</>
          )}
          {filtered.fieldSale.length > 0 && (
            <><div className={groupCls}>ชื่อเซลล์ (กรณีอื่นๆ)</div>{filtered.fieldSale.map(a => <button key={a} onClick={() => select(a)} className={itemCls(a)}>{a}</button>)}</>
          )}
          {filtered.accountType.length > 0 && (
            <><div className={groupCls}>Account Type</div>{filtered.accountType.map(a => <button key={a} onClick={() => select(a)} className={itemCls(a)}>{a}</button>)}</>
          )}
          {!hasResults && <div className="px-4 py-3 text-sm text-[#6A6D70]">ไม่พบ Area</div>}
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hidesSpecialZone(serviceName: string | null | undefined) {
  const svc = serviceName ?? ''
  return svc.includes('ขนาดใหญ่') || svc.includes('จดหมายในประเทศ - ซอง')
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  // Strip time part so "2026-06-29T8:22:05" (missing leading zero) still parses
  const datePart = d.includes('T') ? d.split('T')[0] : d.split(' ')[0]
  const [y, m, day] = datePart.split('-').map(Number)
  if (!y || !m || !day) return d
  return new Date(y, m - 1, day).toLocaleDateString('th-TH', { dateStyle: 'short' })
}

function fmtNum(n: number | null, decimals = 2) {
  if (n == null) return '—'
  return n.toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtKg(val: number | null) {
  if (val == null) return '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getKg(val: number | null) {
  return val
}

function calculateLetterKg(val: number | null) {
  if (val == null) return null
  const kg = getKg(val) as number
  return Math.ceil(Math.round(kg * 10000) / 100) / 100
}

function calculateEmsKg(val: number | null) {
  if (val == null) return null
  const kg = getKg(val) as number
  return Math.ceil(kg)
}

// ── Small components ──────────────────────────────────────────────────────────

function GH({ label, span, color }: { label: string; span: number; color: string }) {
  return (
    <th colSpan={span} className={clsx('px-3 py-1.5 text-center text-[10px] font-semibold tracking-widest uppercase border-x', color)}>
      {label}
    </th>
  )
}

function CopyCell({ value, className }: { value: string | null | undefined; className?: string }) {
  const [copied, setCopied] = useState(false)
  if (!value) return <span className="text-slate-300">—</span>
  function handleClick() {
    const text = value as string
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
    } else {
      const el = document.createElement('textarea')
      el.value = text; el.style.position = 'fixed'; el.style.opacity = '0'
      document.body.appendChild(el); el.select(); document.execCommand('copy')
      document.body.removeChild(el); setCopied(true); setTimeout(() => setCopied(false), 1500)
    }
  }
  return (
    <button onClick={handleClick} title="คลิกเพื่อคัดลอก" className={clsx('group flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer', className)}>
      <span>{value}</span>
      {copied ? <Check className="w-3 h-3 text-green-500 shrink-0" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-40 shrink-0 transition-opacity" />}
    </button>
  )
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc')  return <ArrowUp className="w-3 h-3 text-[#0070F2] shrink-0" />
  if (sorted === 'desc') return <ArrowDown className="w-3 h-3 text-[#0070F2] shrink-0" />
  return <ChevronsUpDown className="w-3 h-3 text-[#C0C5CC] shrink-0" />
}

// ── Excel helpers ─────────────────────────────────────────────────────────────

function buildSummarySheet(items: LineSoJoin[]) {
  const total = items.length
  const found = items.filter((i) => i.PINo !== null).length
  const notFound = total - found

  let totalWeightG = 0, totalServiceFee = 0, totalWeightKg = 0, totalTransport = 0, totalSpecialZone = 0
  for (const i of items) {
    totalWeightG += Number(i.weight_grams ?? 0)
    totalServiceFee += Number(i.service_fee ?? 0)
    const g = Number(i.weight_grams ?? 0)
    if (g) {
      if (i.dl_calculated_cost != null) totalWeightKg += calculateLetterKg(g) ?? 0
      else if (i.ems_calculated_cost != null) totalWeightKg += calculateEmsKg(g) ?? 0
      else totalWeightKg += g
    }
    totalTransport += Number(i.dl_calculated_cost ?? i.ems_calculated_cost ?? i.service_fee ?? 0)
    if (!hidesSpecialZone(i.service_name)) totalSpecialZone += Number(i.special_zone_rate ?? 0)
  }
  const totalDiff = totalServiceFee - totalTransport - totalSpecialZone

  const areaMap = new Map<string, { count: number; found: number; serviceFee: number; transport: number; diff: number }>()
  for (const i of items) {
    const area = i.Area ?? '(ไม่ระบุ Area)'
    if (!areaMap.has(area)) areaMap.set(area, { count: 0, found: 0, serviceFee: 0, transport: 0, diff: 0 })
    const row = areaMap.get(area)!
    row.count++; if (i.PINo !== null) row.found++
    row.serviceFee += Number(i.service_fee ?? 0)
    const t = Number(i.dl_calculated_cost ?? i.ems_calculated_cost ?? i.service_fee ?? 0)
    const spz = hidesSpecialZone(i.service_name) ? 0 : Number(i.special_zone_rate ?? 0)
    row.transport += t; row.diff += Number(i.service_fee ?? 0) - t - spz
  }

  const exportDate = new Date().toLocaleDateString('th-TH', { dateStyle: 'short' })
  const aoa: unknown[][] = [
    ['รายงานสรุป — Line SO Report'], ['วันที่ Export', exportDate], [],
    ['จำนวนรายการ', ''], ['รายการทั้งหมด', total],
    ['พบข้อมูล ISCODE (มี PINo)', found], ['ไม่พบข้อมูล ISCODE (ไม่มี PINo)', notFound], [],
    ['ผลรวมตัวเลข (ทุกรายการ)', ''], ['น้ำหนัก (g) Before', totalWeightG],
    ['ค่าบริการ Before', totalServiceFee], ['น้ำหนัก (กก.)', Math.round(totalWeightKg * 100) / 100],
    ['ค่าขนส่ง (คำนวณ)', totalTransport], ['อัตราพื้นที่พิเศษ', totalSpecialZone],
    ['Diff (ค่าบริการ Before − ค่าขนส่ง − พื้นที่พิเศษ)', totalDiff], [],
    ['สรุปแยกตาม Area'],
    ['Area', 'รายการทั้งหมด', 'พบ ISCODE', 'ไม่พบ ISCODE', 'ค่าบริการ Before', 'ค่าขนส่ง (คำนวณ)', 'Diff'],
    ...[...areaMap.entries()].sort((a, b) => b[1].count - a[1].count)
      .map(([area, d]) => [area, d.count, d.found, d.count - d.found, d.serviceFee, d.transport, d.diff]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 16 }]
  return ws
}

function buildExcelRows(items: LineSoJoin[]) {
  return items.map((item) => {
    let excelKg: number | string = ''
    if (item.weight_grams != null) {
      if (item.dl_calculated_cost != null) excelKg = calculateLetterKg(item.weight_grams) as number
      else if (item.ems_calculated_cost != null) excelKg = calculateEmsKg(item.weight_grams) as number
      else excelKg = item.weight_grams
    }
    const transport = item.dl_calculated_cost ?? item.ems_calculated_cost ?? item.service_fee ?? null
    const before = item.service_fee ?? null
    const spz = hidesSpecialZone(item.service_name) ? 0 : Number(item.special_zone_rate ?? 0)
    const diff = transport != null && before != null ? Number(before) - Number(transport) - spz : ''
    return {
      'วันฝากส่ง': fmtDate(item.deposit_datetime),
      'Barcode': item.barcode ?? '',
      'รหัสปลายทาง': item.destination_code ?? '',
      'ชื่อปลายทาง': item.destination_name ?? '',
      'น้ำหนัก(g) Before': item.weight_grams ?? '',
      'บริการ': item.service_name ?? '',
      'ค่าบริการ Before': item.service_fee ?? '',
      'PI No': item.PINo ? item.PINo : (item.account_type_name ? `ไม่พบ (${item.account_type_name})` : 'ไม่พบ'),
      'DI No': item.DINo ?? '', 'PO No': item.PONo ?? '',
      'รหัสลูกค้า': item.CustID ?? '', 'ชื่อลูกค้า': item.CustName ?? '',
      'รหัสเซลล์': item.FieldSaleID ?? '', 'ชื่อเซลล์': item.FieldSaleName ?? '',
      'Doc Remark': item.DocRemark ?? '', 'Area': item.Area ?? '',
      'แผนกที่ส่ง': item.account_type_name ?? '',
      'ชื่อผู้รับ': item.customer_name ?? '', 'สินค้า': item.product_details ?? '',
      'น้ำหนัก (กก.)': excelKg,
      'ค่าขนส่ง': item.dl_calculated_cost ?? item.ems_calculated_cost ?? item.service_fee ?? '',
      'อัตราพื้นที่พิเศษ': hidesSpecialZone(item.service_name) ? '' : (item.special_zone_rate ?? ''), 'Diff': diff,
    }
  })
}

// ── TanStack Table setup ──────────────────────────────────────────────────────

type ColMeta = { align?: 'left' | 'right' }
type TableMeta = { sumCols: Set<string>; toggleSum: (col: string) => void }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SumBtn({ col, table }: { col: string; table: any }) {
  const { sumCols, toggleSum } = table.options.meta as TableMeta
  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggleSum(col) }}
      title={sumCols.has(col) ? 'ซ่อนผลรวม' : 'แสดงผลรวม'}
      className={clsx('font-bold transition-colors', sumCols.has(col) ? 'text-[#0070F2]' : 'text-[#C0C1C2] hover:text-[#6A6D70]')}
    >
      Σ
    </button>
  )
}

const ch = createColumnHelper<LineSoJoin>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COLUMNS: ColumnDef<LineSoJoin, any>[] = [
  // ── GROUP 1: ข้อมูลไปรษณีย์ (7 cols) ─────────────────────────────────────
  ch.accessor('deposit_datetime', {
    header: 'วันฝากส่ง', size: 110,
    cell: i => <span className="text-xs text-[#6A6D70] whitespace-nowrap">{fmtDate(i.getValue())}</span>,
  }),
  ch.accessor('barcode', {
    header: 'Barcode', size: 160,
    cell: i => <CopyCell value={i.getValue()} className="font-mono text-[#107E3E] text-xs" />,
  }),
  ch.accessor('destination_code', {
    header: 'รหัสปลายทาง', size: 100,
    cell: i => <span className="text-xs text-[#6A6D70] whitespace-nowrap">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('destination_name', {
    header: 'ชื่อปลายทาง', size: 140,
    cell: i => <span className="text-xs whitespace-nowrap">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('weight_grams', {
    header: ({ table }) => <span className="inline-flex items-center justify-end gap-1">น้ำหนัก(g) Before<SumBtn col="weight_grams" table={table} /></span>,
    size: 130, meta: { align: 'right' } satisfies ColMeta,
    cell: i => <span className="text-xs">{fmtNum(i.getValue(), 0)}</span>,
  }),
  ch.accessor('service_name', {
    header: 'บริการ', size: 90,
    cell: i => <span className="text-xs whitespace-nowrap">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('service_fee', {
    header: ({ table }) => <span className="inline-flex items-center justify-end gap-1">ค่าบริการ Before<SumBtn col="service_fee" table={table} /></span>,
    size: 130, meta: { align: 'right' } satisfies ColMeta,
    cell: i => <span className="text-xs">{fmtNum(i.getValue())}</span>,
  }),

  // ── GROUP 2: ISCODE (10 cols) ──────────────────────────────────────────────
  ch.accessor('PINo', {
    header: 'PI No', size: 130,
    cell: i => {
      const item = i.row.original
      if (item.PINo) return <CopyCell value={item.PINo} className="font-mono text-[#0070F2] text-xs" />
      return <span className="text-[#C44500] flex items-center gap-1 text-xs"><AlertTriangle className="w-3 h-3" /> ไม่พบ</span>
    },
  }),
  ch.accessor('DINo', {
    header: 'DI No', size: 120,
    cell: i => <CopyCell value={i.getValue()} className="font-mono text-[#6A6D70] text-xs" />,
  }),
  ch.accessor('PONo', {
    header: 'PO No', size: 100,
    cell: i => <span className="font-mono text-xs whitespace-nowrap">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('CustID', {
    header: 'รหัสลูกค้า', size: 90,
    cell: i => <span className="text-xs text-[#6A6D70] whitespace-nowrap">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('CustName', {
    header: 'ชื่อลูกค้า', size: 160,
    cell: i => <span className="text-xs max-w-[160px] truncate block">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('FieldSaleID', {
    header: 'รหัสเซลล์', size: 90,
    cell: i => <span className="text-xs text-[#6A6D70] whitespace-nowrap">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('FieldSaleName', {
    header: 'ชื่อเซลล์', size: 120,
    cell: i => <span className="text-xs whitespace-nowrap">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('DocRemark', {
    header: 'Doc Remark', size: 160,
    cell: i => <span className="text-xs max-w-[160px] truncate block text-[#6A6D70]">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('Area', {
    header: 'Area', size: 120,
    cell: i => <span className="text-xs whitespace-nowrap">{i.getValue() ?? '—'}</span>,
  }),
  ch.accessor('account_type_name', {
    header: 'แผนกที่ส่ง', size: 130,
    cell: i => <span className="text-xs whitespace-nowrap">{i.getValue() ?? '—'}</span>,
  }),

  // ── GROUP 3: ระบบไปรษณีย์ (2 cols) ───────────────────────────────────────
  ch.accessor('customer_name', {
    header: 'ชื่อผู้รับ', size: 140,
    cell: i => i.getValue()
      ? <span className="text-xs max-w-[140px] truncate block">{i.getValue()}</span>
      : <span className="text-[#C0C1C2]">—</span>,
  }),
  ch.accessor('product_details', {
    header: 'สินค้า', size: 160,
    cell: i => <span className="text-xs max-w-[160px] truncate block text-[#6A6D70]">{i.getValue() ?? '—'}</span>,
  }),

  // ── GROUP 4: น้ำหนัก + ค่าขนส่ง คำนวณ (2 cols) ──────────────────────────
  ch.accessor(
    row => {
      const g = Number(row.weight_grams ?? 0)
      if (!g) return null
      if (row.dl_calculated_cost != null) return calculateLetterKg(g)
      if (row.ems_calculated_cost != null) return calculateEmsKg(g)
      return g
    },
    {
      id: 'weight_kg',
      header: ({ table }) => <span className="inline-flex items-center justify-end gap-1">น้ำหนัก (กก.)<SumBtn col="weight_kg" table={table} /></span>,
      size: 120, meta: { align: 'right' } satisfies ColMeta,
      cell: i => {
        const item = i.row.original
        if (item.dl_calculated_cost != null)
          return <span className="font-semibold text-[#0070F2] text-xs">{fmtNum(calculateLetterKg(item.weight_grams), 2)}</span>
        if (item.ems_calculated_cost != null)
          return <span className="font-semibold text-[#C44500] text-xs">{fmtNum(calculateEmsKg(item.weight_grams), 0)}</span>
        return <span className="text-xs">{fmtKg(item.weight_grams)}</span>
      },
    },
  ),
  ch.accessor(
    row => Number(row.dl_calculated_cost ?? row.ems_calculated_cost ?? row.service_fee ?? 0),
    {
      id: 'transport',
      header: ({ table }) => <span className="inline-flex items-center justify-end gap-1">ค่าขนส่ง<SumBtn col="transport" table={table} /></span>,
      size: 110, meta: { align: 'right' } satisfies ColMeta,
      cell: i => {
        const item = i.row.original
        if (item.dl_calculated_cost != null)
          return <span className="font-semibold text-[#0070F2] text-xs">{fmtNum(item.dl_calculated_cost, 0)}</span>
        if (item.ems_calculated_cost != null)
          return <span className="font-semibold text-[#C44500] text-xs">{fmtNum(item.ems_calculated_cost, 0)}</span>
        return <span className="text-xs">{fmtNum(item.service_fee)}</span>
      },
    },
  ),

  // ── GROUP 5: พื้นที่พิเศษ (1 col) ────────────────────────────────────────
  ch.accessor('special_zone_rate', {
    header: ({ table }) => <span className="inline-flex items-center justify-end gap-1">อัตราพื้นที่พิเศษ<SumBtn col="special_zone_rate" table={table} /></span>,
    size: 140, meta: { align: 'right' } satisfies ColMeta,
    cell: i => {
      if (hidesSpecialZone(i.row.original.service_name)) return <span className="text-[#C0C1C2]">—</span>
      return i.getValue() != null
        ? <span className="font-semibold text-[#C44500] text-xs">{fmtNum(i.getValue(), 0)}</span>
        : <span className="text-[#C0C1C2]">—</span>
    },
  }),

  // ── GROUP 6: Diff (1 col) ─────────────────────────────────────────────────
  ch.accessor(
    row => {
      const t = row.dl_calculated_cost ?? row.ems_calculated_cost ?? row.service_fee ?? null
      const b = row.service_fee ?? null
      const spz = hidesSpecialZone(row.service_name) ? 0 : Number(row.special_zone_rate ?? 0)
      return t != null && b != null ? Number(b) - Number(t) - spz : null
    },
    {
      id: 'diff',
      header: ({ table }) => <span className="inline-flex items-center justify-end gap-1">Diff<SumBtn col="diff" table={table} /></span>,
      size: 100, meta: { align: 'right' } satisfies ColMeta,
      cell: i => {
        const diff = i.getValue() as number | null
        if (diff == null) return <span className="text-[#C0C1C2]">—</span>
        if (diff === 0) return <span className="text-[#6A6D70] text-xs font-semibold">0.00</span>
        return <span className={clsx('font-semibold text-xs whitespace-nowrap', diff > 0 ? 'text-[#BB0000]' : 'text-[#107E3E]')}>{diff > 0 ? '+' : ''}{fmtNum(diff)}</span>
      },
    },
  ),
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LineSoPage() {
  const { can } = useAuth()
  const [search, setSearch]       = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [noPiNumber, setNoPiNumber] = useState(false)
  const [area, setArea]           = useState('')
  const [serviceType, setServiceType] = useState('')
  const [page, setPage]           = useState(1)
  const [exporting, setExporting] = useState(false)
  const [sumCols, setSumCols]     = useState<Set<string>>(new Set())
  const [sumScope, setSumScope]   = useState<'page' | 'all'>('page')
  const [sorting, setSorting]     = useState<SortingState>([])

  const resetPage = () => setPage(1)

  const toggleSum = useCallback((col: string) => setSumCols(prev => {
    const next = new Set(prev); next.has(col) ? next.delete(col) : next.add(col); return next
  }), [])

  async function handleExport() {
    setExporting(true)
    try {
      const [resMain, resZones, resEms, resDl] = await Promise.all([
        api.get('/iscode/line-so/export', { params: { search, date_from: dateFrom || undefined, date_to: dateTo || undefined, no_pi_number: noPiNumber ? 1 : undefined, area: area || undefined, service_type: serviceType || undefined } }),
        api.get('/special-postal-zones', { params: { per_page: 9999 } }),
        api.get('/ems-rates'),
        api.get('/domestic-letter-rates'),
      ])
      const allItems = resMain.data as LineSoJoin[]
      const zones = (resZones.data?.data ?? []) as { seq: number; area_group: number; province: string; office_name: string; postal_code: string; area_description: string | null; rate: number }[]
      const emsRates = (resEms.data?.data ?? []) as { weight: number; rate: number }[]
      const emsOffset = Number(resEms.data?.offset ?? 0)
      const dlRates = (resDl.data?.data ?? []) as { weight: number; rate: number }[]
      const dlOffset = Number(resDl.data?.offset ?? 0)
      const ws = XLSX.utils.json_to_sheet(buildExcelRows(allItems))
      const wsSummary = buildSummarySheet(allItems)
      const wsZones = XLSX.utils.json_to_sheet(zones.map(z => ({
        'ลำดับ': z.seq, 'กลุ่มพื้นที่': z.area_group, 'จังหวัด': z.province,
        'ชื่อที่ทำการ': z.office_name, 'รหัสไปรษณีย์': z.postal_code,
        'พื้นที่': z.area_description ?? '', 'อัตรา (บาท)': Number(z.rate),
      })))
      wsZones['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 28 }, { wch: 14 }]
      const wsEms = XLSX.utils.json_to_sheet([
        ...(emsOffset !== 0 ? [{ 'น้ำหนัก (กก.)': 'Input (ส่วนเพิ่ม)', 'อัตราฐาน (บาท)': '', 'อัตรารวม (บาท)': emsOffset }] : []),
        ...emsRates.map(r => ({ 'น้ำหนัก (กก.)': Number(r.weight), 'อัตราฐาน (บาท)': Number(r.rate), 'อัตรารวม (บาท)': Math.ceil(Number(r.rate) + emsOffset) })),
      ])
      wsEms['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 18 }]
      const wsDl = XLSX.utils.json_to_sheet([
        ...(dlOffset !== 0 ? [{ 'น้ำหนัก (กก.)': 'Input (ส่วนเพิ่ม)', 'อัตราฐาน (บาท)': '', 'อัตรารวม (บาท)': dlOffset }] : []),
        ...dlRates.map(r => ({ 'น้ำหนัก (กก.)': Number(r.weight), 'อัตราฐาน (บาท)': Number(r.rate), 'อัตรารวม (บาท)': Math.ceil(Number(r.rate) + dlOffset) })),
      ])
      wsDl['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 18 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Line SO Report')
      XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุป')
      XLSX.utils.book_append_sheet(wb, wsZones, 'พื้นที่พิเศษ')
      XLSX.utils.book_append_sheet(wb, wsEms, 'อัตรา EMS')
      XLSX.utils.book_append_sheet(wb, wsDl, 'อัตราไปรษณีย์')
      XLSX.writeFile(wb, `line-so-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (err) {
      console.error(err)
    } finally { setExporting(false) }
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery<PaginatedResponse<LineSoJoin>>({
    queryKey: ['line-so', search, dateFrom, dateTo, noPiNumber, area, serviceType, page],
    queryFn: () =>
      api.get('/iscode/line-so', { params: { search, date_from: dateFrom || undefined, date_to: dateTo || undefined, no_pi_number: noPiNumber ? 1 : undefined, area: area || undefined, service_type: serviceType || undefined, page, per_page: 15 } }).then((r) => r.data),
    enabled: can('line-so.view'),
  })

  const { data: summaryData, isFetching: summaryLoading } = useQuery<{
    weight_grams: number; service_fee: number; special_zone_rate: number
    transport: number; weight_kg: number; diff: number; total_count: number
  }>({
    queryKey: ['line-so-summary', search, dateFrom, dateTo, noPiNumber, area, serviceType],
    queryFn: () =>
      api.get('/iscode/line-so/summary', { params: { search, date_from: dateFrom || undefined, date_to: dateTo || undefined, no_pi_number: noPiNumber ? 1 : undefined, area: area || undefined, service_type: serviceType || undefined } }).then((r) => r.data),
    enabled: can('line-so.view') && sumCols.size > 0 && sumScope === 'all',
  })

  const { data: accountTypes } = useQuery<PaginatedResponse<PostoneAccountType>>({
    queryKey: ['account-types-all'],
    queryFn: () => api.get('/account-types', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('line-so.view'),
  })

  const { data: fieldSaleAreas } = useQuery<string[]>({
    queryKey: ['line-so-field-sale-areas'],
    queryFn: () => api.get('/iscode/line-so/field-sale-areas').then((r) => r.data),
    enabled: can('line-so.view'),
  })

  // ── Sums (page-level) ────────────────────────────────────────────────────

  const sums = useMemo(() => {
    const arr = data?.data ?? []
    return {
      weight_grams: arr.reduce((s, i) => s + Number(i.weight_grams ?? 0), 0),
      service_fee: arr.reduce((s, i) => s + Number(i.service_fee ?? 0), 0),
      weight_kg: arr.reduce((s, i) => {
        const g = Number(i.weight_grams ?? 0)
        if (!g) return s
        if (i.dl_calculated_cost != null) return s + (calculateLetterKg(g) ?? 0)
        if (i.ems_calculated_cost != null) return s + (calculateEmsKg(g) ?? 0)
        return s + g
      }, 0),
      transport: arr.reduce((s, i) => s + Number(i.dl_calculated_cost ?? i.ems_calculated_cost ?? i.service_fee ?? 0), 0),
      special_zone_rate: arr.reduce((s, i) => s + Number(i.special_zone_rate ?? 0), 0),
      diff: arr.reduce((s, i) => {
        const t = Number(i.dl_calculated_cost ?? i.ems_calculated_cost ?? i.service_fee ?? 0)
        const b = Number(i.service_fee ?? 0)
        const spz = hidesSpecialZone(i.service_name) ? 0 : Number(i.special_zone_rate ?? 0)
        return s + (b - t - spz)
      }, 0),
    }
  }, [data])

  // ── TanStack Table ────────────────────────────────────────────────────────

  const items = data?.data ?? []

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo(() => COLUMNS, [])

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    meta: { sumCols, toggleSum } satisfies TableMeta,
  })

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!can('line-so.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#6A6D70]">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const colCount = table.getVisibleLeafColumns().length

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="pb-1 border-b border-[#EBEBEB]">
        <h1 className="text-xl font-semibold text-[#32363A]">ตรวจสอบข้อมูลไปรษณีย์ (Report)</h1>
        <p className="text-[#6A6D70] text-sm mt-0.5">
          ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} รายการ · ตรวจสอบข้อมูลไปรษณีย์ ผ่าน PINo SoNo
        </p>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white border border-[#EBEBEB] rounded px-4 py-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6A6D70]" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage() }}
            placeholder="Barcode, PI No, SO No, PO No, ชื่อลูกค้า..."
            className="w-full pl-9 pr-3 py-2 border border-[#89919A] rounded text-sm text-[#32363A] placeholder:text-[#6A6D70] focus:outline-none focus:border-[#0070F2] focus:ring-1 focus:ring-[#0070F2]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#6A6D70] whitespace-nowrap">วันฝากส่ง</label>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetPage() }} className="border border-[#89919A] rounded px-3 py-2 text-sm text-[#32363A] focus:outline-none focus:border-[#0070F2] focus:ring-1 focus:ring-[#0070F2]" />
          <span className="text-[#6A6D70] text-sm">—</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); resetPage() }} className="border border-[#89919A] rounded px-3 py-2 text-sm text-[#32363A] focus:outline-none focus:border-[#0070F2] focus:ring-1 focus:ring-[#0070F2]" />
        </div>
        <AreaCombobox
          value={area}
          onChange={(v) => { setArea(v); resetPage() }}
          fieldSaleAreas={fieldSaleAreas}
          accountTypeNames={(accountTypes?.data ?? []).map(at => at.name)}
        />
        <select
          value={serviceType}
          onChange={(e) => { setServiceType(e.target.value); resetPage() }}
          className="border border-[#89919A] rounded px-3 py-2 text-sm text-[#32363A] focus:outline-none focus:border-[#0070F2] focus:ring-1 focus:ring-[#0070F2] bg-white"
        >
          <option value="">ทุกประเภทบริการ</option>
          <option value="EMS">EMS</option>
          <option value="จดหมาย">จดหมาย</option>
        </select>
        <button
          onClick={() => { setNoPiNumber((v) => !v); resetPage() }}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded border transition-colors',
            noPiNumber ? 'bg-[#FEF7F1] border-[#E9730C] text-[#C44500] hover:bg-[#FDEBD7]' : 'bg-white border-[#EBEBEB] text-[#32363A] hover:bg-[#F5F5F5]'
          )}
        >
          <AlertTriangle className="w-4 h-4" />
          ไม่พบ PI No
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#0070F2] hover:bg-[#0057C2] disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'กำลัง Export...' : 'Export Excel'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#EBEBEB] rounded">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '2400px' }}>
            <thead>
              {/* Row 1: Group headers (manual) */}
              <tr className="border-b border-[#EBEBEB]">
                <GH label="ข้อมูลไปรษณีย์จากไฟล์บริการ" span={7}  color="bg-[#F5FAF5] text-[#107E3E] border-[#C8E6C9]" />
                <GH label="ISCODE"                         span={10} color="bg-[#EBF5FE] text-[#0057B8] border-[#BDD9F7]" />
                <GH label="ระบบไปรษณีย์"                  span={2}  color="bg-[#EBF5FE] text-[#0070F2] border-[#BDD9F7]" />
                <GH label="ข้อมูลไปรษณีย์จากไฟล์บริการ" span={2}  color="bg-[#F5FAF5] text-[#107E3E] border-[#C8E6C9]" />
                <GH label="พื้นที่พิเศษ"                  span={1}  color="bg-[#FEF7F1] text-[#C44500] border-[#F8C592]" />
                <GH label="Diff"                           span={1}  color="bg-[#F2F4F7] text-[#6A6D70] border-[#EBEBEB]" />
              </tr>
              {/* Row 2: Column headers with sort (TanStack) */}
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id} className="bg-[#F2F4F7] border-b border-[#EBEBEB]">
                  {hg.headers.map(header => {
                    const meta    = header.column.columnDef.meta as ColMeta | undefined
                    const isRight = meta?.align === 'right'
                    const sorted  = header.column.getIsSorted()
                    const canSort = header.column.getCanSort()
                    return (
                      <th
                        key={header.id}
                        style={{ width: header.column.columnDef.size, minWidth: header.column.columnDef.size }}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        className={clsx(
                          'px-4 py-3 font-semibold text-[#32363A] whitespace-nowrap',
                          isRight ? 'text-right' : 'text-left',
                          canSort && 'cursor-pointer hover:bg-[#E8EDF3] select-none',
                        )}
                      >
                        {header.isPlaceholder ? null : (
                          <span className={clsx('inline-flex items-center gap-1', isRight && 'flex-row-reverse')}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <SortIcon sorted={sorted} />
                          </span>
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[#EBEBEB]">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(colCount)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-[#F5F5F5] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-5 py-12 text-center text-[#6A6D70]">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => {
                  const item = row.original
                  const hasIscode = item.PINo !== null
                  return (
                    <tr
                      key={row.id}
                      className={clsx('hover:bg-[#EBF5FE] transition-colors', !hasIscode && 'bg-[#FEF7F1]')}
                    >
                      {row.getVisibleCells().map(cell => {
                        const meta    = cell.column.columnDef.meta as ColMeta | undefined
                        const isRight = meta?.align === 'right'
                        return (
                          <td key={cell.id} className={clsx('px-4 py-3', isRight && 'text-right')}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination + sum footer */}
        {data && (data.last_page > 1 || sumCols.size > 0) && (() => {
          const displaySums  = sumScope === 'all' && summaryData ? summaryData : sums
          const displayCount = sumScope === 'all' ? (summaryData?.total_count ?? data.total ?? 0) : items.length
          return (
            <div className="px-5 py-3 border-t border-[#EBEBEB] flex items-center justify-between gap-4 text-sm text-[#6A6D70] flex-wrap">
              <div className="flex items-center gap-4 flex-wrap min-w-0">
                <span className="whitespace-nowrap">หน้า {data.current_page} จาก {data.last_page} (ทั้งหมด {data.total?.toLocaleString('th-TH')} รายการ)</span>
                {sumCols.size > 0 && (
                  <div className="flex items-center gap-3 flex-wrap text-xs border-l border-[#EBEBEB] pl-4">
                    <div className="flex items-center gap-1 text-[#6A6D70] font-semibold">
                      <span>Σ</span>
                      <button onClick={() => setSumScope('page')} className={clsx('px-1.5 py-0.5 rounded transition-colors', sumScope === 'page' ? 'bg-[#EBF5FE] text-[#0070F2]' : 'hover:text-[#32363A]')}>หน้านี้ ({items.length})</button>
                      <span className="text-[#C0C1C2]">/</span>
                      <button onClick={() => setSumScope('all')} className={clsx('px-1.5 py-0.5 rounded transition-colors', sumScope === 'all' ? 'bg-[#EBF5FE] text-[#0070F2]' : 'hover:text-[#32363A]')}>ทั้งหมด ({data.total?.toLocaleString('th-TH')})</button>
                    </div>
                    {summaryLoading && sumScope === 'all'
                      ? <span className="text-[#6A6D70] animate-pulse">กำลังคำนวณ...</span>
                      : <>
                        <span className="text-[#6A6D70]">{displayCount.toLocaleString('th-TH')} รายการ</span>
                        {sumCols.has('weight_grams')    && <span className="whitespace-nowrap">น้ำหนัก(g) Before <strong className="text-[#32363A]">{fmtNum(displaySums.weight_grams, 0)}</strong></span>}
                        {sumCols.has('service_fee')     && <span className="whitespace-nowrap">ค่าบริการ Before <strong className="text-[#32363A]">{fmtNum(displaySums.service_fee)}</strong></span>}
                        {sumCols.has('weight_kg')       && <span className="whitespace-nowrap">น้ำหนัก(กก.) <strong className="text-[#32363A]">{fmtNum(displaySums.weight_kg, 2)}</strong></span>}
                        {sumCols.has('transport')       && <span className="whitespace-nowrap">ค่าขนส่ง <strong className="text-[#32363A]">{fmtNum(displaySums.transport, 0)}</strong></span>}
                        {sumCols.has('special_zone_rate') && <span className="whitespace-nowrap">พื้นที่พิเศษ <strong className="text-[#C44500]">{fmtNum(displaySums.special_zone_rate, 0)}</strong></span>}
                        {sumCols.has('diff') && (
                          <span className="whitespace-nowrap">Diff <strong className={displaySums.diff > 0 ? 'text-[#BB0000]' : displaySums.diff < 0 ? 'text-[#107E3E]' : 'text-[#6A6D70]'}>{displaySums.diff > 0 ? '+' : ''}{fmtNum(displaySums.diff)}</strong></span>
                        )}
                      </>
                    }
                  </div>
                )}
              </div>
              {data.last_page > 1 && (
                <div className="flex gap-2 shrink-0">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-[#EBEBEB] rounded text-[#0070F2] disabled:opacity-40 hover:bg-[#EBF5FE] transition-colors">ก่อนหน้า</button>
                  <button disabled={page === data.last_page} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-[#EBEBEB] rounded text-[#0070F2] disabled:opacity-40 hover:bg-[#EBF5FE] transition-colors">ถัดไป</button>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
