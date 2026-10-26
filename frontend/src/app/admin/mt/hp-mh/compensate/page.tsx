'use client'

import api from '@/lib/api'
import {
  CrcPaginatedResponse, HpmhCompensate, HpmhCompensateDocument, HpmhCompensateFile, HpmhCompensateSaleItem,
  PaginatedResponse,
} from '@/lib/types'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import clsx from 'clsx'
import { Search, FileSpreadsheet, ChevronRight, ChevronDown, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, StatusBadge, SapInput, inputCls, ErpNoAccess, ErpPagination } from '@/components/erp'
import {
  CrcHeader, CrcFilterBar, CrcDownloadButton,
  NumCell, TextCell, dash, fmtNum, fmtBytes, fmtDateTime, useDebounced,
} from '@/components/crc'

const VENDOR_NO = '3263'

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: 'bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40',
  Approve: 'bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40',
  NO_DATA: 'bg-[#F5F5F5] text-[#6A6D70] border-[#D9D9D9]',
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

function LoadingRow({ text = 'กำลังโหลด...' }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 text-xs text-[#6A6D70]">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> {text}
    </div>
  )
}

function InlineSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#6A6D70]" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputCls} pl-6 w-64 h-7 text-xs`}
      />
    </div>
  )
}

// ── Level 4: sale items (compensate_sale_item) of one document ───────────────

type SaleTotalKey = 'billing_qty' | 'total_compensate_amt' | 'return_compensate_amt'

