'use client'

import api from '@/lib/api'
import { HpmhReceiptExtract, HpmhReceiptFile, HpmhReceiptRow, PaginatedResponse } from '@/lib/types'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Fragment, useState } from 'react'
import clsx from 'clsx'
import {
  Search, FileSpreadsheet, ChevronRight, ChevronDown, Loader2, FileText, Eye, TableProperties, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import PdfViewer from '@/components/ui/PdfViewer'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, StatusBadge, SapInput, inputCls, ErpNoAccess, ErpPagination } from '@/components/erp'
import {
  CrcHeader, CrcFilterBar, CrcDownloadButton,
  TextCell, dash, fmtNum, fmtBytes, fmtDateTime, useDebounced,
} from '@/components/crc'

const VENDOR_NO = '501447'

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: 'bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40',
  FAILED:  'bg-[#FFEBEB] text-[#BB0000] border-[#BB0000]/40',
  ERROR:   'bg-[#FFEBEB] text-[#BB0000] border-[#BB0000]/40',
  PENDING: 'bg-[#FEF7F1] text-[#E9730C] border-[#E9730C]/40',
}

const thCls = 'px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[#6A6D70] whitespace-nowrap border-r border-[#E5E5E5] last:border-r-0'
const tdCls = 'px-2.5 py-1.5 border-r border-[#EBEBEB] last:border-r-0 align-middle'

function Chevron({ open }: { open: boolean }) {
  return open
    ? <ChevronDown className="w-3.5 h-3.5 text-[#0070F2]" />
    : <ChevronRight className="w-3.5 h-3.5 text-[#6A6D70]" />
}

async function downloadReceipt(docId: number) {
  try {
    const { data } = await api.get<{ url: string }>(`/hpmh/files/receipt/${docId}/download`)
    window.open(data.url, '_blank', 'noopener')
  } catch {
    alert('ไม่สามารถดาวน์โหลดไฟล์ได้')
  }
}

function ViewPdfButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="ดูใบเสร็จ (PDF)"
      className="inline-flex items-center justify-center w-6 h-6 rounded text-[#6A6D70] hover:text-[#0070F2] hover:bg-[#EBF5FB] transition-colors"
    >
      <Eye className="w-3.5 h-3.5" />
    </button>
  )
}

// ── Table read out of the receipt PDF (pdfplumber, cached on the server) ─────

