'use client'

import api from '@/lib/api'
import { HpmhCorrespondence, HpmhCorrespondenceFile, PaginatedResponse } from '@/lib/types'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import { Search, Mail, FileSpreadsheet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, StatusBadge, SapInput, inputCls, ErpNoAccess } from '@/components/erp'
import {
  CrcHeader, CrcViewTabs, CrcFilterBar, CrcTable, CrcDownloadButton,
  TextCell, dash, fmtNum, fmtBytes, fmtDateTime, useDebounced, type CrcColumn,
} from '@/components/crc'

type View = 'list' | 'files'

const ATTACHMENT_COLORS: Record<string, string> = {
  COUPON:  'bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40',
  LEAFLET: 'bg-[#EBF5FE] text-[#0070F2] border-[#0070F2]/40',
  PDF:     'bg-[#F5F5F5] text-[#6A6D70] border-[#D9D9D9]',
}

const DETAIL_PAGES: Record<string, string> = {
  COUPON: '/admin/mt/hp-mh/coupons',
  LEAFLET: '/admin/mt/hp-mh/leaflets',
}

const COLUMNS: CrcColumn<HpmhCorrespondence>[] = [
  { key: 'content_item_id', header: 'Content ID', w: '80px', render: r => <span className="font-mono text-[10px] text-[#0064D9]">{r.content_item_id}</span> },
  { key: 'subject', header: 'Subject', w: '200px', render: r => <span className="font-semibold">{r.subject ?? '—'}</span> },
  { key: 'main_detail', header: 'Detail', w: '300px', render: r => <TextCell value={r.main_detail} max={300} muted /> },
  { key: 'period', header: 'ช่วงวันที่', w: '170px', render: r => (
    <span className="font-mono text-[10px] text-[#6A6D70] whitespace-nowrap">
      {r.new_date_from ?? '—'} → {r.new_date_to ?? '—'}
    </span>
  ) },
  { key: 'effective', header: 'Effective', w: '90px', render: r => <span className="text-[#6A6D70]">{fmtDate(r.effective_date_from)}</span> },
  { key: 'attachment_type', header: 'ไฟล์แนบ', w: '90px', align: 'center', render: r => (
    r.attachment_id
      ? <StatusBadge value={r.attachment_type} colorMap={ATTACHMENT_COLORS} />
      : <span className="text-[10px] text-[#BB0000]">{r.has_attachment ? 'ยังไม่ดึง' : 'ไม่มี'}</span>
  ) },
  { key: 'parsed_rows', header: 'แถวข้อมูล', w: '110px', align: 'right', render: r => {
    const href = r.attachment_type ? DETAIL_PAGES[r.attachment_type] : undefined
    if (!href || r.parsed_rows == null) return dash
    return (
      <Link
        href={`${href}?content_item_id=${r.content_item_id}`}
        className="font-semibold tabular-nums text-[#0070F2] hover:underline whitespace-nowrap"
      >
        {fmtNum(r.parsed_rows)} แถว ›
      </Link>
    )
  } },
  { key: 'actions', header: '', w: '50px', align: 'center', render: r => (
    r.attachment_id
      ? <CrcDownloadButton base="/hpmh" type="attachment" id={r.attachment_id} title={r.attachment ?? 'ดาวน์โหลดไฟล์แนบ'} />
      : dash
  ) },
]

const FILE_COLUMNS: CrcColumn<HpmhCorrespondenceFile>[] = [
  { key: 'id', header: 'ID', w: '50px', align: 'center', render: f => <span className="text-[#6A6D70] font-mono text-[10px]">{f.id}</span> },
  { key: 'vendor_no', header: 'Vendor', w: '80px', render: f => <span className="font-mono text-[10px]">{f.vendor_no ?? '—'}</span> },
  { key: 'file_name', header: 'ชื่อไฟล์', w: '340px', render: f => <TextCell value={f.file_name} max={340} mono /> },
  { key: 'row_count', header: 'แถว', w: '80px', align: 'right', render: f => f.row_count != null ? <span className="font-semibold tabular-nums">{fmtNum(f.row_count)}</span> : dash },
  { key: 'file_size', header: 'ขนาดไฟล์', w: '80px', align: 'right', render: f => <span className="text-[#6A6D70]">{fmtBytes(f.file_size)}</span> },
  { key: 'downloaded_at', header: 'ดึงข้อมูลเมื่อ', w: '140px', render: f => <span className="text-[#6A6D70] whitespace-nowrap">{fmtDateTime(f.downloaded_at)}</span> },
  { key: 'actions', header: '', w: '50px', align: 'center', render: f => <CrcDownloadButton base="/hpmh" type="correspondence" id={f.id} /> },
]