function SaleItems({ documentId }: { documentId: number }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  const { data, isLoading } = useQuery<CrcPaginatedResponse<HpmhCompensateSaleItem, SaleTotalKey>>({
    queryKey: ['hpmh-compensate-sale-items', documentId, debouncedSearch, page],
    queryFn: () => api.get(`/hpmh/compensate-documents/${documentId}/sale-items`, {
      params: { search: debouncedSearch || undefined, page, per_page: 50 },
    }).then(r => r.data),
    placeholderData: keepPreviousData,
  })

  if (isLoading && !data) return <LoadingRow text="กำลังโหลดรายการขาย..." />

  const items = data?.data ?? []
  const totals = data?.totals

  return (
    <div className="bg-white border border-[#E5E5E5]">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[#EBEBEB]">
        <span className="text-[11px] font-semibold text-[#32363A]">รายการขายที่ได้รับชดเชย (Sale Item)</span>
        <InlineSearch value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Article, สาขา, Billing No...." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[1100px]">
          <thead>
            <tr className="bg-[#F9FAFB] border-b border-[#D9D9D9]">
              <th className={clsx(thCls, 'w-12 text-center')}>แถว</th>
              <th className={thCls}>สินค้า</th>
              <th className={clsx(thCls, 'text-center')}>สาขา</th>
              <th className={thCls}>Billing Date</th>
              <th className={thCls}>Billing No.</th>
              <th className={clsx(thCls, 'text-center')}>Item</th>
              <th className={clsx(thCls, 'text-right')}>Qty</th>
              <th className={clsx(thCls, 'text-right')}>ชดเชย/หน่วย</th>
              <th className={clsx(thCls, 'text-right')}>ยอดชดเชย</th>
              <th className={clsx(thCls, 'text-right')}>ชดเชยคืน</th>
              <th className={thCls}>เอกสารคืน</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-6 text-center text-[#6A6D70]">ไม่พบรายการ</td></tr>
            ) : items.map(i => (
              <tr key={i.id} className="border-b border-[#EBEBEB] hover:bg-[#F9FAFB]">
                <td className={clsx(tdCls, 'text-center text-[#6A6D70] tabular-nums')}>{i.row_no ?? '—'}</td>
                <td className={tdCls}>
                  <span className="font-mono text-[10px] text-[#0064D9]">{i.article ?? '—'}</span>
                  <TextCell value={i.article_desc} max={300} />
                </td>
                <td className={clsx(tdCls, 'text-center font-mono text-[10px]')}>{i.store ?? '—'}</td>
                <td className={clsx(tdCls, 'text-[#6A6D70]')}>{fmtDate(i.billing_date)}</td>
                <td className={tdCls}><TextCell value={i.billing_no} mono /></td>
                <td className={clsx(tdCls, 'text-center text-[#6A6D70]')}>{i.billing_item ?? '—'}</td>
                <td className={clsx(tdCls, 'text-right')}><NumCell value={i.billing_qty} /></td>
                <td className={clsx(tdCls, 'text-right')}><NumCell value={i.compensate_amt_per_unit} decimals={2} /></td>
                <td className={clsx(tdCls, 'text-right')}><NumCell value={i.total_compensate_amt} decimals={2} colored /></td>
                <td className={clsx(tdCls, 'text-right')}><NumCell value={i.return_compensate_amt} decimals={2} /></td>
                <td className={tdCls}><TextCell value={i.return_document} mono /></td>
              </tr>
            ))}
          </tbody>
          {totals && items.length > 0 && (
            <tfoot>
              <tr className="bg-[#F2F4F7] border-t-2 border-[#D9D9D9] font-semibold">
                <td className={tdCls} colSpan={6}><span className="text-[10px] uppercase text-[#6A6D70]">รวมทั้งหมด</span></td>
                <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{fmtNum(totals.billing_qty)}</td>
                <td className={tdCls} />
                <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{fmtNum(totals.total_compensate_amt, 2)}</td>
                <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{fmtNum(totals.return_compensate_amt, 2)}</td>
                <td className={tdCls} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {data && <ErpPagination data={data} page={page} setPage={setPage} />}
    </div>
  )
}

// ── Level 3: documents (compensate_document) of one com_id ───────────────────

function CompensateDocuments({ comId }: { comId: string }) {
  const [openDocId, setOpenDocId] = useState<number | null>(null)

  const { data: docs, isLoading } = useQuery<HpmhCompensateDocument[]>({
    queryKey: ['hpmh-compensate-documents', VENDOR_NO, comId],
    queryFn: () => api.get('/hpmh/compensate-documents', { params: { vendor_no: VENDOR_NO, com_id: comId } }).then(r => r.data),
  })

  if (isLoading) return <LoadingRow text="กำลังโหลดเอกสาร..." />
  if (!docs?.length) return <p className="px-4 py-3 text-xs text-[#BB0000]">ยังไม่มีเอกสารของ Com ID นี้</p>

  return (
    <table className="w-full text-xs border-collapse bg-white border border-[#E5E5E5]">
      <thead>
        <tr className="bg-[#F9FAFB] border-b border-[#D9D9D9]">
          <th className={clsx(thCls, 'w-8')} />
          <th className={thCls}>ไฟล์เอกสาร</th>
          <th className={clsx(thCls, 'text-center')}>สถานะ</th>
          <th className={clsx(thCls, 'text-right')}>แถว</th>
          <th className={clsx(thCls, 'text-right')}>ยอดรวม</th>
          <th className={clsx(thCls, 'text-right')}>ขนาดไฟล์</th>
          <th className={thCls}>ดึงข้อมูลเมื่อ</th>
          <th className={clsx(thCls, 'w-10')} />
        </tr>
      </thead>
      <tbody>
        {docs.map(d => {
          const open = openDocId === d.id
          const expandable = (d.row_count ?? 0) > 0
          return (
            <Fragment key={d.id}>
              <tr
                onClick={() => expandable && setOpenDocId(open ? null : d.id)}
                className={clsx(
                  'border-b border-[#EBEBEB] transition-colors',
                  expandable && 'cursor-pointer',
                  open ? 'bg-[#EBF5FE]/60' : 'hover:bg-[#F9FAFB]',
                )}
              >
                <td className={clsx(tdCls, 'text-center')}>{expandable ? <Chevron open={open} /> : null}</td>
                <td className={tdCls}>
                  <TextCell value={d.file_name} max={360} mono />
                  {d.error && <span className="block text-[10px] text-[#BB0000]">{d.error}</span>}
                </td>
                <td className={clsx(tdCls, 'text-center')}><StatusBadge value={d.status} colorMap={STATUS_COLORS} /></td>
                <td className={clsx(tdCls, 'text-right font-semibold tabular-nums')}>{d.row_count != null ? fmtNum(d.row_count) : '—'}</td>
                <td className={clsx(tdCls, 'text-right')}><NumCell value={d.total_amount} decimals={2} /></td>
                <td className={clsx(tdCls, 'text-right text-[#6A6D70]')}>{fmtBytes(d.file_size)}</td>
                <td className={clsx(tdCls, 'text-[#6A6D70] whitespace-nowrap')}>{fmtDateTime(d.downloaded_at)}</td>
                <td className={clsx(tdCls, 'text-center')} onClick={e => e.stopPropagation()}>
                  {d.file_name ? <CrcDownloadButton base="/hpmh" type="compensate-document" id={d.id} title="ดาวน์โหลดไฟล์เอกสาร" /> : dash}
                </td>
              </tr>
              {open && (
                <tr className="border-b border-[#EBEBEB]">
                  <td colSpan={8} className="bg-[#F5F9FE] pl-8 pr-3 py-2.5">
                    <SaleItems documentId={d.id} />
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Level 2: compensate rows of one file ─────────────────────────────────────

function Compensates({ fileId }: { fileId: number }) {
  const [openComId, setOpenComId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  const { data, isLoading } = useQuery<CrcPaginatedResponse<HpmhCompensate, 'total_amount'>>({
    queryKey: ['hpmh-compensates', fileId, debouncedSearch, page],
    queryFn: () => api.get(`/hpmh/compensate-files/${fileId}/compensates`, {
      params: { search: debouncedSearch || undefined, page, per_page: 50 },
    }).then(r => r.data),
    placeholderData: keepPreviousData,
  })

  if (isLoading && !data) return <LoadingRow text="กำลังโหลดรายการชดเชย..." />

  const rows = data?.data ?? []

  return (
    <div className="bg-white border border-[#E5E5E5]">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[#EBEBEB]">
        <span className="text-[11px] font-semibold text-[#32363A]">รายการชดเชย (Compensate)</span>
        <InlineSearch value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Com ID, Reference, เหตุผล..." />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[1100px]">
          <thead>
            <tr className="bg-[#F9FAFB] border-b border-[#D9D9D9]">
              <th className={clsx(thCls, 'w-8')} />
              <th className={thCls}>Com ID</th>
              <th className={thCls}>ช่วงวันที่</th>
              <th className={thCls}>Reference</th>
              <th className={thCls}>เหตุผล</th>
              <th className={thCls}>Acc Doc / Year</th>
              <th className={thCls}>Group No.</th>
              <th className={clsx(thCls, 'text-center')}>สถานะ</th>
              <th className={clsx(thCls, 'text-right')}>ยอดชดเชย</th>
              <th className={clsx(thCls, 'text-center')}>เอกสาร</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-6 text-center text-[#6A6D70]">ไม่พบรายการ</td></tr>
            ) : rows.map(c => {
              const comId = c.com_id ?? ''
              const open = openComId === comId
              return (
                <Fragment key={c.id}>
                  <tr
                    onClick={() => setOpenComId(open ? null : comId)}
                    className={clsx('border-b border-[#EBEBEB] cursor-pointer transition-colors', open ? 'bg-[#EBF5FE]/60' : 'hover:bg-[#F9FAFB]')}
                  >
                    <td className={clsx(tdCls, 'text-center')}><Chevron open={open} /></td>
                    <td className={tdCls}><span className="font-mono text-[10px] text-[#0064D9]">{c.com_id ?? '—'}</span></td>
                    <td className={clsx(tdCls, 'font-mono text-[10px] text-[#6A6D70] whitespace-nowrap')}>
                      {c.start_date ?? '—'} → {c.end_date ?? '—'}
                    </td>
                    <td className={tdCls}><TextCell value={c.reference} max={200} mono /></td>
                    <td className={tdCls}><TextCell value={c.reason} max={180} /></td>
                    <td className={tdCls}><TextCell value={c.acc_doc_year} mono /></td>
                    <td className={tdCls}><TextCell value={c.com_group_no} mono /></td>
                    <td className={clsx(tdCls, 'text-center')}><StatusBadge value={c.status} colorMap={STATUS_COLORS} /></td>
                    <td className={clsx(tdCls, 'text-right')}><NumCell value={c.total_amount} decimals={2} colored /></td>
                    <td className={clsx(tdCls, 'text-center')}>
                      {c.doc_id
                        ? <StatusBadge value={c.doc_status} colorMap={STATUS_COLORS} />
                        : <span className="text-[10px] text-[#BB0000]">ยังไม่ดึง</span>}
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-[#EBEBEB]">
                      <td colSpan={10} className="bg-[#F5F9FE] pl-8 pr-3 py-2.5">
                        <CompensateDocuments comId={comId} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
          {data?.totals && rows.length > 0 && (
            <tfoot>
              <tr className="bg-[#F2F4F7] border-t-2 border-[#D9D9D9] font-semibold">
                <td className={tdCls} colSpan={8}><span className="text-[10px] uppercase text-[#6A6D70]">รวมทั้งหมด</span></td>
                <td className={clsx(tdCls, 'text-right font-mono tabular-nums')}>{fmtNum(data.totals.total_amount, 2)}</td>
                <td className={tdCls} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {data && <ErpPagination data={data} page={page} setPage={setPage} />}
    </div>
  )
}

// ── Level 1: compensate files ────────────────────────────────────────────────

export default function HpmhCompensatePage() {
  const { can } = useAuth()
  const allowed = can('hpmh-compensate.view')

  const [search, setSearch] = useState('')
  const [comType, setComType] = useState('')
  const [page, setPage] = useState(1)
  const [openFileId, setOpenFileId] = useState<number | null>(null)
  const debouncedSearch = useDebounced(search)

  const { data: types } = useQuery<string[]>({
    queryKey: ['hpmh-compensate-types', VENDOR_NO],
    queryFn: () => api.get('/hpmh/compensate-types', { params: { vendor_no: VENDOR_NO } }).then(r => r.data),
    enabled: allowed,
  })

  const { data, isLoading } = useQuery<PaginatedResponse<HpmhCompensateFile>>({
    queryKey: ['hpmh-compensate-files', VENDOR_NO, debouncedSearch, comType, page],
    queryFn: () => api.get('/hpmh/compensate-files', {
      params: {
        vendor_no: VENDOR_NO,
        search: debouncedSearch || undefined,
        com_type: comType || undefined,
        page,
        per_page: 20,
      },
    }).then(r => r.data),
    enabled: allowed,
    placeholderData: keepPreviousData,
  })

  if (!allowed) return <ErpNoAccess />

  const files = data?.data ?? []
  const hasFilter = !!(search || comType)
  const resetFilters = () => { setSearch(''); setComType(''); setPage(1) }

  return (
    <div className="space-y-0 text-[#32363A]">
      <CrcHeader
        section={`HP-MH / Vendor ${VENDOR_NO}`}
        crumb="Compensate"
        title="ชดเชยราคา (Compensate)"
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
        <SapInput label="ประเภท">
          <select value={comType} onChange={e => { setComType(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[120px]`}>
            <option value="">ทั้งหมด</option>
            {types?.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </SapInput>
      </CrcFilterBar>

      <div className="bg-white border border-[#D9D9D9] border-t-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-[#F2F4F7] border-b-2 border-[#0070F2]">
              <th className={clsx(thCls, 'w-8')} />
              <th className={clsx(thCls, 'w-12 text-center')}>ID</th>
              <th className={clsx(thCls, 'text-center')}>ประเภท</th>
              <th className={thCls}>ชื่อไฟล์</th>
              <th className={clsx(thCls, 'text-right')}>แถวในไฟล์</th>
              <th className={clsx(thCls, 'text-right')}>รายการชดเชย</th>
              <th className={clsx(thCls, 'text-right')}>ขนาดไฟล์</th>
              <th className={thCls}>ดึงข้อมูลเมื่อ</th>
              <th className={clsx(thCls, 'w-10')} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(4)].map((_, i) => (
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
                    <td className={clsx(tdCls, 'text-center')}>{f.com_type ?? '—'}</td>
                    <td className={tdCls}><TextCell value={f.file_name} max={340} mono /></td>
                    <td className={clsx(tdCls, 'text-right tabular-nums')}>{f.row_count != null ? fmtNum(f.row_count) : '—'}</td>
                    <td
                      className={clsx(tdCls, 'text-right font-semibold tabular-nums', f.compensate_count === 0 && 'text-[#6A6D70]')}
                      title={f.compensate_count === 0 ? 'รายการถูกย้ายไปผูกกับไฟล์ที่ดึงใหม่กว่าแล้ว' : undefined}
                    >
                      {fmtNum(f.compensate_count)}
                    </td>
                    <td className={clsx(tdCls, 'text-right text-[#6A6D70]')}>{fmtBytes(f.file_size)}</td>
                    <td className={clsx(tdCls, 'text-[#6A6D70] whitespace-nowrap')}>{fmtDateTime(f.downloaded_at)}</td>
                    <td className={clsx(tdCls, 'text-center')} onClick={e => e.stopPropagation()}>
                      <CrcDownloadButton base="/hpmh" type="compensate" id={f.id} title="ดาวน์โหลดไฟล์ Excel" />
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-[#D9D9D9]">
                      <td colSpan={9} className="bg-[#F5F9FE] pl-8 pr-3 py-3">
                        {f.compensate_count === 0
                          ? <p className="px-1 py-2 text-xs text-[#6A6D70]">ไม่มีรายการผูกกับไฟล์นี้ (รายการถูกย้ายไปผูกกับไฟล์ที่ดึงใหม่กว่าแล้ว)</p>
                          : <Compensates fileId={f.id} />}
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
