'use client'

import api from '@/lib/api'
import { CrcPaginatedResponse, HpmhRtvFile, HpmhRtvReturnSlip, PaginatedResponse } from '@/lib/types'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Undo2, FileArchive, Eye } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, StatusBadge, SapInput, inputCls, ErpNoAccess } from '@/components/erp'
import PdfViewer from '@/components/ui/PdfViewer'
import {
  CrcHeader, CrcViewTabs, CrcFilterBar, CrcTable, CrcDownloadButton, MtAuditLogTable,
  NumCell, TextCell, dash, fmtNum, fmtBytes, fmtDateTime, useDebounced, type CrcColumn,
} from '@/components/crc'

type View = 'data' | 'files' | 'logs'

const VENDOR_NO = '501447'
const API = '/hpmh-rtv'

type Options = {
  sites: { site_code: string; site: string | null }[]
  movement_types: string[]
}

const MOVEMENT_LABELS: Record<string, string> = {
  '161': '161 · คืนสินค้า',
  '162': '162 · ยกเลิกการคืน',
}
const MOVEMENT_COLORS: Record<string, string> = {
  '161': 'bg-[#EBF5FE] text-[#0070F2] border-[#0070F2]/40',
  '162': 'bg-[#FEF7F1] text-[#E9730C] border-[#E9730C]/40',
}
const KIND_COLORS: Record<string, string> = {
  EXCEL: 'bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40',
  ZIP:   'bg-[#F5F5F5] text-[#6A6D70] border-[#D9D9D9]',
}

export default function HpmhRtvReturnSlipsPage() {
  const { can } = useAuth()
  const allowed = can('hpmh-rtv-return-slips.view')
  const [view, setView] = useState<View>('data')

  // ── Data filters ──
  const [search, setSearch] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [movementType, setMovementType] = useState('')
  const [hasPdf, setHasPdf] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  // ── File list ──
  const [fileKind, setFileKind] = useState('')
  const [filePage, setFilePage] = useState(1)

  // ── PDF viewer (navigates within the current page of slips that have a PDF) ──
  const [viewIndex, setViewIndex] = useState<number | null>(null)

  const { data: options } = useQuery<Options>({
    queryKey: ['hpmh-rtv-options', VENDOR_NO],
    queryFn: () => api.get(`${API}/options`, { params: { vendor_no: VENDOR_NO } }).then(r => r.data),
    enabled: allowed,
  })

  const { data, isLoading } = useQuery<CrcPaginatedResponse<HpmhRtvReturnSlip, 'quantity' | 'amount'>>({
    queryKey: ['hpmh-rtv-return-slips', VENDOR_NO, debouncedSearch, siteCode, movementType, hasPdf, startDate, endDate, page],
    queryFn: () => api.get(`${API}/return-slips`, {
      params: {
        vendor_no: VENDOR_NO,
        search: debouncedSearch || undefined,
        site_code: siteCode || undefined,
        movement_type: movementType || undefined,
        has_pdf: hasPdf || undefined,
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

  const hasFilter = !!(search || siteCode || movementType || hasPdf || startDate || endDate)
  const resetFilters = () => {
    setSearch(''); setSiteCode(''); setMovementType(''); setHasPdf(''); setStartDate(''); setEndDate(''); setPage(1)
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
    { key: 'created_by', header: 'สร้างโดย', w: '120px', render: r => <TextCell value={r.created_by} max={120} muted /> },
    { key: 'read_time', header: 'อ่านข้อมูลเมื่อ', w: '130px', render: r => <span className="text-[#6A6D70] whitespace-nowrap">{fmtDateTime(r.read_time)}</span> },
    { key: 'pdf', header: 'ใบคืนสินค้า (PDF)', w: '110px', align: 'center', render: r => (
      r.doc_id ? (
        <div className="flex items-center justify-center gap-0.5">
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
