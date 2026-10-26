'use client'

import api from '@/lib/api'
import { CrcPaginatedResponse, DhSalesReport, DhSalesReportBranch, DhSalesReportFile, PaginatedResponse } from '@/lib/types'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, ShoppingCart, Store, FileSpreadsheet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, SapInput, inputCls, ErpNoAccess } from '@/components/erp'
import {
  CrcHeader, CrcViewTabs, CrcFilterBar, CrcTable, CrcDownloadButton, MtAuditLogTable, ViewDataButton,
  NumCell, TextCell, dash, fmtNum, fmtBytes, fmtDateTime, useDebounced, type CrcColumn,
} from '@/components/crc'

type View = 'data' | 'branches' | 'files' | 'logs'

const API = '/dh'

const DATA_COLUMNS: CrcColumn<DhSalesReport>[] = [
  { key: 'report_date', header: 'วันที่ขาย', w: '85px', render: r => <span className="text-[#6A6D70]">{fmtDate(r.report_date)}</span> },
  { key: 'branch_name', header: 'สาขา', w: '180px', render: r => <TextCell value={r.branch_name} max={180} /> },
  { key: 'article_no', header: 'รหัสสินค้า', w: '100px', render: r => <span className="font-mono text-[10px] text-[#0064D9]">{r.article_no ?? '—'}</span> },
  { key: 'article_name', header: 'ชื่อสินค้า', w: '340px', render: r => <TextCell value={r.article_name} max={340} /> },
  { key: 'qty', header: 'Qty', w: '70px', align: 'right', render: r => <NumCell value={r.qty} />, total: { key: 'qty' } },
]

const BRANCH_COLUMNS: CrcColumn<DhSalesReportBranch>[] = [
  { key: 'report_date', header: 'วันที่ขาย', w: '85px', render: r => <span className="text-[#6A6D70]">{fmtDate(r.report_date)}</span> },
  { key: 'branch_name', header: 'สาขา', w: '260px', render: r => <TextCell value={r.branch_name} max={260} /> },
  { key: 'qty', header: 'Qty', w: '80px', align: 'right', render: r => <NumCell value={r.qty} />, total: { key: 'qty' } },
  { key: 'sales_value', header: 'ยอดขาย', w: '120px', align: 'right', render: r => <NumCell value={r.sales_value} decimals={2} colored />, total: { key: 'sales_value', decimals: 2 } },
]

