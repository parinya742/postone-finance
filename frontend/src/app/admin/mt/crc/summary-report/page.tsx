'use client'

import api from '@/lib/api'
import { CrcPaginatedResponse, CrcSummaryReport, CrcSummaryReportFile, PaginatedResponse } from '@/lib/types'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, BarChart3, FileSpreadsheet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, StatusBadge, SapInput, inputCls, ErpNoAccess } from '@/components/erp'
import {
  CrcHeader, CrcViewTabs, CrcFilterBar, CrcTable, CrcDownloadButton, ViewDataButton,
  NumCell, TextCell, dash, fmtNum, fmtBytes, fmtDateTime, useDebounced, type CrcColumn,
} from '@/components/crc'

type View = 'monthly' | 'daily' | 'files'
type SumKey = 'sales_amount' | 'sales_qty' | 'stock_on_hand' | 'stock_on_order'

const REPORT_TYPE_COLORS: Record<string, string> = {
  MONTHLY: 'bg-[#EBF5FE] text-[#0070F2] border-[#0070F2]/40',
  DAILY:   'bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40',
}

const ITEM_COLUMNS: CrcColumn<CrcSummaryReport>[] = [
  { key: 'store', header: 'Store', w: '220px', render: r => (
    <>
      <span className="font-mono text-[10px] text-[#0064D9]">{r.store_code ?? '—'}</span>
      <TextCell value={r.store_name} max={220} muted />
    </>
  ) },
  { key: 'cat', header: 'Cat / Sub', w: '70px', render: r => <span className="font-mono text-[10px] text-[#6A6D70]">{r.cat ?? '—'} / {r.sub_cat ?? '—'}</span> },
  { key: 'sku', header: 'SKU / Barcode', w: '120px', render: r => (
    <>
      <span className="font-mono text-[10px]">{r.sku ?? '—'}</span>
      <span className="block font-mono text-[10px] text-[#6A6D70]">{r.barcode ?? ''}</span>
    </>
  ) },
  { key: 'description', header: 'Description', w: '240px', render: r => <TextCell value={r.description} max={240} /> },
  { key: 'brand', header: 'Brand', w: '90px', render: r => <TextCell value={r.brand} max={90} muted /> },
  { key: 'sales_qty', header: 'Sales Qty', w: '80px', align: 'right', render: r => <NumCell value={r.sales_qty} />, total: { key: 'sales_qty' } },
  { key: 'sales_amount', header: 'Sales Amount', w: '110px', align: 'right', render: r => <NumCell value={r.sales_amount} decimals={2} colored />, total: { key: 'sales_amount', decimals: 2 } },
  { key: 'stock_on_hand', header: 'On Hand', w: '80px', align: 'right', render: r => <NumCell value={r.stock_on_hand} />, total: { key: 'stock_on_hand' } },
  { key: 'stock_on_order', header: 'On Order', w: '80px', align: 'right', render: r => <NumCell value={r.stock_on_order} />, total: { key: 'stock_on_order' } },
  { key: 'last_sold_date', header: 'Last Sold', w: '90px', render: r => <span className="text-[#6A6D70]">{fmtDate(r.last_sold_date ?? null)}</span> },
  { key: 'last_receive_date', header: 'Last Receive', w: '90px', render: r => <span className="text-[#6A6D70]">{fmtDate(r.last_receive_date ?? null)}</span> },
]

const MONTHLY_COLUMNS: CrcColumn<CrcSummaryReport>[] = [
  { key: 'report_month', header: 'Month', w: '70px', render: r => <span className="font-mono text-[10px]">{r.report_month ?? '—'}</span> },
  ...ITEM_COLUMNS,
]

const DAILY_COLUMNS: CrcColumn<CrcSummaryReport>[] = [
  { key: 'report_date', header: 'Date', w: '90px', render: r => <span className="text-[#6A6D70]">{fmtDate(r.report_date ?? null)}</span> },
  ...ITEM_COLUMNS,
]

