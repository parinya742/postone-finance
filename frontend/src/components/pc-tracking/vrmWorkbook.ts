import * as XLSX from 'xlsx'
import { VrmExportResponse } from '@/lib/types'

// Same 4 sheets as the n8n "vrm-export" workbook:
// ArticleByChannelType / Pivot ART / line_orders / Pivot_line_orders

const RAW_HEADERS: Record<string, string> = {
  today: 'TODAY', crdate: 'CRDATE', period_type: 'PERIODTYPE', period_date: 'PERIODDATE', billing_date: 'BILLING_DATE',
  vendor_no: 'VENDORNO', vendor_name: 'VENDORNAME', site_no: 'SITENO', site_name: 'SITENAME',
  mch3: 'MCH3', mch3_desc: 'MCH3DESC', mch2: 'MCH2', mch2_desc: 'MCH2DESC', mch1: 'MCH1', mch1_desc: 'MCH1DESC',
  art_no: 'ARTNO', art_desc: 'ARTDESC', art_ean: 'ARTEAN', vd_art_desc: 'VDARTDESC',
  qty: 'QTY', value: 'VALUE', uom: 'UOM', vd_art_no: 'VDARTNO', sale_type: 'SALE_TYPE',
}

const DATE_COLS = new Set(['period_date', 'billing_date'])
const NUM_COLS = new Set(['qty', 'value'])

/** 'YYYY-MM-DD…' → local Date (no timezone shift). */
function toDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null
  const [y, m, d] = v.slice(0, 10).split('-').map(Number)
  const t = v.length > 10 ? v.slice(11, 19).split(':').map(Number) : [0, 0, 0]
  return new Date(y, m - 1, d, t[0] || 0, t[1] || 0, t[2] || 0)
}

const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v))
const round2 = (n: number) => Math.round(n * 100) / 100
/** SKU "17919" → 17919 (as in the original workbook); anything else stays text. */
const skuCell = (v: string | null) => (v && /^\d{1,15}$/.test(v) ? Number(v) : v)

/**
 * Rebuild a VRM import file from its staged rows (batches without an S3 copy).
 * Header = staging column names uppercased, which is the original VRM header (TODAY, CRDATE, PERIODTYPE, ...).
 */
export function buildVrmBatchFile(data: { file_name: string; columns: string[]; rows: (string | number | null)[][] }) {
  const dateCols = new Set(['perioddate', 'billing_date'])
  const numCols = new Set(['qty', 'value'])
  const aoa: unknown[][] = [data.columns.map((c) => c.toUpperCase())]
  for (const r of data.rows) {
    aoa.push(r.map((v, i) => {
      const c = data.columns[i]
      if (dateCols.has(c)) return toDate(v) ?? v
      if (numCols.has(c)) return num(v)
      return v
    }))
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa, { cellDates: true, dateNF: 'dd/mm/yyyy' }), 'ArticleByChannelType')
  XLSX.writeFile(wb, data.file_name.toLowerCase().endsWith('.xlsx') ? data.file_name : `${data.file_name}.xlsx`)
}

type Opts = { artLabel?: string; site?: string }