function ReceiptExtractTable({ docId }: { docId: number }) {
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const queryKey = ['hpmh-receipt-extract', docId]

  const { data, isLoading, error } = useQuery<HpmhReceiptExtract>({
    queryKey,
    queryFn: () => api.get(`/hpmh/receipt-documents/${docId}/extract`).then(r => r.data),
    staleTime: Infinity,
    retry: false,
  })

  const reExtract = async () => {
    setRefreshing(true)
    try {
      const { data: fresh } = await api.get(`/hpmh/receipt-documents/${docId}/extract`, { params: { refresh: 1 } })
      queryClient.setQueryData(queryKey, fresh)
    } catch {
      alert('อ่านข้อมูลจาก PDF ใหม่ไม่สำเร็จ')
    } finally {
      setRefreshing(false)
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

  const balanced = data.total != null && Math.abs(data.items_sum - data.total) < 0.01

  return (
    <div className="mt-3 border border-[#E5E5E5] rounded-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#F9FAFB] border-b border-[#E5E5E5]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span className="font-semibold text-[#32363A]">ข้อมูลในเอกสาร</span>
          <span className="text-[#6A6D70]">
            Invoice {fmtNum(data.invoice_count)} รายการ
            {data.credit_note_count > 0 && <> · Credit note {fmtNum(data.credit_note_count)} รายการ</>}
            {' '}· {data.pages} หน้า
          </span>
          {data.warnings.length === 0 && balanced ? (
            <span className="inline-flex items-center gap-1 text-[#107E3E]">
              <CheckCircle2 className="w-3 h-3" /> ผลรวมตรงกับยอดในเอกสาร
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[#E9730C]" title={data.warnings.join('\n')}>
              <AlertTriangle className="w-3 h-3" /> {data.warnings[0] ?? 'ผลรวมไม่ตรงกับยอดในเอกสาร'}
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

      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#F2F4F7] border-b border-[#D9D9D9]">
              <th className={clsx(thCls, 'w-14 text-center')}>ลำดับ</th>
              <th className={thCls}>ประเภท</th>
              <th className={thCls}>เลขที่ Invoice</th>
              <th className={clsx(thCls, 'text-center')}>Ref Type</th>
              <th className={thCls}>เลขอ้างอิง</th>
              <th className={clsx(thCls, 'text-right')}>จำนวนเงิน</th>
              <th className={clsx(thCls, 'w-14 text-center')}>หน้า</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-[#6A6D70]">ไม่พบรายการในเอกสาร</td></tr>
            ) : data.items.map(i => (
              <tr key={`${i.kind}-${i.no}`} className="border-b border-[#EBEBEB] hover:bg-[#F9FAFB]">
                <td className={clsx(tdCls, 'text-center text-[#6A6D70] tabular-nums')}>{i.no}</td>
                <td className={tdCls}>
                  {i.kind === 'credit_note'
                    ? <span className="text-[10px] font-semibold text-[#BB0000]">Credit note</span>
                    : <span className="text-[10px] text-[#32363A]">Invoice</span>}
                </td>
                <td className={tdCls}><span className="font-mono text-[10px] text-[#0064D9]">{i.invoice_no ?? '—'}</span></td>
                <td className={clsx(tdCls, 'text-center font-mono text-[10px]')}>{i.ref_type}</td>
                <td className={tdCls}><span className="font-mono text-[10px]">{i.ref_no}</span></td>
                <td className={clsx(tdCls, 'text-right font-mono tabular-nums', i.amount < 0 && 'text-[#BB0000]')}>
                  {fmtNum(i.amount, 2)}
                </td>
                <td className={clsx(tdCls, 'text-center text-[#6A6D70] tabular-nums')}>{i.page}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0">
            {data.credit_note_count > 0 && (
              <>
                <tr className="bg-[#F9FAFB] border-t border-[#D9D9D9]">
                  <td className={tdCls} colSpan={5}><span className="text-[10px] text-[#6A6D70]">รวม Invoice</span></td>
                  <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{fmtNum(data.invoice_sum, 2)}</td>
                  <td className={tdCls} />
                </tr>
                <tr className="bg-[#F9FAFB]">
                  <td className={tdCls} colSpan={5}><span className="text-[10px] text-[#6A6D70]">รวม Credit note</span></td>
                  <td className={clsx(tdCls, 'text-right font-mono tabular-nums text-[#BB0000]')}>{fmtNum(data.credit_note_sum, 2)}</td>
                  <td className={tdCls} />
                </tr>
              </>
            )}
            <tr className="bg-[#F2F4F7] border-t-2 border-[#D9D9D9] font-semibold">
              <td className={tdCls} colSpan={5}><span className="text-[10px] uppercase text-[#6A6D70]">ยอดรวม (ตามเอกสาร)</span></td>
              <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{data.total != null ? fmtNum(data.total, 2) : '—'}</td>
              <td className={tdCls} />
            </tr>
            {data.withholding_tax != null && (
              <tr className="bg-[#F2F4F7]">
                <td className={tdCls} colSpan={5}>
                  <span className="text-[10px] text-[#6A6D70]">ภาษีหัก ณ ที่จ่าย 40(8) {data.withholding_rate ?? ''}%</span>
                </td>
                <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{fmtNum(data.withholding_tax, 2)}</td>
                <td className={tdCls} />
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Level 3: receipt PDF (receipt_document) of one excel row ─────────────────

function DocumentDetail({ row, onView }: { row: HpmhReceiptRow; onView: () => void }) {
  const [showData, setShowData] = useState(false)

  if (!row.doc_id) {
    return <p className="px-4 py-3 text-xs text-[#BB0000]">ยังไม่มีไฟล์ใบเสร็จ PDF ของ Payment Doc นี้</p>
  }

  const fields: [string, React.ReactNode][] = [
    ['เลขที่เอกสาร', <span className="font-mono">{row.doc_doc_no ?? '—'}</span>],
    ['Posting Date', fmtDate(row.doc_posting_date)],
    ['Doc Type', row.doc_doc_type ?? '—'],
    ['Company Code', row.doc_comp_code ?? '—'],
    ['Customer No.', <span className="font-mono">{row.doc_customer_no ?? '—'}</span>],
    ['Email', row.doc_email ?? '—'],
    ['สถานะ', <StatusBadge value={row.doc_status} colorMap={STATUS_COLORS} />],
    ['ขนาดไฟล์', fmtBytes(row.doc_file_size)],
    ['ชื่อไฟล์', <TextCell value={row.doc_file_name} max={360} mono />],
    ['ไฟล์ต้นทาง', <TextCell value={row.doc_source_file_name} max={360} mono />],
    ['SAP Path', <TextCell value={row.doc_sap_path} max={360} mono muted />],
    ['พิมพ์เมื่อ', fmtDateTime(row.doc_vendor_print_at)],
    ['ดึงข้อมูลเมื่อ', fmtDateTime(row.doc_downloaded_at)],
    ['อัปเดตเมื่อ', fmtDateTime(row.doc_updated_at)],
  ]

  return (
    <div className="px-4 py-3 bg-white border border-[#E5E5E5] rounded-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#32363A]">
          <FileText className="w-3.5 h-3.5 text-[#BB0000]" /> ใบเสร็จรับเงิน (PDF)
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowData(v => !v)}
            className={clsx(
              'inline-flex items-center gap-1 h-6 px-2 text-[10px] font-semibold border rounded transition-colors',
              showData
                ? 'text-white bg-[#0070F2] border-[#0070F2] hover:bg-[#0064D9]'
                : 'text-[#0070F2] border-[#0070F2]/40 hover:bg-[#EBF5FE]',
            )}
          >
            <TableProperties className="w-3 h-3" /> {showData ? 'ซ่อนข้อมูล' : 'ดูข้อมูลในเอกสาร'}
          </button>
          <button
            onClick={onView}
            className="inline-flex items-center gap-1 h-6 px-2 text-[10px] font-semibold text-[#0070F2] border border-[#0070F2]/40 rounded hover:bg-[#EBF5FE] transition-colors"
          >
            <Eye className="w-3 h-3" /> ดูเอกสาร
          </button>
          <CrcDownloadButton base="/hpmh" type="receipt" id={row.doc_id} title="ดาวน์โหลดใบเสร็จ (PDF)" />
        </div>
      </div>
      <dl className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-1.5 text-xs">
        {fields.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] text-[#6A6D70]">{label}</dt>
            <dd className="text-[#32363A] min-w-0">{value}</dd>
          </div>
        ))}
      </dl>
      {row.doc_error && <p className="mt-2 text-[11px] text-[#BB0000]">Error: {row.doc_error}</p>}
      {showData && <ReceiptExtractTable docId={row.doc_id} />}
    </div>
  )
}

// ── Level 2: excel rows (receipt_excel_row) of one file ──────────────────────

function FileRows({ fileId }: { fileId: number }) {
  const [openRowId, setOpenRowId] = useState<number | null>(null)

  const { data: rows, isLoading } = useQuery<HpmhReceiptRow[]>({
    queryKey: ['hpmh-receipt-file-rows', fileId],
    queryFn: () => api.get(`/hpmh/receipt-files/${fileId}/rows`).then(r => r.data),
  })

  // PDF viewer navigates between the rows of this file that have a receipt PDF
  const pdfRows = rows?.filter(r => r.doc_id) ?? []
  const [viewIndex, setViewIndex] = useState<number | null>(null)
  const viewing = viewIndex != null ? pdfRows[viewIndex] : null
  const openViewer = (row: HpmhReceiptRow) => setViewIndex(pdfRows.findIndex(r => r.id === row.id))

  // Pre-signed inline URL (valid 10 min on the server)
  const { data: viewUrl, isLoading: viewUrlLoading, isError: viewUrlError } = useQuery<string>({
    queryKey: ['hpmh-receipt-pdf-url', viewing?.doc_id],
    queryFn: () => api.get<{ url: string }>(`/hpmh/files/receipt/${viewing!.doc_id}/download`, { params: { inline: 1 } }).then(r => r.data.url),
    enabled: !!viewing?.doc_id,
    staleTime: 8 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-[#6A6D70]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลดรายการ...
      </div>
    )
  }
  if (!rows?.length) return <p className="px-4 py-3 text-xs text-[#6A6D70]">ไม่มีรายการในไฟล์นี้</p>

  return (
    <>
    <table className="w-full text-xs border-collapse bg-white border border-[#E5E5E5]">
      <thead>
        <tr className="bg-[#F9FAFB] border-b border-[#D9D9D9]">
          <th className={clsx(thCls, 'w-8')} />
          <th className={clsx(thCls, 'w-12 text-center')}>แถว</th>
          <th className={thCls}>Payment Doc</th>
          <th className={thCls}>Payment Date</th>
          <th className={clsx(thCls, 'text-center')}>มี Email</th>
          <th className={thCls}>Company</th>
          <th className={thCls}>พิมพ์เมื่อ</th>
          <th className={clsx(thCls, 'text-center')}>ใบเสร็จ PDF</th>
          <th className={clsx(thCls, 'w-16')} />
        </tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const open = openRowId === r.id
          return (
            <Fragment key={r.id}>
              <tr
                onClick={() => setOpenRowId(open ? null : r.id)}
                className={clsx('border-b border-[#EBEBEB] cursor-pointer transition-colors', open ? 'bg-[#EBF5FE]/60' : 'hover:bg-[#F9FAFB]')}
              >
                <td className={clsx(tdCls, 'text-center')}><Chevron open={open} /></td>
                <td className={clsx(tdCls, 'text-center text-[#6A6D70] tabular-nums')}>{r.row_no ?? '—'}</td>
                <td className={tdCls}><span className="font-mono text-[10px] text-[#0064D9]">{r.payment_doc ?? '—'}</span></td>
                <td className={clsx(tdCls, 'text-[#6A6D70]')}>{fmtDate(r.payment_date)}</td>
                <td className={clsx(tdCls, 'text-center text-[#6A6D70]')}>{r.have_email ?? '—'}</td>
                <td className={tdCls}>{r.company ?? '—'}</td>
                <td className={clsx(tdCls, 'text-[#6A6D70] whitespace-nowrap')}>{fmtDateTime(r.vendor_print_at)}</td>
                <td className={clsx(tdCls, 'text-center')}>
                  {r.doc_id
                    ? <StatusBadge value={r.doc_status} colorMap={STATUS_COLORS} />
                    : <span className="text-[10px] text-[#BB0000]">ยังไม่ดึง</span>}
                </td>
                <td className={clsx(tdCls, 'text-center whitespace-nowrap')} onClick={e => e.stopPropagation()}>
                  {r.doc_id ? (
                    <div className="flex items-center justify-center gap-0.5">
                      <ViewPdfButton onClick={() => openViewer(r)} />
                      <CrcDownloadButton base="/hpmh" type="receipt" id={r.doc_id} title="ดาวน์โหลดใบเสร็จ (PDF)" />
                    </div>
                  ) : dash}
                </td>
              </tr>
              {open && (
                <tr className="border-b border-[#EBEBEB]">
                  <td colSpan={9} className="bg-[#F5F9FE] pl-10 pr-3 py-2.5">
                    <DocumentDetail row={r} onView={() => openViewer(r)} />
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>

    <PdfViewer
      open={viewing != null}
      onClose={() => setViewIndex(null)}
      title={viewing ? `ใบเสร็จรับเงิน ${viewing.doc_doc_no ?? viewing.payment_doc ?? ''}` : ''}
      subtitle={viewing ? [fmtDate(viewing.doc_posting_date), viewing.doc_file_name].filter(Boolean).join(' · ') : undefined}
      src={viewUrlError ? null : viewUrl ?? null}
      loading={viewUrlLoading}
      onDownload={viewing?.doc_id ? () => downloadReceipt(viewing.doc_id!) : undefined}
      nav={viewIndex != null ? {
        index: viewIndex,
        total: pdfRows.length,
        onPrev: () => setViewIndex(i => (i != null && i > 0 ? i - 1 : i)),
        onNext: () => setViewIndex(i => (i != null && i < pdfRows.length - 1 ? i + 1 : i)),
      } : undefined}
    />
    </>
  )
}

// ── Level 1: receipt files (receipt_file) ────────────────────────────────────

export default function HpmhReceiptsPage() {
  const { can } = useAuth()
  const allowed = can('hpmh-receipts.view')

  const [search, setSearch] = useState('')
  const [fiscalYear, setFiscalYear] = useState('')
  const [latestOnly, setLatestOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [openFileId, setOpenFileId] = useState<number | null>(null)
  const debouncedSearch = useDebounced(search)

  const { data: yearOptions } = useQuery<{ fiscal_years: number[] }>({
    queryKey: ['hpmh-receipt-fiscal-years', VENDOR_NO],
    queryFn: () => api.get('/hpmh/receipt-fiscal-years', { params: { vendor_no: VENDOR_NO } }).then(r => r.data),
    enabled: allowed,
  })

  const { data, isLoading } = useQuery<PaginatedResponse<HpmhReceiptFile>>({
    queryKey: ['hpmh-receipt-files', VENDOR_NO, debouncedSearch, fiscalYear, latestOnly, page],
    queryFn: () => api.get('/hpmh/receipt-files', {
      params: {
        vendor_no: VENDOR_NO,
        search: debouncedSearch || undefined,
        fiscal_year: fiscalYear || undefined,
        latest_only: latestOnly ? 1 : undefined,
        page,
        per_page: 20,
      },
    }).then(r => r.data),
    enabled: allowed,
    placeholderData: keepPreviousData,
  })

  if (!allowed) return <ErpNoAccess />

  const files = data?.data ?? []
  const hasFilter = !!(search || fiscalYear || latestOnly)
  const resetFilters = () => { setSearch(''); setFiscalYear(''); setLatestOnly(false); setPage(1) }

  return (
    <div className="space-y-0 text-[#32363A]">
      <CrcHeader
        section={`HP-MH / Vendor ${VENDOR_NO}`}
        crumb="ใบเสร็จรับเงิน"
        title="ใบเสร็จรับเงิน (Receipt)"
        right={isLoading ? '...' : `${data?.total?.toLocaleString('th-TH') ?? 0} ไฟล์`}
      />

      <CrcFilterBar hasFilter={hasFilter} onReset={resetFilters}>
        <SapInput label="ค้นหา">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6A6D70]" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="ชื่อไฟล์..."
              className={`${inputCls} pl-7 w-64`}
            />
          </div>
        </SapInput>
        <SapInput label="ปีบัญชี">
          <select value={fiscalYear} onChange={e => { setFiscalYear(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[100px]`}>
            <option value="">ทั้งหมด</option>
            {yearOptions?.fiscal_years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </SapInput>
        <label className="flex items-center gap-1.5 h-7 text-xs text-[#32363A] cursor-pointer select-none">
          <input type="checkbox" checked={latestOnly} onChange={e => { setLatestOnly(e.target.checked); setPage(1) }} />
          เฉพาะไฟล์ล่าสุดของแต่ละปีบัญชี
        </label>
      </CrcFilterBar>

      <div className="bg-white border border-[#D9D9D9] border-t-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-[#F2F4F7] border-b-2 border-[#0070F2]">
              <th className={clsx(thCls, 'w-8')} />
              <th className={clsx(thCls, 'w-12 text-center')}>ID</th>
              <th className={clsx(thCls, 'text-center')}>ปีบัญชี</th>
              <th className={thCls}>ชื่อไฟล์</th>
              <th className={clsx(thCls, 'text-right')}>แถว</th>
              <th className={clsx(thCls, 'text-center')}>มี PDF</th>
              <th className={clsx(thCls, 'text-right')}>ขนาดไฟล์</th>
              <th className={thCls}>ดึงข้อมูลเมื่อ</th>
              <th className={clsx(thCls, 'w-10')} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="border-b border-[#EBEBEB]">
                  {[...Array(9)].map((__, j) => (
                    <td key={j} className={tdCls}><div className="h-2.5 bg-[#F2F4F7] rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : files.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-[#6A6D70] text-sm">
                  <div className="flex justify-center mb-2 text-[#D9D9D9]"><FileSpreadsheet className="w-8 h-8" /></div>
                  ยังไม่มีไฟล์
                </td>
              </tr>
            ) : files.map(f => {
              const open = openFileId === f.id
              return (
                <Fragment key={f.id}>
                  <tr
                    onClick={() => setOpenFileId(open ? null : f.id)}
                    className={clsx('border-b border-[#EBEBEB] cursor-pointer transition-colors', open ? 'bg-[#EBF5FE]' : 'hover:bg-[#F9FAFB]')}
                  >
                    <td className={clsx(tdCls, 'text-center')}><Chevron open={open} /></td>
                    <td className={clsx(tdCls, 'text-center text-[#6A6D70] font-mono text-[10px]')}>{f.id}</td>
                    <td className={clsx(tdCls, 'text-center tabular-nums')}>{f.fiscal_year ?? '—'}</td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <TextCell value={f.file_name} max={340} mono />
                        {f.is_latest && (
                          <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-semibold rounded-sm border bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40">ล่าสุด</span>
                        )}
                      </div>
                    </td>
                    <td className={clsx(tdCls, 'text-right font-semibold tabular-nums')}>{f.row_count != null ? fmtNum(f.row_count) : '—'}</td>
                    <td className={clsx(tdCls, 'text-center tabular-nums')}>
                      <span className={f.row_count != null && f.pdf_count < f.row_count ? 'text-[#E9730C]' : 'text-[#107E3E]'}>
                        {fmtNum(f.pdf_count)} / {f.row_count != null ? fmtNum(f.row_count) : '—'}
                      </span>
                    </td>
                    <td className={clsx(tdCls, 'text-right text-[#6A6D70]')}>{fmtBytes(f.file_size)}</td>
                    <td className={clsx(tdCls, 'text-[#6A6D70] whitespace-nowrap')}>{fmtDateTime(f.downloaded_at)}</td>
                    <td className={clsx(tdCls, 'text-center')} onClick={e => e.stopPropagation()}>
                      <CrcDownloadButton base="/hpmh" type="receipt-excel" id={f.id} title="ดาวน์โหลดไฟล์ Excel" />
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-[#D9D9D9]">
                      <td colSpan={9} className="bg-[#F5F9FE] pl-8 pr-3 py-3">
                        <FileRows fileId={f.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {data && <ErpPagination data={data} page={page} setPage={setPage} unit="ไฟล์" />}
      </div>
    </div>
  )
}