export default function CrcSummaryReportPage() {
  const { can } = useAuth()
  const allowed = can('crc.view')
  const [view, setView] = useState<View>('monthly')

  // ── Shared item filters ──
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  // Monthly: '' = all months. Daily: null = not chosen → latest file, '' = all days
  const [reportMonth, setReportMonth] = useState('')
  const [monthlyFileId, setMonthlyFileId] = useState('')
  const [dailyFileId, setDailyFileId] = useState<string | null>(null)

  // ── File list ──
  const [filePage, setFilePage] = useState(1)
  const [fileType, setFileType] = useState('')

  const { data: filesData, isLoading: filesLoading } = useQuery<PaginatedResponse<CrcSummaryReportFile>>({
    queryKey: ['crc-summary-report-files', filePage, fileType],
    queryFn: () => api.get('/crc/summary-report-files', {
      params: { page: filePage, per_page: 20, report_type: fileType || undefined },
    }).then(r => r.data),
    enabled: allowed,
  })

  const { data: monthlyFiles } = useQuery<PaginatedResponse<CrcSummaryReportFile>>({
    queryKey: ['crc-summary-report-files', 'options', 'MONTHLY'],
    queryFn: () => api.get('/crc/summary-report-files', { params: { report_type: 'MONTHLY', per_page: 500 } }).then(r => r.data),
    enabled: allowed,
  })

  const { data: dailyFiles } = useQuery<PaginatedResponse<CrcSummaryReportFile>>({
    queryKey: ['crc-summary-report-files', 'options', 'DAILY'],
    queryFn: () => api.get('/crc/summary-report-files', { params: { report_type: 'DAILY', per_page: 500 } }).then(r => r.data),
    enabled: allowed,
  })

  const months = [...new Set((monthlyFiles?.data ?? []).map(f => f.report_month).filter(Boolean) as string[])]

  // Each daily file is a one-day snapshot; default to the latest day so stock totals stay meaningful
  const effectiveDailyFileId = dailyFileId ?? (dailyFiles?.data[0] ? String(dailyFiles.data[0].id) : '')

  const { data: monthlyData, isLoading: monthlyLoading } = useQuery<CrcPaginatedResponse<CrcSummaryReport, SumKey>>({
    queryKey: ['crc-summary-report', debouncedSearch, reportMonth, monthlyFileId, page],
    queryFn: () => api.get('/crc/summary-report', {
      params: {
        search: debouncedSearch || undefined,
        report_month: reportMonth || undefined,
        file_id: monthlyFileId || undefined,
        page,
        per_page: 50,
      },
    }).then(r => r.data),
    enabled: allowed && view === 'monthly',
    placeholderData: keepPreviousData,
  })

  const { data: dailyData, isLoading: dailyLoading } = useQuery<CrcPaginatedResponse<CrcSummaryReport, SumKey>>({
    queryKey: ['crc-summary-report-daily', debouncedSearch, effectiveDailyFileId, page],
    queryFn: () => api.get('/crc/summary-report-daily', {
      params: {
        search: debouncedSearch || undefined,
        file_id: effectiveDailyFileId || undefined,
        page,
        per_page: 50,
      },
    }).then(r => r.data),
    enabled: allowed && view === 'daily' && !!dailyFiles,
    placeholderData: keepPreviousData,
  })

  if (!allowed) return <ErpNoAccess />

  const resetFilters = () => {
    setSearch(''); setReportMonth(''); setMonthlyFileId(''); setDailyFileId(null); setPage(1)
  }
  const changeView = (v: View) => { setView(v); setPage(1) }
  const hasFilter = view === 'monthly'
    ? !!(search || reportMonth || monthlyFileId)
    : !!(search || dailyFileId !== null)

  const openFile = (f: CrcSummaryReportFile) => {
    resetFilters()
    if (f.report_type === 'DAILY') {
      setDailyFileId(String(f.id))
      setView('daily')
    } else {
      setMonthlyFileId(String(f.id))
      setView('monthly')
    }
  }

  const FILE_COLUMNS: CrcColumn<CrcSummaryReportFile>[] = [
    { key: 'id', header: 'ID', w: '50px', align: 'center', render: f => <span className="text-[#6A6D70] font-mono text-[10px]">{f.id}</span> },
    { key: 'report_type', header: 'ประเภท', w: '80px', align: 'center', render: f => <StatusBadge value={f.report_type} colorMap={REPORT_TYPE_COLORS} /> },
    { key: 'period', header: 'งวด', w: '100px', render: f => (
      <span className="font-mono text-[10px]">{f.report_type === 'DAILY' ? f.report_date ?? '—' : f.report_month ?? '—'}</span>
    ) },
    { key: 'file_name', header: 'ชื่อไฟล์', w: '340px', render: f => (
      <>
        <TextCell value={f.file_name} max={340} mono />
        <TextCell value={f.vendor} max={340} muted />
      </>
    ) },
    { key: 'row_count', header: 'แถว', w: '80px', align: 'right', render: f => f.row_count != null ? <span className="font-semibold tabular-nums">{fmtNum(f.row_count)}</span> : dash },
    { key: 'file_size', header: 'ขนาดไฟล์', w: '80px', align: 'right', render: f => <span className="text-[#6A6D70]">{fmtBytes(f.file_size)}</span> },
    { key: 'downloaded_at', header: 'ดึงข้อมูลเมื่อ', w: '140px', render: f => <span className="text-[#6A6D70] whitespace-nowrap">{fmtDateTime(f.downloaded_at)}</span> },
    { key: 'actions', header: '', w: '90px', align: 'center', render: f => (
      <div className="flex items-center justify-center gap-1">
        <ViewDataButton onClick={() => openFile(f)} />
        <CrcDownloadButton type="summary-report" id={f.id} />
      </div>
    ) },
  ]

  const activeData = view === 'monthly' ? monthlyData : dailyData
  const activeLoading = view === 'monthly' ? monthlyLoading : (dailyLoading || !dailyFiles)

  return (
    <div className="space-y-0 text-[#32363A]">
      <CrcHeader
        crumb="Summary Report"
        title="Summary Report (ยอดขาย / สต็อกรายสาขา)"
        right={view === 'files'
          ? (filesLoading ? '...' : `${filesData?.total?.toLocaleString('th-TH') ?? 0} ไฟล์`)
          : (activeLoading ? '...' : `${activeData?.total?.toLocaleString('th-TH') ?? 0} รายการ`)}
      />
      <CrcViewTabs<View>
        tabs={[
          { key: 'monthly', label: 'รายเดือน' },
          { key: 'daily', label: 'รายวัน' },
          { key: 'files', label: 'ไฟล์ที่ดึงมา' },
        ]}
        active={view}
        onChange={changeView}
      />

      {view === 'files' ? (
        <>
          <CrcFilterBar hasFilter={!!fileType} onReset={() => { setFileType(''); setFilePage(1) }}>
            <SapInput label="ประเภท">
              <select value={fileType} onChange={e => { setFileType(e.target.value); setFilePage(1) }} className={`${inputCls} pr-7 min-w-[140px]`}>
                <option value="">ทั้งหมด</option>
                <option value="MONTHLY">MONTHLY</option>
                <option value="DAILY">DAILY</option>
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
            emptyIcon={<FileSpreadsheet className="w-8 h-8" />}
            unit="ไฟล์"
          />
        </>
      ) : (
        <>
          <CrcFilterBar hasFilter={hasFilter} onReset={resetFilters}>
            <SapInput label="ค้นหา">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6A6D70]" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="SKU, Barcode, สินค้า, สาขา..."
                  className={`${inputCls} pl-7 w-72`}
                />
              </div>
            </SapInput>
            {view === 'monthly' ? (
              <>
                <SapInput label="เดือน">
                  <select value={reportMonth} onChange={e => { setReportMonth(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[140px]`}>
                    <option value="">ทั้งหมด</option>
                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </SapInput>
                {monthlyFileId && (
                  <SapInput label="ไฟล์">
                    <span className={`${inputCls} inline-flex items-center font-mono text-xs`}>#{monthlyFileId}</span>
                  </SapInput>
                )}
              </>
            ) : (
              <SapInput label="วันที่รายงาน">
                <select value={effectiveDailyFileId} onChange={e => { setDailyFileId(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[180px]`}>
                  <option value="">ทุกวัน</option>
                  {dailyFiles?.data.map((f, i) => (
                    <option key={f.id} value={f.id}>{f.report_date}{i === 0 ? ' (ล่าสุด)' : ''}</option>
                  ))}
                </select>
              </SapInput>
            )}
          </CrcFilterBar>
          <CrcTable
            columns={view === 'monthly' ? MONTHLY_COLUMNS : DAILY_COLUMNS}
            data={activeData}
            isLoading={activeLoading}
            page={page}
            setPage={setPage}
            emptyText="ไม่พบข้อมูล Summary Report"
            emptyIcon={<BarChart3 className="w-8 h-8" />}
          />
        </>
      )}
    </div>
  )
}