export function buildVrmWorkbook(data: VrmExportResponse, { artLabel = '(All)', site = 'ALL' }: Opts = {}) {
  const cols = data.raw_columns
  const idx = Object.fromEntries(cols.map((c, i) => [c, i]))

  // 1) ArticleByChannelType — raw rows
  const rawAoa: unknown[][] = [cols.map((c) => RAW_HEADERS[c] ?? c.toUpperCase())]
  for (const r of data.raw) {
    rawAoa.push(r.map((v, i) => {
      const c = cols[i]
      if (DATE_COLS.has(c)) return toDate(v) ?? v
      if (NUM_COLS.has(c)) return num(v)
      return v
    }))
  }
  const wsRaw = XLSX.utils.aoa_to_sheet(rawAoa, { cellDates: true, dateNF: 'dd/mm/yyyy' })

  // 2) Pivot ART — SITENO → PERIODDATE, Sum of QTY / Sum of VALUE
  const bySite = new Map<string, Map<string, [number, number]>>()
  let totQ = 0, totV = 0
  for (const r of data.raw) {
    const s = String(r[idx.site_no] ?? '')
    const d = String(r[idx.period_date] ?? '')
    const q = num(r[idx.qty]), v = num(r[idx.value])
    if (!bySite.has(s)) bySite.set(s, new Map())
    const days = bySite.get(s)!
    const cur = days.get(d) ?? [0, 0]
    days.set(d, [cur[0] + q, cur[1] + v])
    totQ += q; totV += v
  }
  const pivotAoa: unknown[][] = [
    ['ARTDESC', artLabel],
    [null, null, 'Values'],
    ['SITENO', 'PERIODDATE', 'Sum of QTY', 'Sum of VALUE'],
  ]
  for (const s of [...bySite.keys()].sort()) {
    pivotAoa.push([s])
    const days = bySite.get(s)!
    for (const d of [...days.keys()].sort()) {
      const [q, v] = days.get(d)!
      pivotAoa.push([s, toDate(d) ?? d, q, round2(v)])
    }
  }
  pivotAoa.push(['Grand Total', null, totQ, round2(totV)])
  const wsPivot = XLSX.utils.aoa_to_sheet(pivotAoa, { cellDates: true, dateNF: 'dd/mm/yyyy' })
  wsPivot['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }]

  // 3) line_orders — orders reported by PCs in LINE
  const lineAoa: unknown[][] = [['วันที่บันทึก', 'วันที่ในข้อความ', 'รหัสสาขา', 'SKU', 'จำนวน', 'ยอดเงิน', 'กลุ่ม', 'ผู้ส่ง', 'ข้อความดิบ']]
  for (const o of data.line_orders) {
    lineAoa.push([
      toDate(o.parsed_at) ?? o.parsed_at, toDate(o.order_date_iso) ?? o.order_date_iso, o.branch_code,
      skuCell(o.sku), num(o.quantity), num(o.amount), o.group_name, o.display_name, o.raw_text,
    ])
  }
  const wsLine = XLSX.utils.aoa_to_sheet(lineAoa, { cellDates: true, dateNF: 'dd/mm/yyyy hh:mm' })

  // 4) Pivot_line_orders — branch → date → SKU
  const lineMap = new Map<string, { b: string; d: string; s: string | null; q: number; a: number }>()
  for (const o of data.line_orders) {
    const key = `${o.branch_code}|${o.order_date_iso}|${o.sku}`
    const cur = lineMap.get(key) ?? { b: o.branch_code ?? '', d: o.order_date_iso ?? '', s: o.sku, q: 0, a: 0 }
    cur.q += num(o.quantity); cur.a += num(o.amount)
    lineMap.set(key, cur)
  }
  const linePivot = [...lineMap.values()].sort((x, y) =>
    x.b.localeCompare(y.b) || x.d.localeCompare(y.d) || String(x.s).localeCompare(String(y.s)))
  const linePivotAoa: unknown[][] = [['รหัสสาขา', 'วันที่ในข้อความ', 'SKU', 'Sum of จำนวน', 'Sum of ยอดเงิน']]
  for (const p of linePivot) linePivotAoa.push([p.b, toDate(p.d) ?? p.d, skuCell(p.s), p.q, round2(p.a)])
  const wsLinePivot = XLSX.utils.aoa_to_sheet(linePivotAoa, { cellDates: true, dateNF: 'dd/mm/yyyy' })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsRaw, 'ArticleByChannelType')
  XLSX.utils.book_append_sheet(wb, wsPivot, 'Pivot ART')
  XLSX.utils.book_append_sheet(wb, wsLine, 'line_orders')
  XLSX.utils.book_append_sheet(wb, wsLinePivot, 'Pivot_line_orders')

  XLSX.writeFile(wb, `VRM_${site || 'ALL'}_${data.date_from}_${data.date_to}.xlsx`)
}
