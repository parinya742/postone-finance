'use client'

import api from '@/lib/api'
import { CrcPaginatedResponse, CrcPriceCompensate, CrcPriceCompensateFile, PaginatedResponse } from '@/lib/types'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, BadgePercent, FileSpreadsheet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, SapInput, inputCls, ErpNoAccess } from '@/components/erp'
import {
  CrcHeader, CrcViewTabs, CrcFilterBar, CrcTable, CrcDownloadButton, ViewDataButton,
  NumCell, TextCell, dash, fmtNum, fmtBytes, fmtDateTime, useDebounced, type CrcColumn,
} from '@/components/crc'

type View = 'data' | 'files'

const DATA_COLUMNS: CrcColumn<CrcPriceCompensate>[] = [
  { key: 'sales_date', header: 'Sales Date', w: '90px', render: r => <span className="text-[#6A6D70]">{fmtDate(r.sales_date)}</span> },
  { key: 'promotion', header: 'Promotion', w: '220px', render: r => (
    <>
      <span className="font-mono text-[10px] text-[#0064D9]">{r.promotion_no ?? '—'}</span>
      <TextCell value={r.promotion_name} max={220} muted />
    </>
  ) },
  { key: 'promotion_type', header: 'Type', w: '140px', render: r => (
    <TextCell value={r.promotion_type ? `${r.promotion_type} · ${r.promotion_type_name ?? ''}` : null} max={140} />
  ) },
  { key: 'promo_period', header: 'Promo Period', w: '170px', render: r => (
    <span className="font-mono text-[10px] text-[#6A6D70] whitespace-nowrap">
      {r.promotion_start_date ?? '—'} → {r.promotion_end_date ?? '—'}
    </span>
  ) },
  { key: 'store', header: 'Store', w: '200px', render: r => (
    <>
      <span className="font-mono text-[10px] text-[#0064D9]">{r.store_code ?? '—'}</span>
      <TextCell value={r.store_name} max={200} muted />
    </>
  ) },
  { key: 'sku', header: 'SKU', w: '90px', render: r => <TextCell value={r.sku} mono /> },
  { key: 'product_name', header: 'Product', w: '220px', render: r => <TextCell value={r.product_name} max={220} /> },
  { key: 'brand', header: 'Brand', w: '90px', render: r => <TextCell value={r.brand} max={90} muted /> },
  { key: 'ticket_pos', header: 'Ticket POS', w: '130px', render: r => <TextCell value={r.ticket_pos} mono /> },
  { key: 'cps_qty', header: 'Qty', w: '60px', align: 'right', render: r => <NumCell value={r.cps_qty} />, total: { key: 'cps_qty' } },
  { key: 'cps_amount_per_qty', header: 'CPS / Qty', w: '90px', align: 'right', render: r => <NumCell value={r.cps_amount_per_qty} decimals={2} /> },
  { key: 'cps_amount', header: 'CPS Amount', w: '110px', align: 'right', render: r => <NumCell value={r.cps_amount} decimals={2} colored />, total: { key: 'cps_amount', decimals: 2 } },
]

export default function CrcPriceCompensatePage() {
  const { can } = useAuth()
  const allowed = can('crc.view')
  const [view, setView] = useState<View>('data')

  // ── Data filters ──
  const [search, setSearch] = useState('')
  const [fileId, setFileId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  // ── File list ──
  const [filePage, setFilePage] = useState(1)

  const { data: filesData, isLoading: filesLoading } = useQuery<PaginatedResponse<CrcPriceCompensateFile>>({
    queryKey: ['crc-price-compensate-files', filePage],
    queryFn: () => api.get('/crc/price-compensate-files', { params: { page: filePage, per_page: 20 } }).then(r => r.data),
    enabled: allowed,
  })

  const { data: fileOptions } = useQuery<PaginatedResponse<CrcPriceCompensateFile>>({
    queryKey: ['crc-price-compensate-files', 'options'],
    queryFn: () => api.get('/crc/price-compensate-files', { params: { per_page: 200 } }).then(r => r.data),
    enabled: allowed,
  })

  const { data, isLoading } = useQuery<CrcPaginatedResponse<CrcPriceCompensate, 'cps_qty' | 'cps_amount'>>({
    queryKey: ['crc-price-compensate', debouncedSearch, fileId, startDate, endDate, page],
    queryFn: () => api.get('/crc/price-compensate', {
      params: {
        search: debouncedSearch || undefined,
        file_id: fileId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        per_page: 50,
      },
    }).then(r => r.data),
    enabled: allowed && view === 'data',
    placeholderData: keepPreviousData,
  })

  if (!allowed) return <ErpNoAccess />

  const hasFilter = !!(search || fileId || startDate || endDate)
  const resetFilters = () => { setSearch(''); setFileId(''); setStartDate(''); setEndDate(''); setPage(1) }

  const FILE_COLUMNS: CrcColumn<CrcPriceCompensateFile>[] = [
    { key: 'id', header: 'ID', w: '50px', align: 'center', render: f => <span className="text-[#6A6D70] font-mono text-[10px]">{f.id}</span> },
    { key: 'file_name', header: 'ชื่อไฟล์', w: '360px', render: f => <TextCell value={f.file_name} max={360} mono /> },
    { key: 'range', header: 'ช่วงวันที่', w: '180px', render: f => (
      <span className="font-mono text-[10px] text-[#6A6D70] whitespace-nowrap">{f.start_date ?? '—'} → {f.end_date ?? '—'}</span>
    ) },
    { key: 'row_count', header: 'แถว', w: '80px', align: 'right', render: f => f.row_count != null ? <span className="font-semibold tabular-nums">{fmtNum(f.row_count)}</span> : dash },
    { key: 'file_size', header: 'ขนาดไฟล์', w: '80px', align: 'right', render: f => <span className="text-[#6A6D70]">{fmtBytes(f.file_size)}</span> },
    { key: 'downloaded_at', header: 'ดึงข้อมูลเมื่อ', w: '140px', render: f => <span className="text-[#6A6D70] whitespace-nowrap">{fmtDateTime(f.downloaded_at)}</span> },
    { key: 'actions', header: '', w: '90px', align: 'center', render: f => (
      <div className="flex items-center justify-center gap-1">
        <ViewDataButton onClick={() => { resetFilters(); setFileId(String(f.id)); setView('data') }} />
        <CrcDownloadButton type="price-compensate" id={f.id} />
      </div>
    ) },
  ]

  return (
    <div className="space-y-0 text-[#32363A]">
      <CrcHeader
        crumb="Price Compensate"
        title="Price Compensate (ชดเชยราคา)"
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
                  placeholder="Promotion, SKU, สินค้า, สาขา, Ticket..."
                  className={`${inputCls} pl-7 w-72`}
                />
              </div>
            </SapInput>
            <SapInput label="ไฟล์">
              <select value={fileId} onChange={e => { setFileId(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[220px]`}>
                <option value="">ทั้งหมด</option>
                {fileOptions?.data.map(f => (
                  <option key={f.id} value={f.id}>#{f.id} · {f.start_date} → {f.end_date}</option>
                ))}
              </select>
            </SapInput>
            <SapInput label="Sales Date ตั้งแต่">
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
            emptyText="ไม่พบข้อมูล Price Compensate"
            emptyIcon={<BadgePercent className="w-8 h-8" />}
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