export default function DhSalesReportPage() {
  const { can } = useAuth()
  const allowed = can('dh-sales-report.view')
  const [view, setView] = useState<View>('data')

  // ── Filters (shared by the product and branch views) ──
  const [search, setSearch] = useState('')
  const [branch, setBranch] = useState('')
  const [fileId, setFileId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  const [filePage, setFilePage] = useState(1)

  const { data: options } = useQuery<{ branches: string[] }>({
    queryKey: ['dh-options'],
    queryFn: () => api.get(`${API}/options`).then(r => r.data),
    enabled: allowed,
  })

  const params = {
    search: debouncedSearch || undefined,
    branch_name: branch || undefined,
    file_id: fileId || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    page,
    per_page: 50,
  }
  const filterKey = [debouncedSearch, branch, fileId, startDate, endDate, page]

  const { data, isLoading } = useQuery<CrcPaginatedResponse<DhSalesReport, 'qty'>>({
    queryKey: ['dh-sales-report', ...filterKey],
    queryFn: () => api.get(`${API}/sales-report`, { params }).then(r => r.data),
    enabled: allowed && view === 'data',
    placeholderData: keepPreviousData,
  })

  const { data: branchData, isLoading: branchLoading } = useQuery<CrcPaginatedResponse<DhSalesReportBranch, 'qty' | 'sales_value'>>({
    queryKey: ['dh-branches', ...filterKey],
    queryFn: () => api.get(`${API}/branches`, { params }).then(r => r.data),
    enabled: allowed && view === 'branches',
    placeholderData: keepPreviousData,
  })

  const { data: filesData, isLoading: filesLoading } = useQuery<PaginatedResponse<DhSalesReportFile>>({
    queryKey: ['dh-files', filePage],
    queryFn: () => api.get(`${API}/files`, { params: { page: filePage, per_page: 20 } }).then(r => r.data),
    enabled: allowed && (view === 'files' || view === 'data' || view === 'branches'),
  })

  if (!allowed) return <ErpNoAccess />

  const hasFilter = !!(search || branch || fileId || startDate || endDate)
  const resetFilters = () => { setSearch(''); setBranch(''); setFileId(''); setStartDate(''); setEndDate(''); setPage(1) }
  const changeView = (v: View) => { setView(v); setPage(1) }

  const FILE_COLUMNS: CrcColumn<DhSalesReportFile>[] = [
    { key: 'id', header: 'ID', w: '50px', align: 'center', render: f => <span className="text-[#6A6D70] font-mono text-[10px]">{f.id}</span> },
    { key: 'report_date', header: 'วันที่รายงาน', w: '95px', render: f => <span className="whitespace-nowrap">{fmtDate(f.report_date)}</span> },
    { key: 'file_name', header: 'ชื่อไฟล์', w: '320px', render: f => (
      <>
        <TextCell value={f.file_name} max={320} mono />
        <TextCell value={f.source_file_name} max={320} mono muted />
      </>
    ) },
    { key: 'product_count', header: 'สินค้า', w: '70px', align: 'right', render: f => f.product_count != null ? <span className="tabular-nums">{fmtNum(f.product_count)}</span> : dash },
    { key: 'row_count', header: 'แถว', w: '70px', align: 'right', render: f => f.row_count != null ? <span className="font-semibold tabular-nums">{fmtNum(f.row_count)}</span> : dash },
    { key: 'total_qty', header: 'Qty รวม', w: '80px', align: 'right', render: f => <NumCell value={f.total_qty} /> },
    { key: 'total_value', header: 'ยอดขายรวม', w: '120px', align: 'right', render: f => <NumCell value={f.total_value} decimals={2} /> },
    { key: 'file_size', header: 'ขนาดไฟล์', w: '80px', align: 'right', render: f => <span className="text-[#6A6D70]">{fmtBytes(f.file_size)}</span> },
    { key: 'downloaded_at', header: 'ดึงข้อมูลเมื่อ', w: '130px', render: f => <span className="text-[#6A6D70] whitespace-nowrap">{fmtDateTime(f.downloaded_at)}</span> },
    { key: 'actions', header: '', w: '90px', align: 'center', render: f => (
      <div className="flex items-center justify-center gap-1">
        <ViewDataButton onClick={() => { resetFilters(); setFileId(String(f.id)); setView('data') }} />
        <CrcDownloadButton path={`${API}/files/${f.id}/download`} title="ดาวน์โหลดไฟล์ (Excel)" />
      </div>
    ) },
  ]

  const headerCount = view === 'data'
    ? (isLoading ? '...' : `${data?.total?.toLocaleString('th-TH') ?? 0} รายการ`)
    : view === 'branches'
      ? (branchLoading ? '...' : `${branchData?.total?.toLocaleString('th-TH') ?? 0} รายการ`)
      : view === 'files'
        ? (filesLoading ? '...' : `${filesData?.total?.toLocaleString('th-TH') ?? 0} ไฟล์`)
        : undefined

  const filterBar = (
    <CrcFilterBar hasFilter={hasFilter} onReset={resetFilters}>
      <SapInput label="ค้นหา">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6A6D70]" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder={view === 'data' ? 'รหัส/ชื่อสินค้า, สาขา...' : 'ชื่อสาขา...'}
            className={`${inputCls} pl-7 w-64`}
          />
        </div>
      </SapInput>
      <SapInput label="สาขา">
        <select value={branch} onChange={e => { setBranch(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[180px]`}>
          <option value="">ทั้งหมด</option>
          {options?.branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </SapInput>
      <SapInput label="ไฟล์">
        <select value={fileId} onChange={e => { setFileId(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[180px]`}>
          <option value="">ทั้งหมด</option>
          {filesData?.data.map(f => <option key={f.id} value={f.id}>#{f.id} · {fmtDate(f.report_date)}</option>)}
        </select>
      </SapInput>
      <SapInput label="วันที่ขาย ตั้งแต่">
        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} className={inputCls} />
      </SapInput>
      <SapInput label="ถึง">
        <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} className={inputCls} />
      </SapInput>
    </CrcFilterBar>
  )

  return (
    <div className="space-y-0 text-[#32363A]">
      <CrcHeader
        section="DH"
        crumb="Sales Report"
        title="รายงานยอดขาย (Sales Report)"
        right={headerCount}
      />
      <CrcViewTabs<View>
        tabs={[
          { key: 'data', label: 'รายการขายตามสินค้า' },
          { key: 'branches', label: 'สรุปตามสาขา' },
          { key: 'files', label: 'ไฟล์ที่ดึงมา' },
          { key: 'logs', label: 'ประวัติการทำงาน' },
        ]}
        active={view}
        onChange={changeView}
      />

      {view === 'data' && (
        <>
          {filterBar}
          <CrcTable
            columns={DATA_COLUMNS}
            data={data}
            isLoading={isLoading}
            page={page}
            setPage={setPage}
            emptyText="ไม่พบข้อมูลยอดขาย"
            emptyIcon={<ShoppingCart className="w-8 h-8" />}
          />
        </>
      )}

      {view === 'branches' && (
        <>
          {filterBar}
          <CrcTable
            columns={BRANCH_COLUMNS}
            data={branchData}
            isLoading={branchLoading}
            page={page}
            setPage={setPage}
            emptyText="ไม่พบข้อมูลสาขา"
            emptyIcon={<Store className="w-8 h-8" />}
          />
        </>
      )}

      {view === 'files' && (
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

      {view === 'logs' && <MtAuditLogTable base={API} queryKey="dh" />}
    </div>
  )
}
