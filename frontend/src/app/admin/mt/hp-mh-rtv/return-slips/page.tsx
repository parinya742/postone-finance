'use client'

import api from '@/lib/api'
import {
  CrcPaginatedResponse, HpmhRtvExtractBatch, HpmhRtvExtractProgress, HpmhRtvFile, HpmhRtvReturnSlip,
  HpmhRtvReturnSlipExtract, PaginatedResponse,
} from '@/lib/types'
import { useQuery, useQueryClient, keepPreviousData, type QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useRef, useState } from 'react'
import clsx from 'clsx'
import { Search, Undo2, FileArchive, Eye, TableProperties, Loader2, AlertTriangle, CheckCircle2, Database, Play, RotateCw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, StatusBadge, SapInput, inputCls, ErpNoAccess } from '@/components/erp'
import PdfViewer from '@/components/ui/PdfViewer'
import { MOVEMENT_COLORS, MOVEMENT_LABELS } from '../movement'
import {
  CrcHeader, CrcViewTabs, CrcFilterBar, CrcTable, CrcDownloadButton, MtAuditLogTable,
  NumCell, TextCell, dash, fmtNum, fmtBytes, fmtDateTime, toNum, useDebounced, type CrcColumn,
} from '@/components/crc'

type View = 'data' | 'files' | 'logs'

const VENDOR_NO = '501447'
const API = '/hpmh-rtv'

type Options = {
  sites: { site_code: string; site: string | null }[]
  movement_types: string[]
}

const KIND_COLORS: Record<string, string> = {
  EXCEL: 'bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40',
  ZIP:   'bg-[#F5F5F5] text-[#6A6D70] border-[#D9D9D9]',
}

const thCls = 'px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[#6A6D70] whitespace-nowrap border-r border-[#E5E5E5] last:border-r-0'
const tdCls = 'px-2.5 py-1.5 border-r border-[#EBEBEB] last:border-r-0 align-top'

/** The slip list and the processing counters both change whenever a PDF is (re)read into the DB */
function invalidateExtractViews(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['hpmh-rtv-return-slips'] })
  queryClient.invalidateQueries({ queryKey: ['hpmh-rtv-extract-status'] })
}

// ── PDF → database processing: counters + "ประมวลผล" button ──────────────────

const BATCH_SIZE = 5   // PDFs per request — `php artisan serve` handles one request at a time, so keep each short

