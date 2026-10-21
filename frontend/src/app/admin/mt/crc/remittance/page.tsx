'use client'

import api from '@/lib/api'
import { CrcPaginatedResponse, CrcRemittance, CrcRemittanceFile, PaginatedResponse } from '@/lib/types'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Banknote, FileSpreadsheet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, SapInput, inputCls, ErpNoAccess } from '@/components/erp'
import {
  CrcHeader, CrcViewTabs, CrcFilterBar, CrcTable, CrcDownloadButton, ViewDataButton,
  NumCell, TextCell, dash, fmtNum, fmtBytes, fmtDateTime, useDebounced, type CrcColumn,
} from '@/components/crc'

type View = 'data' | 'files'

const DATA_COLUMNS: CrcColumn<CrcRemittance>[] = [
  { key: 'rnum', header: 'Remit No.', w: '100px', render: r => <span className="font-mono text-[10px] text-[#0064D9]">{r.rnum ?? '—'}</span> },
  { key: 'rdate', header: 'Remit Date', w: '90px', render: r => <span className="text-[#6A6D70]">{fmtDate(r.rdate)}</span> },
  { key: 'cheque', header: 'Cheque', w: '130px', render: r => (
    <>
      <span className="font-mono text-[10px]">{r.cheque_number ?? '—'}</span>
      <span className="block text-[10px] text-[#6A6D70]">{fmtDate(r.cheque_date)}</span>
    </>
  ) },
  { key: 'bank', header: 'Bank', w: '200px', render: r => (
    <>
      <TextCell value={r.bank_name} max={200} />
      <span className="block font-mono text-[10px] text-[#6A6D70]">{r.bank_account_number ?? ''}</span>
    </>
  ) },
  { key: 'invoice', header: 'Invoice', w: '130px', render: r => (
    <>
      <span className="font-mono text-[10px]">{r.invoice_number ?? '—'}</span>
      <span className="block text-[10px] text-[#6A6D70]">{fmtDate(r.invoice_date)}</span>
    </>
  ) },
  { key: 'grt_number', header: 'GRT No.', w: '110px', render: r => <TextCell value={r.grt_number} mono /> },
  { key: 'description', header: 'Description', w: '200px', render: r => <TextCell value={r.description} max={200} muted /> },
  { key: 'branch_name', header: 'Branch', w: '200px', render: r => <TextCell value={r.branch_name} max={200} /> },
  { key: 'amount', header: 'Amount', w: '110px', align: 'right', render: r => <NumCell value={r.amount} decimals={2} colored />, total: { key: 'amount', decimals: 2 } },
  { key: 'discount_taken', header: 'Discount', w: '90px', align: 'right', render: r => <NumCell value={r.discount_taken} decimals={2} />, total: { key: 'discount_taken', decimals: 2 } },
  { key: 'amount_due', header: 'Amount Due', w: '110px', align: 'right', render: r => <NumCell value={r.amount_due} decimals={2} colored />, total: { key: 'amount_due', decimals: 2 } },
  { key: 'grand_total', header: 'Cheque Total', w: '120px', align: 'right', render: r => <NumCell value={r.grand_total} decimals={2} /> },
]

