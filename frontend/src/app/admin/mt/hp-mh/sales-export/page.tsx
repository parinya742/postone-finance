'use client'

import api from '@/lib/api'
import { CrcPaginatedResponse, HpmhSalesExport, HpmhSalesExportFile, PaginatedResponse } from '@/lib/types'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, ShoppingCart, FileArchive } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, SapInput, inputCls, ErpNoAccess } from '@/components/erp'
import {
  CrcHeader, CrcViewTabs, CrcFilterBar, CrcTable, CrcDownloadButton, ViewDataButton,
  NumCell, TextCell, dash, fmtNum, fmtBytes, fmtDateTime, useDebounced, type CrcColumn,
} from '@/components/crc'

type View = 'data' | 'files'

const VENDOR_NO = '3263'

type Options = {
  sites: { site_no: string; site_name: string | null }[]
  mch3: { mch3: string; mch2_desc: string | null }[]
  period_types: string[]
}

const DATA_COLUMNS: CrcColumn<HpmhSalesExport>[] = [
  { key: 'period_date', header: 'วันที่ขาย', w: '85px', render: r => <span className="text-[#6A6D70]">{fmtDate(r.period_date)}</span> },
  { key: 'site', header: 'สาขา', w: '170px', render: r => (
    <>
      <span className="font-mono text-[10px] text-[#6A6D70]">{r.site_no ?? '—'}</span>
      <TextCell value={r.site_name} max={170} />
    </>
  ) },
  { key: 'article', header: 'สินค้า (HomePro)', w: '260px', render: r => (
    <>
      <span className="font-mono text-[10px] text-[#0064D9]">{r.art_no ?? '—'}</span>
      <TextCell value={r.art_desc} max={260} />
    </>
  ) },
  { key: 'art_ean', header: 'EAN', w: '110px', render: r => <TextCell value={r.art_ean} mono /> },
  { key: 'vendor_article', header: 'รหัสสินค้า Vendor', w: '130px', render: r => (
    <>
      <span className="font-mono text-[10px]">{r.vd_art_no ?? '—'}</span>
      {r.vd_art_desc && <span className="block text-[10px] text-[#6A6D70]">{r.vd_art_desc}</span>}
    </>
  ) },
  { key: 'mch', header: 'หมวดสินค้า', w: '190px', render: r => (
    <>
      <span className="font-mono text-[10px]">{r.mch3 ?? '—'}</span>
      <TextCell value={[r.mch2_desc, r.mch1_desc].filter(Boolean).join(' / ') || null} max={190} muted />
    </>
  ) },
  { key: 'qty', header: 'Qty', w: '70px', align: 'right', render: r => <NumCell value={r.qty} />, total: { key: 'qty' } },
  { key: 'value', header: 'ยอดขาย', w: '110px', align: 'right', render: r => <NumCell value={r.value} decimals={2} colored />, total: { key: 'value', decimals: 2 } },
]