function ExtractProcessBar({ canProcess }: { canProcess: boolean }) {
  const queryClient = useQueryClient()
  const [run, setRun] = useState<{ total: number; done: number; error: number } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const cancelled = useRef(false)

  const { data: st } = useQuery<HpmhRtvExtractProgress>({
    queryKey: ['hpmh-rtv-extract-status', VENDOR_NO],
    queryFn: () => api.get(`${API}/extract-status`, { params: { vendor_no: VENDOR_NO } }).then(r => r.data),
    refetchInterval: run ? false : 60_000,   // new slips are processed on the server every 5 minutes
  })

  const start = async (retryErrors: boolean) => {
    if (!st) return
    // Bounded by what is waiting now, so documents that keep failing (retry mode) can't loop forever
    const total = retryErrors ? st.pending + st.error : st.pending
    let done = 0, failed = 0
    cancelled.current = false
    setMessage(null)
    setRun({ total, done, error: failed })
    try {
      while (!cancelled.current && done < total) {
        const { data: b } = await api.post<HpmhRtvExtractBatch>(`${API}/extract-pending`, {
          limit: Math.min(BATCH_SIZE, total - done), vendor_no: VENDOR_NO, retry_errors: retryErrors,
        })
        done += b.processed
        failed += b.error
        setRun({ total, done, error: failed })
        if (b.processed === 0 || b.remaining === 0) break
      }
      setMessage(`${cancelled.current ? 'หยุดแล้ว — ' : ''}ประมวลผล ${fmtNum(done)} ใบ${failed ? ` (อ่านไม่ได้ ${fmtNum(failed)} ใบ)` : ''}`)
    } catch (e) {
      const msg = isAxiosError(e) ? (e.response?.data?.message ?? e.message) : String(e)
      setMessage(`ประมวลผลไม่สำเร็จ: ${msg} (ทำไปแล้ว ${fmtNum(done)} ใบ)`)
    } finally {
      setRun(null)
      invalidateExtractViews(queryClient)
    }
  }

  if (!st) return null
  const pct = run && run.total > 0 ? Math.round((run.done / run.total) * 100) : 0

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 bg-white border border-[#D9D9D9] border-t-0 text-[11px]">
      <span className="inline-flex items-center gap-1.5 font-semibold text-[#32363A]">
        <Database className="w-3.5 h-3.5 text-[#0070F2]" /> ข้อมูลจาก PDF ในฐานข้อมูล
      </span>
      {run ? (
        <div className="flex items-center gap-2 min-w-[260px] flex-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0070F2]" />
          <div className="flex-1 max-w-[320px] h-1.5 bg-[#EBEBEB] rounded-full overflow-hidden">
            <div className="h-full bg-[#0070F2] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="tabular-nums text-[#32363A]">
            {fmtNum(run.done)} / {fmtNum(run.total)} ใบ{run.error > 0 && <span className="text-[#BB0000]"> · อ่านไม่ได้ {fmtNum(run.error)}</span>}
          </span>
          <button onClick={() => { cancelled.current = true }} className="text-[10px] text-[#BB0000] hover:underline">หยุด</button>
        </div>
      ) : (
        <>
          <span className="text-[#6A6D70] tabular-nums">
            อ่านแล้ว <b className="text-[#32363A]">{fmtNum(st.extracted)}</b> / {fmtNum(st.documents)} ใบ
            {' · '}<span className="text-[#107E3E]">ปกติ {fmtNum(st.ok)}</span>
            {st.warning > 0 && <> · <span className="text-[#E9730C]">มีคำเตือน {fmtNum(st.warning)}</span></>}
            {st.error > 0 && <> · <span className="text-[#BB0000]">อ่านไม่ได้ {fmtNum(st.error)}</span></>}
            {st.pending > 0 && <> · <span className="font-semibold text-[#32363A]">รอประมวลผล {fmtNum(st.pending)}</span></>}
          </span>
          {canProcess && st.pending > 0 && (
            <button
              onClick={() => start(false)}
              className="inline-flex items-center gap-1 h-6 px-2.5 text-[10px] font-semibold text-white bg-[#0070F2] rounded hover:bg-[#0064D9] transition-colors"
            >
              <Play className="w-3 h-3" /> ประมวลผล {fmtNum(st.pending)} ใบ
            </button>
          )}
          {canProcess && st.error > 0 && (
            <button
              onClick={() => start(true)}
              className="inline-flex items-center gap-1 h-6 px-2.5 text-[10px] font-semibold text-[#BB0000] border border-[#BB0000]/40 rounded hover:bg-[#FFEBEB] transition-colors"
            >
              <RotateCw className="w-3 h-3" /> ลองอ่านใหม่ {fmtNum(st.error)} ใบ
            </button>
          )}
          {st.pending === 0 && st.error === 0 && <span className="text-[10px] text-[#6A6D70]">ใบใหม่จะถูกประมวลผลอัตโนมัติทุก 5 นาที</span>}
          {message && <span className="text-[10px] text-[#6A6D70]">{message}</span>}
        </>
      )}
    </div>
  )
}

// ── Status of one slip's PDF data (list column) ──────────────────────────────

function ExtractBadge({ slip }: { slip: HpmhRtvReturnSlip }) {
  const base = 'inline-flex items-center gap-1 px-1.5 py-px text-[10px] rounded-sm border whitespace-nowrap'
  if (!slip.doc_id) return dash
  if (!slip.extract_status) return <span className={clsx(base, 'text-[#6A6D70] border-[#D9D9D9] bg-[#F5F5F5]')}>รอประมวลผล</span>
  if (slip.extract_stale) return <span className={clsx(base, 'text-[#6A6D70] border-[#D9D9D9] bg-[#F5F5F5]')} title="PDF หรือตัวอ่านเปลี่ยน — จะอ่านใหม่">รออ่านใหม่</span>
  if (slip.extract_status === 'error') return <span className={clsx(base, 'text-[#BB0000] border-[#BB0000]/40 bg-[#FFEBEB]')}>อ่านไม่ได้</span>
  const pdf = `ใน PDF: ${fmtNum(slip.extract_total_qty)} ชิ้น · ${fmtNum(slip.extract_total, 2)} บาท`
  if (slip.extract_mismatch) {
    return <span className={clsx(base, 'text-[#E9730C] border-[#E9730C]/40 bg-[#FEF7F1]')} title={pdf}><AlertTriangle className="w-3 h-3" /> ไม่ตรง Excel</span>
  }
  if (slip.extract_status === 'warning') {
    return <span className={clsx(base, 'text-[#E9730C] border-[#E9730C]/40 bg-[#FEF7F1]')} title={pdf}><AlertTriangle className="w-3 h-3" /> มีคำเตือน</span>
  }
  return <span className={clsx(base, 'text-[#107E3E] border-[#107E3E]/40 bg-[#F1FAF4]')} title={pdf}><CheckCircle2 className="w-3 h-3" /> ตรงกัน</span>
}

// ── Table read out of the return slip PDF (stored in hpmh_rtv.return_slip_extract) ──

function ReturnSlipExtractTable({ slip }: { slip: HpmhRtvReturnSlip }) {
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const docId = slip.doc_id!
  const queryKey = ['hpmh-rtv-return-slip-extract', docId]

  const { data, isLoading, error } = useQuery<HpmhRtvReturnSlipExtract>({
    queryKey,
    queryFn: () => api.get(`${API}/documents/${docId}/extract`).then(r => {
      // Opening an unprocessed slip reads it into the DB on the spot — refresh the list badge and counters
      if (!slip.extract_status || slip.extract_stale) invalidateExtractViews(queryClient)
      return r.data
    }),
    staleTime: Infinity,
    retry: false,
  })

  const reExtract = async () => {
    setRefreshing(true)
    try {
      const { data: fresh } = await api.get(`${API}/documents/${docId}/extract`, { params: { refresh: 1 } })
      queryClient.setQueryData(queryKey, fresh)
    } catch {
      alert('อ่านข้อมูลจาก PDF ใหม่ไม่สำเร็จ')
    } finally {
      setRefreshing(false)
      invalidateExtractViews(queryClient)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-1 py-3 text-xs text-[#6A6D70]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังอ่านข้อมูลจาก PDF...
      </div>
    )
  }
  if (error || !data) {
    const msg = isAxiosError(error) ? (error.response?.data?.error ?? error.response?.data?.message) : null
    return <p className="px-1 py-3 text-xs text-[#BB0000]">อ่านข้อมูลจาก PDF ไม่สำเร็จ{msg ? `: ${msg}` : ''}</p>
  }

  // PDF totals vs the Excel listing row (one row per slip); 162 reversals may carry either sign, so compare magnitudes
  const excelQty = toNum(slip.quantity)
  const excelAmount = toNum(slip.amount)
  const excelMismatch: string[] = []
  if (data.total != null && excelAmount != null && Math.abs(Math.abs(data.total) - Math.abs(excelAmount)) > 0.01) {
    excelMismatch.push(`ยอดเงินใน PDF (${fmtNum(data.total, 2)}) ไม่ตรงกับ Excel (${fmtNum(excelAmount, 2)})`)
  }
  if (data.total_qty != null && excelQty != null && Math.abs(Math.abs(data.total_qty) - Math.abs(excelQty)) > 0.001) {
    excelMismatch.push(`จำนวนใน PDF (${fmtNum(data.total_qty)}) ไม่ตรงกับ Excel (${fmtNum(excelQty)})`)
  }
  const problems = [...data.warnings, ...excelMismatch]

  const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ') || null
  const info: [string, string | null][] = [
    ['วันที่/เวลา', [data.doc_date && fmtDate(data.doc_date), data.doc_time].filter(Boolean).join(' ') || null],
    ['สาขา', [data.site_code, data.site].filter(Boolean).join(' ') || null],
    ['Tel/Ext สาขา', join(data.site_tel, data.site_tel2)],
    ['คลัง', data.storage_location],
    ['Buyer', data.buyer_code ? `${data.buyer_code} · ${data.buyer_name ?? ''}` : data.buyer],
    ['Delivery notes', data.delivery_note],
    ['Created By', data.created_by],
    ['GR Text', data.gr_text],
    ['PO Text', data.po_text],
    ['ผู้ขาย', data.vendor_name ? `${data.vendor_name}${data.vendor_no ? ` (${data.vendor_no})` : ''}` : data.vendor_no],
    ['ที่อยู่ผู้ขาย', data.vendor_address ?? null],
    ['ผู้ติดต่อ', join(data.vendor_contact, data.vendor_tel && `Tel ${data.vendor_tel}`)],
  ]

  return (
    <div className="mt-2 border border-[#E5E5E5] rounded-sm bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#F9FAFB] border-b border-[#E5E5E5]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span className="font-semibold text-[#32363A]">ข้อมูลในเอกสาร</span>
          <span className="text-[#6A6D70]">{fmtNum(data.items_count)} รายการ · {data.pages} หน้า</span>
          {data.ocr?.used ? (
            <span
              className="px-1.5 py-px text-[10px] text-[#0070F2] border border-[#0070F2]/40 rounded-sm bg-[#EBF5FE]"
              title={`ข้อความภาษาไทย (ชื่อสินค้า/หมายเหตุ) ปรับด้วย OpenThai OCR ${fmtNum(data.ocr.lines)} บรรทัด · ${fmtNum(data.ocr.ms)} ms — ตัวเลขและภาษาอังกฤษยังมาจาก PDF โดยตรง`}
            >
              OCR ภาษาไทย
            </span>
          ) : data.ocr?.error ? (
            <span className="text-[10px] text-[#6A6D70]" title={data.ocr.error}>ไม่ได้ใช้ OCR (ข้อความไทยจาก PDF)</span>
          ) : null}
          {problems.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-[#107E3E]">
              <CheckCircle2 className="w-3 h-3" /> ผลรวมตรงกับยอดในเอกสารและ Excel
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[#E9730C]" title={problems.join('\n')}>
              <AlertTriangle className="w-3 h-3" /> {problems[0]}{problems.length > 1 && ` (+${problems.length - 1})`}
            </span>
          )}
        </div>
        <button
          onClick={reExtract}
          disabled={refreshing}
          title={`อ่านล่าสุดเมื่อ ${fmtDateTime(data.extracted_at)}`}
          className="text-[10px] text-[#0070F2] hover:underline disabled:opacity-50"
        >
          {refreshing ? 'กำลังอ่านใหม่...' : 'อ่าน PDF ใหม่'}
        </button>
      </div>

      <dl className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-1 px-3 py-2 text-[11px] border-b border-[#E5E5E5]">
        {info.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] text-[#6A6D70]">{label}</dt>
            <dd className="text-[#32363A] truncate" title={value ?? undefined}>{value || '—'}</dd>
          </div>
        ))}
      </dl>

      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#F2F4F7] border-b border-[#D9D9D9]">
              <th className={clsx(thCls, 'w-12 text-center')}>Item</th>
              <th className={thCls}>VD Part#</th>
              <th className={thCls}>Article</th>
              <th className={thCls}>รายการสินค้า</th>
              <th className={thCls}>AC/CO/PO</th>
              <th className={clsx(thCls, 'text-center')}>MVT</th>
              <th className={clsx(thCls, 'text-center')}>หน่วย</th>
              <th className={clsx(thCls, 'text-right')}>จำนวน</th>
              <th className={clsx(thCls, 'text-right')}>@</th>
              <th className={clsx(thCls, 'text-right')}>จำนวนเงิน</th>
              <th className={clsx(thCls, 'w-12 text-center')}>หน้า</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-6 text-center text-[#6A6D70]">ไม่พบรายการในเอกสาร</td></tr>
            ) : data.items.map(i => (
              <tr key={i.item} className="border-b border-[#EBEBEB] hover:bg-[#F9FAFB]">
                <td className={clsx(tdCls, 'text-center text-[#6A6D70] tabular-nums')}>{i.item}</td>
                <td className={tdCls}><span className="font-mono text-[10px]">{i.vd_part ?? '—'}</span></td>
                <td className={tdCls}><span className="font-mono text-[10px] text-[#0064D9]">{i.article}</span></td>
                <td className={tdCls}>
                  <div
                    className="text-[#32363A]"
                    title={i.description_pdf && i.description_pdf !== i.description ? `ข้อความเดิมใน PDF: ${i.description_pdf}` : undefined}
                  >
                    {i.description ?? '—'}
                  </div>
                  {i.return_reason && (
                    <span className="inline-block mt-0.5 px-1.5 py-px text-[10px] text-[#32363A] bg-[#F2F4F7] border border-[#D9D9D9] rounded-sm" title="เหตุผลการคืน">
                      {i.return_reason}
                    </span>
                  )}
                  {i.reversed_doc_no && (
                    <span className="inline-block mt-0.5 ml-1 px-1.5 py-px text-[10px] text-[#E9730C] bg-[#FEF7F1] border border-[#E9730C]/40 rounded-sm">
                      ยกเลิกใบ {i.reversed_doc_no}
                    </span>
                  )}
                  {(i.return_reason ? i.remarks.slice(1) : i.remarks).map((r, n) => <div key={n} className="text-[10px] text-[#6A6D70]">*** {r}</div>)}
                </td>
                <td className={tdCls}><span className="font-mono text-[10px]">{i.po}</span></td>
                <td className={clsx(tdCls, 'text-center font-mono text-[10px]')}>{i.mvt}</td>
                <td className={clsx(tdCls, 'text-center text-[10px]')}>{i.unit}</td>
                <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>
                  {fmtNum(i.qty)}
                  {i.base_qty != null && (i.base_qty !== i.qty || i.base_unit !== i.unit) && (
                    <div className="text-[10px] text-[#6A6D70]" title="จำนวนในหน่วยฐาน">= {fmtNum(i.base_qty)} {i.base_unit}</div>
                  )}
                </td>
                <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{fmtNum(i.price, 2)}</td>
                <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{fmtNum(i.amount, 2)}</td>
                <td className={clsx(tdCls, 'text-center text-[#6A6D70] tabular-nums')}>{i.page}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="bg-[#F2F4F7] border-t-2 border-[#D9D9D9] font-semibold">
              <td className={tdCls} colSpan={7}><span className="text-[10px] uppercase text-[#6A6D70]">รวม (ในเอกสาร)</span></td>
              <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{data.total_qty != null ? fmtNum(data.total_qty) : dash}</td>
              <td className={tdCls} />
              <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{data.total != null ? fmtNum(data.total, 2) : dash}</td>
              <td className={tdCls} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default function HpmhRtvReturnSlipsPage() {
  const { can } = useAuth()
  const allowed = can('hpmh-rtv-return-slips.view')
  const canProcess = can('hpmh-rtv-return-slips.edit')
  const [view, setView] = useState<View>('data')

  // ── Data filters ──
  const [search, setSearch] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [movementType, setMovementType] = useState('')
  const [hasPdf, setHasPdf] = useState('')
  const [extract, setExtract] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  // ── File list ──
  const [fileKind, setFileKind] = useState('')
  const [filePage, setFilePage] = useState(1)

  // ── PDF viewer (navigates within the current page of slips that have a PDF) ──
  const [viewIndex, setViewIndex] = useState<number | null>(null)
  // ── Slip whose PDF data is expanded under its row ──
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data: options } = useQuery<Options>({
    queryKey: ['hpmh-rtv-options', VENDOR_NO],
    queryFn: () => api.get(`${API}/options`, { params: { vendor_no: VENDOR_NO } }).then(r => r.data),
    enabled: allowed,
  })

  const { data, isLoading } = useQuery<CrcPaginatedResponse<HpmhRtvReturnSlip, 'quantity' | 'amount'>>({
    queryKey: ['hpmh-rtv-return-slips', VENDOR_NO, debouncedSearch, siteCode, movementType, hasPdf, extract, startDate, endDate, page],
    queryFn: () => api.get(`${API}/return-slips`, {
      params: {
        vendor_no: VENDOR_NO,
        search: debouncedSearch || undefined,
        site_code: siteCode || undefined,
        movement_type: movementType || undefined,
        has_pdf: hasPdf || undefined,
        extract: extract || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        per_page: 50,
      },
    }).then(r => r.data),
    enabled: allowed && view === 'data',
    placeholderData: keepPreviousData,
  })

  const { data: filesData, isLoading: filesLoading } = useQuery<PaginatedResponse<HpmhRtvFile>>({
    queryKey: ['hpmh-rtv-files', VENDOR_NO, fileKind, filePage],
    queryFn: () => api.get(`${API}/files`, {
      params: { vendor_no: VENDOR_NO, file_kind: fileKind || undefined, page: filePage, per_page: 20 },
    }).then(r => r.data),
    enabled: allowed && view === 'files',
  })

  const pdfRows = data?.data.filter(r => r.doc_id) ?? []
  const viewing = viewIndex != null ? pdfRows[viewIndex] : null

  // Pre-signed inline URL (valid 10 min on the server)
  const { data: viewUrl, isLoading: viewUrlLoading, isError: viewUrlError } = useQuery<string>({
    queryKey: ['hpmh-rtv-pdf-url', viewing?.doc_id],
    queryFn: () => api.get<{ url: string }>(`${API}/documents/${viewing!.doc_id}/download`, { params: { inline: 1 } }).then(r => r.data.url),
    enabled: !!viewing?.doc_id,
    staleTime: 8 * 60 * 1000,
  })

  if (!allowed) return <ErpNoAccess />

  const hasFilter = !!(search || siteCode || movementType || hasPdf || extract || startDate || endDate)
  const resetFilters = () => {
    setSearch(''); setSiteCode(''); setMovementType(''); setHasPdf(''); setExtract(''); setStartDate(''); setEndDate(''); setPage(1)
  }

  const downloadPdf = async (docId: number) => {
    try {
      const { data: res } = await api.get<{ url: string }>(`${API}/documents/${docId}/download`)
      window.open(res.url, '_blank', 'noopener')
    } catch {
      alert('ไม่สามารถดาวน์โหลดไฟล์ได้')
    }
  }

  const DATA_COLUMNS: CrcColumn<HpmhRtvReturnSlip>[] = [
    { key: 'article_doc_no', header: 'เลขที่เอกสาร', w: '110px', render: r => <span className="font-mono text-[10px] text-[#0064D9]">{r.article_doc_no ?? '—'}</span> },
    { key: 'gr_date', header: 'GR Date', w: '85px', render: r => <span className="text-[#6A6D70]">{fmtDate(r.gr_date)}</span> },
    { key: 'site', header: 'สาขา', w: '150px', render: r => (
      <>
        <span className="font-mono text-[10px]">{r.site_code ?? '—'}</span>
        {r.site && r.site !== `${r.site_code} - ${r.site_code}` && <TextCell value={r.site} max={150} muted />}
      </>
    ) },
    { key: 'movement_type', header: 'Movement', w: '130px', align: 'center', render: r => (
      <StatusBadge value={r.movement_type} colorMap={MOVEMENT_COLORS} labels={MOVEMENT_LABELS} />
    ) },
    { key: 'quantity', header: 'จำนวน', w: '80px', align: 'right', render: r => <NumCell value={r.quantity} />, total: { key: 'quantity' } },
    { key: 'amount', header: 'มูลค่า', w: '120px', align: 'right', render: r => <NumCell value={r.amount} decimals={2} />, total: { key: 'amount', decimals: 2 } },
    { key: 'extract', header: 'ข้อมูล PDF', w: '110px', align: 'center', render: r => <ExtractBadge slip={r} /> },
    { key: 'created_by', header: 'สร้างโดย', w: '120px', render: r => <TextCell value={r.created_by} max={120} muted /> },
    { key: 'read_time', header: 'อ่านข้อมูลเมื่อ', w: '130px', render: r => <span className="text-[#6A6D70] whitespace-nowrap">{fmtDateTime(r.read_time)}</span> },
    { key: 'pdf', header: 'ใบคืนสินค้า (PDF)', w: '130px', align: 'center', render: r => (
      r.doc_id ? (
        <div className="flex items-center justify-center gap-0.5">
          <button
            onClick={() => setExpandedId(id => (id === r.id ? null : r.id))}
            title={expandedId === r.id ? 'ซ่อนข้อมูลในเอกสาร' : 'ดูข้อมูลในเอกสาร'}
            className={clsx(
              'inline-flex items-center justify-center w-6 h-6 rounded transition-colors',
              expandedId === r.id
                ? 'text-white bg-[#0070F2] hover:bg-[#0064D9]'
                : 'text-[#6A6D70] hover:text-[#0070F2] hover:bg-[#EBF5FB]',
            )}
          >
            <TableProperties className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewIndex(pdfRows.findIndex(p => p.id === r.id))}
            title="ดูใบคืนสินค้า (PDF)"
            className="inline-flex items-center justify-center w-6 h-6 rounded text-[#6A6D70] hover:text-[#0070F2] hover:bg-[#EBF5FB] transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <CrcDownloadButton path={`${API}/documents/${r.doc_id}/download`} title="ดาวน์โหลดใบคืนสินค้า (PDF)" />
        </div>
      ) : <span className="text-[10px] text-[#BB0000]">ยังไม่ดึง</span>
    ) },
  ]

  const FILE_COLUMNS: CrcColumn<HpmhRtvFile>[] = [
    { key: 'id', header: 'ID', w: '50px', align: 'center', render: f => <span className="text-[#6A6D70] font-mono text-[10px]">{f.id}</span> },
    { key: 'file_kind', header: 'ประเภท', w: '70px', align: 'center', render: f => <StatusBadge value={f.file_kind} colorMap={KIND_COLORS} /> },
    { key: 'range', header: 'ช่วง GR Date', w: '160px', render: f => <span className="whitespace-nowrap">{fmtDate(f.gr_date_from)} – {fmtDate(f.gr_date_to)}</span> },
    { key: 'file_name', header: 'ชื่อไฟล์', w: '320px', render: f => <TextCell value={f.file_name} max={320} mono /> },
    { key: 'row_count', header: 'แถวในไฟล์', w: '80px', align: 'right', render: f => f.row_count != null ? <span className="tabular-nums">{fmtNum(f.row_count)}</span> : dash },
    { key: 'linked', header: 'รายการปัจจุบัน', w: '110px', align: 'right', render: f => {
      const n = f.file_kind === 'ZIP' ? f.pdf_count : f.slip_count
      return (
        <span
          className={n === 0 ? 'text-[#6A6D70] tabular-nums' : 'font-semibold tabular-nums'}
          title={n === 0 ? 'ข้อมูลถูกแทนที่ด้วยไฟล์ที่ดึงใหม่กว่าแล้ว' : undefined}
        >
          {fmtNum(n)} {f.file_kind === 'ZIP' ? 'PDF' : 'ใบ'}
        </span>
      )
    } },
    { key: 'file_size', header: 'ขนาดไฟล์', w: '80px', align: 'right', render: f => <span className="text-[#6A6D70]">{fmtBytes(f.file_size)}</span> },
    { key: 'created_at', header: 'ดึงข้อมูลเมื่อ', w: '130px', render: f => <span className="text-[#6A6D70] whitespace-nowrap">{fmtDateTime(f.created_at)}</span> },
    { key: 'actions', header: '', w: '50px', align: 'center', render: f => <CrcDownloadButton path={`${API}/files/${f.id}/download`} /> },
  ]

  const headerCount = view === 'data'
    ? (isLoading ? '...' : `${data?.total?.toLocaleString('th-TH') ?? 0} ใบ`)
    : view === 'files'
      ? (filesLoading ? '...' : `${filesData?.total?.toLocaleString('th-TH') ?? 0} ไฟล์`)
      : undefined

  return (
    <div className="space-y-0 text-[#32363A]">
      <CrcHeader
        section={`HP-MH-RTV / Vendor ${VENDOR_NO}`}
        crumb="Return Slip"
        title="ใบคืนสินค้า (Return Slip)"
        right={headerCount}
      />
      <CrcViewTabs<View>
        tabs={[
          { key: 'data', label: 'รายการใบคืนสินค้า' },
          { key: 'files', label: 'ไฟล์ที่ดึงมา' },
          { key: 'logs', label: 'ประวัติการทำงาน' },
        ]}
        active={view}
        onChange={setView}
      />

      {view === 'data' && (
        <>
          <ExtractProcessBar canProcess={canProcess} />
          <CrcFilterBar hasFilter={hasFilter} onReset={resetFilters}>
            <SapInput label="ค้นหา">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6A6D70]" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="เลขที่เอกสาร, สาขา, ผู้สร้าง..."
                  className={`${inputCls} pl-7 w-64`}
                />
              </div>
            </SapInput>
            <SapInput label="สาขา">
              <select value={siteCode} onChange={e => { setSiteCode(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[140px]`}>
                <option value="">ทั้งหมด</option>
                {options?.sites.map(s => <option key={s.site_code} value={s.site_code}>{s.site_code}</option>)}
              </select>
            </SapInput>
            <SapInput label="Movement Type">
              <select value={movementType} onChange={e => { setMovementType(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[170px]`}>
                <option value="">ทั้งหมด</option>
                {options?.movement_types.map(m => <option key={m} value={m}>{MOVEMENT_LABELS[m] ?? m}</option>)}
              </select>
            </SapInput>
            <SapInput label="PDF">
              <select value={hasPdf} onChange={e => { setHasPdf(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[120px]`}>
                <option value="">ทั้งหมด</option>
                <option value="1">มี PDF</option>
                <option value="0">ยังไม่ดึง</option>
              </select>
            </SapInput>
            <SapInput label="ข้อมูล PDF">
              <select value={extract} onChange={e => { setExtract(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[150px]`}>
                <option value="">ทั้งหมด</option>
                <option value="ok">ตรงกัน</option>
                <option value="issue">ไม่ตรง Excel / มีคำเตือน</option>
                <option value="error">อ่านไม่ได้</option>
                <option value="pending">รอประมวลผล</option>
              </select>
            </SapInput>
            <SapInput label="GR Date ตั้งแต่">
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} className={inputCls} />
            </SapInput>
            <SapInput label="ถึง">
              <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} className={inputCls} />
            </SapInput>
          </CrcFilterBar>
          <CrcTable
            columns={DATA_COLUMNS}
            data={data}
            isLoading={isLoading}
            page={page}
            setPage={setPage}
            emptyText="ไม่พบใบคืนสินค้า"
            emptyIcon={<Undo2 className="w-8 h-8" />}
            unit="ใบ"
            renderExpanded={r => (r.id === expandedId && r.doc_id ? <ReturnSlipExtractTable slip={r} /> : null)}
          />
        </>
      )}

      {view === 'files' && (
        <>
          <CrcFilterBar hasFilter={!!fileKind} onReset={() => { setFileKind(''); setFilePage(1) }}>
            <SapInput label="ประเภทไฟล์">
              <select value={fileKind} onChange={e => { setFileKind(e.target.value); setFilePage(1) }} className={`${inputCls} pr-7 min-w-[160px]`}>
                <option value="">ทั้งหมด</option>
                <option value="EXCEL">EXCEL (รายการใบคืน)</option>
                <option value="ZIP">ZIP (ไฟล์ PDF)</option>
              </select>
            </SapInput>
          </CrcFilterBar>
          <CrcTable
            columns={FILE_COLUMNS}
            data={filesData}
            isLoading={filesLoading}
            page={filePage}
            setPage={setFilePage}
            emptyText="ยังไม่มีไฟล์"
            emptyIcon={<FileArchive className="w-8 h-8" />}
            unit="ไฟล์"
          />
        </>
      )}

      {view === 'logs' && <MtAuditLogTable base={API} queryKey="hpmh-rtv" />}

      <PdfViewer
        open={viewing != null}
        onClose={() => setViewIndex(null)}
        title={viewing ? `ใบคืนสินค้า ${viewing.article_doc_no ?? ''}` : ''}
        subtitle={viewing ? [fmtDate(viewing.gr_date), viewing.site_code, viewing.doc_file_name].filter(Boolean).join(' · ') : undefined}
        src={viewUrlError ? null : viewUrl ?? null}
        loading={viewUrlLoading}
        onDownload={viewing?.doc_id ? () => downloadPdf(viewing.doc_id!) : undefined}
        nav={viewIndex != null ? {
          index: viewIndex,
          total: pdfRows.length,
          onPrev: () => setViewIndex(i => (i != null && i > 0 ? i - 1 : i)),
          onNext: () => setViewIndex(i => (i != null && i < pdfRows.length - 1 ? i + 1 : i)),
        } : undefined}
      />
    </div>
  )
}