export default function CrcRemittancePage() {
  const { can } = useAuth()
  const allowed = can('crc.view')
  const [view, setView] = useState<View>('data')

  // ── Data filters ── (fileId null = not chosen yet → latest file, '' = all files)
  const [search, setSearch] = useState('')
  const [fileId, setFileId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  // ── File list ──
  const [filePage, setFilePage] = useState(1)

  const { data: filesData, isLoading: filesLoading } = useQuery<PaginatedResponse<CrcRemittanceFile>>({
    queryKey: ['crc-remittance-files', filePage],
    queryFn: () => api.get('/crc/remittance-files', { params: { page: filePage, per_page: 20 } }).then(r => r.data),
    enabled: allowed,
  })

  const { data: fileOptions } = useQuery<PaginatedResponse<CrcRemittanceFile>>({
    queryKey: ['crc-remittance-files', 'options'],
    queryFn: () => api.get('/crc/remittance-files', { params: { per_page: 200 } }).then(r => r.data),
    enabled: allowed,
  })

  // Each remittance file is a full snapshot, so default to the latest one to avoid double-counting
  const effectiveFileId = fileId ?? (fileOptions?.data[0] ? String(fileOptions.data[0].id) : '')

  const { data, isLoading } = useQuery<CrcPaginatedResponse<CrcRemittance, 'amount' | 'discount_taken' | 'amount_due'>>({
    queryKey: ['crc-remittance', debouncedSearch, effectiveFileId, startDate, endDate, page],
    queryFn: () => api.get('/crc/remittance', {
      params: {
        search: debouncedSearch || undefined,
        file_id: effectiveFileId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        per_page: 50,
      },
    }).then(r => r.data),
    enabled: allowed && view === 'data' && !!fileOptions,
    placeholderData: keepPreviousData,
  })

  if (!allowed) return <ErpNoAccess />

  const hasFilter = !!(search || fileId !== null || startDate || endDate)
  const resetFilters = () => { setSearch(''); setFileId(null); setStartDate(''); setEndDate(''); setPage(1) }

  const FILE_COLUMNS: CrcColumn<CrcRemittanceFile>[] = [
    { key: 'id', header: 'ID', w: '50px', align: 'center', render: f => <span className="text-[#6A6D70] font-mono text-[10px]">{f.id}</span> },
    { key: 'file_name', header: 'ชื่อไฟล์', w: '320px', render: f => <TextCell value={f.file_name} max={320} mono /> },
    { key: 'cheque_count', header: 'เช็ค', w: '70px', align: 'right', render: f => f.cheque_count != null ? <span className="tabular-nums">{fmtNum(f.cheque_count)}</span> : dash },
    { key: 'row_count', header: 'แถว', w: '80px', align: 'right', render: f => f.row_count != null ? <span className="font-semibold tabular-nums">{fmtNum(f.row_count)}</span> : dash },
    { key: 'file_size', header: 'ขนาดไฟล์', w: '80px', align: 'right', render: f => <span className="text-[#6A6D70]">{fmtBytes(f.file_size)}</span> },
    { key: 'downloaded_at', header: 'ดึงข้อมูลเมื่อ', w: '140px', render: f => <span className="text-[#6A6D70] whitespace-nowrap">{fmtDateTime(f.downloaded_at)}</span> },
    { key: 'actions', header: '', w: '90px', align: 'center', render: f => (
      <div className="flex items-center justify-center gap-1">
        <ViewDataButton onClick={() => { resetFilters(); setFileId(String(f.id)); setView('data') }} />
        <CrcDownloadButton type="remittance" id={f.id} />
      </div>
    ) },
  ]

  return (
    <div className="space-y-0 text-[#32363A]">
      <CrcHeader
        crumb="Remittance"
        title="Remittance (ใบแจ้งการโอนเงิน)"
        right={view === 'data'
          ? (isLoading ? '...' : `${data?.total?.toLocaleString('th-TH') ?? 0} รายการ`)
          : (filesLoading ? '...' : `${filesData?.total?.toLocaleString('th-TH') ?? 0} ไฟล์`)}
      />
      <CrcViewTabs<View>
        tabs={[{ key: 'data', label: 'รายการข้อมูล' }, { key: 'files', label: 'ไฟล์ที่ดึงมา' }]}
        active={view}
        onChange={setView}
      />

      {view === 'data' ? (
        <>
          <CrcFilterBar hasFilter={hasFilter} onReset={resetFilters}>
            <SapInput label="ค้นหา">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6A6D70]" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Remit No., เช็ค, Invoice, GRT, สาขา..."
                  className={`${inputCls} pl-7 w-72`}
                />
              </div>
            </SapInput>
            <SapInput label="ไฟล์">
              <select value={effectiveFileId} onChange={e => { setFileId(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[260px]`}>
                <option value="">ทั้งหมด (อาจซ้ำกันระหว่างไฟล์)</option>
                {fileOptions?.data.map((f, i) => (
                  <option key={f.id} value={f.id}>#{f.id} · {fmtDateTime(f.downloaded_at)}{i === 0 ? ' (ล่าสุด)' : ''}</option>
                ))}
              </select>
            </SapInput>
            <SapInput label="Remit Date ตั้งแต่">
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} className={inputCls} />
            </SapInput>
            <SapInput label="ถึง">
              <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} className={inputCls} />
            </SapInput>
          </CrcFilterBar>
          <CrcTable
            columns={DATA_COLUMNS}
            data={data}
            isLoading={isLoading || !fileOptions}
            page={page}
            setPage={setPage}
            emptyText="ไม่พบข้อมูล Remittance"
            emptyIcon={<Banknote className="w-8 h-8" />}
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