export default function HpmhCorrespondencePage() {
  const { can } = useAuth()
  const allowed = can('hpmh.view')
  const [view, setView] = useState<View>('list')

  const [search, setSearch] = useState('')
  const [attachmentType, setAttachmentType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)
  const [filePage, setFilePage] = useState(1)

  const { data, isLoading } = useQuery<PaginatedResponse<HpmhCorrespondence>>({
    queryKey: ['hpmh-correspondence', debouncedSearch, attachmentType, startDate, endDate, page],
    queryFn: () => api.get('/hpmh/correspondence', {
      params: {
        search: debouncedSearch || undefined,
        attachment_type: attachmentType || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        per_page: 50,
      },
    }).then(r => r.data),
    enabled: allowed && view === 'list',
    placeholderData: keepPreviousData,
  })

  const { data: filesData, isLoading: filesLoading } = useQuery<PaginatedResponse<HpmhCorrespondenceFile>>({
    queryKey: ['hpmh-correspondence-files', filePage],
    queryFn: () => api.get('/hpmh/correspondence-files', { params: { page: filePage, per_page: 20 } }).then(r => r.data),
    enabled: allowed && view === 'files',
  })

  if (!allowed) return <ErpNoAccess />

  const hasFilter = !!(search || attachmentType || startDate || endDate)
  const resetFilters = () => { setSearch(''); setAttachmentType(''); setStartDate(''); setEndDate(''); setPage(1) }

  return (
    <div className="space-y-0 text-[#32363A]">
      <CrcHeader
        section="HP-MH"
        crumb="Correspondence"
        title="Correspondence (หนังสือแจ้งจาก HomePro / MegaHome)"
        right={view === 'list'
          ? (isLoading ? '...' : `${data?.total?.toLocaleString('th-TH') ?? 0} ฉบับ`)
          : (filesLoading ? '...' : `${filesData?.total?.toLocaleString('th-TH') ?? 0} ไฟล์`)}
      />
      <CrcViewTabs<View>
        tabs={[{ key: 'list', label: 'รายการหนังสือ' }, { key: 'files', label: 'ไฟล์ที่ดึงมา' }]}
        active={view}
        onChange={setView}
      />

      {view === 'list' ? (
        <>
          <CrcFilterBar hasFilter={hasFilter} onReset={resetFilters}>
            <SapInput label="ค้นหา">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6A6D70]" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Subject, รายละเอียด, Content ID..."
                  className={`${inputCls} pl-7 w-72`}
                />
              </div>
            </SapInput>
            <SapInput label="ประเภทไฟล์แนบ">
              <select value={attachmentType} onChange={e => { setAttachmentType(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[150px]`}>
                <option value="">ทั้งหมด</option>
                <option value="COUPON">COUPON</option>
                <option value="LEAFLET">LEAFLET</option>
                <option value="PDF">PDF</option>
                <option value="NONE">ไม่มี / ยังไม่ดึง</option>
              </select>
            </SapInput>
            <SapInput label="วันที่เริ่ม ตั้งแต่">
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} className={inputCls} />
            </SapInput>
            <SapInput label="ถึง">
              <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} className={inputCls} />
            </SapInput>
          </CrcFilterBar>
          <CrcTable
            columns={COLUMNS}
            data={data}
            isLoading={isLoading}
            page={page}
            setPage={setPage}
            emptyText="ไม่พบหนังสือ"
            emptyIcon={<Mail className="w-8 h-8" />}
            unit="ฉบับ"
          />
        </>
      ) : (
        <CrcTable
          columns={FILE_COLUMNS}
          data={filesData}
          isLoading={filesLoading}
          page={filePage}
          setPage={setFilePage}
          emptyText="ยังไม่มีไฟล์"
          emptyIcon={<FileSpreadsheet className="w-8 h-8" />}
          unit="ไฟล์"
        />
      )}
    </div>
  )
}