export default function HpmhSalesExportPage() {
  const { can } = useAuth()
  const allowed = can('hpmh-sales-export.view')
  const [view, setView] = useState<View>('data')

  // ── Data filters ──
  const [search, setSearch] = useState('')
  const [siteNo, setSiteNo] = useState('')
  const [mch3, setMch3] = useState('')
  const [fileId, setFileId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  // ── File list ──
  const [filePage, setFilePage] = useState(1)

  const { data: options } = useQuery<Options>({
    queryKey: ['hpmh-sales-export-options', VENDOR_NO],
    queryFn: () => api.get('/hpmh/sales-export-options', { params: { vendor_no: VENDOR_NO } }).then(r => r.data),
    enabled: allowed,
  })

  const { data: fileOptions } = useQuery<PaginatedResponse<HpmhSalesExportFile>>({
    queryKey: ['hpmh-sales-export-files', VENDOR_NO, 'options'],
    queryFn: () => api.get('/hpmh/sales-export-files', { params: { vendor_no: VENDOR_NO, per_page: 200 } }).then(r => r.data),
    enabled: allowed,
  })

  const { data: filesData, isLoading: filesLoading } = useQuery<PaginatedResponse<HpmhSalesExportFile>>({
    queryKey: ['hpmh-sales-export-files', VENDOR_NO, filePage],
    queryFn: () => api.get('/hpmh/sales-export-files', { params: { vendor_no: VENDOR_NO, page: filePage, per_page: 20 } }).then(r => r.data),
    enabled: allowed && view === 'files',
  })

  const { data, isLoading } = useQuery<CrcPaginatedResponse<HpmhSalesExport, 'qty' | 'value'>>({
    queryKey: ['hpmh-sales-export', VENDOR_NO, debouncedSearch, siteNo, mch3, fileId, startDate, endDate, page],
    queryFn: () => api.get('/hpmh/sales-export', {
      params: {
        vendor_no: VENDOR_NO,
        search: debouncedSearch || undefined,
        site_no: siteNo || undefined,
        mch3: mch3 || undefined,
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

  const hasFilter = !!(search || siteNo || mch3 || fileId || startDate || endDate)
  const resetFilters = () => {
    setSearch(''); setSiteNo(''); setMch3(''); setFileId(''); setStartDate(''); setEndDate(''); setPage(1)
  }

  const fmtRange = (f: HpmhSalesExportFile) => `${fmtDate(f.date_from)} – ${fmtDate(f.date_to)}`

  const FILE_COLUMNS: CrcColumn<HpmhSalesExportFile>[] = [
    { key: 'id', header: 'ID', w: '50px', align: 'center', render: f => <span className="text-[#6A6D70] font-mono text-[10px]">{f.id}</span> },
    { key: 'range', header: 'ช่วงข้อมูล', w: '160px', render: f => <span className="whitespace-nowrap">{fmtRange(f)}</span> },
    { key: 'file_name', header: 'ชื่อไฟล์', w: '320px', render: f => (
      <>
        <TextCell value={f.file_name} max={320} mono />
        {f.csv_file_name && <span className="block font-mono text-[10px] text-[#6A6D70]">CSV: {f.csv_file_name}{f.csv_count && f.csv_count > 1 ? ` (+${f.csv_count - 1})` : ''}</span>}
      </>
    ) },
    { key: 'row_count', header: 'แถวในไฟล์', w: '80px', align: 'right', render: f => f.row_count != null ? <span className="tabular-nums">{fmtNum(f.row_count)}</span> : dash },
    { key: 'sales_count', header: 'รายการปัจจุบัน', w: '100px', align: 'right', render: f => (
      <span
        className={f.sales_count === 0 ? 'text-[#6A6D70] tabular-nums' : 'font-semibold tabular-nums'}
        title={f.sales_count === 0 ? 'ข้อมูลช่วงนี้ถูกแทนที่ด้วยไฟล์ที่ดึงใหม่กว่าแล้ว' : undefined}
      >
        {fmtNum(f.sales_count)}
      </span>
    ) },
    { key: 'total_qty', header: 'Qty รวม', w: '80px', align: 'right', render: f => <NumCell value={f.total_qty} /> },
    { key: 'total_value', header: 'ยอดขายรวม', w: '120px', align: 'right', render: f => <NumCell value={f.total_value} decimals={2} /> },
    { key: 'file_size', header: 'ขนาดไฟล์', w: '80px', align: 'right', render: f => <span className="text-[#6A6D70]">{fmtBytes(f.file_size)}</span> },
    { key: 'downloaded_at', header: 'ดึงข้อมูลเมื่อ', w: '130px', render: f => <span className="text-[#6A6D70] whitespace-nowrap">{fmtDateTime(f.downloaded_at)}</span> },
    { key: 'actions', header: '', w: '90px', align: 'center', render: f => (
      <div className="flex items-center justify-center gap-1">
        {f.sales_count > 0 && <ViewDataButton onClick={() => { resetFilters(); setFileId(String(f.id)); setView('data') }} />}
        <CrcDownloadButton base="/hpmh" type="sales-export" id={f.id} title="ดาวน์โหลดไฟล์ (zip)" />
      </div>
    ) },
  ]

  return (
    <div className="space-y-0 text-[#32363A]">
      <CrcHeader
        section={`HP-MH / Vendor ${VENDOR_NO}`}
        crumb="Sales Export"
        title="Sales Export (ยอดขายรายวันตามสาขา / สินค้า)"
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
                  placeholder="รหัส/ชื่อสินค้า, EAN, รหัส Vendor, สาขา..."
                  className={`${inputCls} pl-7 w-72`}
                />
              </div>
            </SapInput>
            <SapInput label="สาขา">
              <select value={siteNo} onChange={e => { setSiteNo(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[200px]`}>
                <option value="">ทั้งหมด</option>
                {options?.sites.map(s => <option key={s.site_no} value={s.site_no}>{s.site_no} · {s.site_name ?? ''}</option>)}
              </select>
            </SapInput>
            <SapInput label="หมวดสินค้า (MCH3)">
              <select value={mch3} onChange={e => { setMch3(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[180px]`}>
                <option value="">ทั้งหมด</option>
                {options?.mch3.map(m => <option key={`${m.mch3}-${m.mch2_desc}`} value={m.mch3}>{m.mch3} · {m.mch2_desc ?? ''}</option>)}
              </select>
            </SapInput>
            <SapInput label="ไฟล์">
              <select value={fileId} onChange={e => { setFileId(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[220px]`}>
                <option value="">ทั้งหมด</option>
                {fileOptions?.data.filter(f => f.sales_count > 0).map(f => (
                  <option key={f.id} value={f.id}>#{f.id} · {fmtRange(f)}</option>
                ))}
              </select>
            </SapInput>
            <SapInput label="วันที่ขาย ตั้งแต่">
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
            emptyText="ไม่พบข้อมูลยอดขาย"
            emptyIcon={<ShoppingCart className="w-8 h-8" />}
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
          emptyIcon={<FileArchive className="w-8 h-8" />}
          unit="ไฟล์"
        />
      )}
    </div>
  )
}
