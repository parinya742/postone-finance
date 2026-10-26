'use client'

import api from '@/lib/api'
import { CrcPaginatedResponse, HpmhPas, HpmhPasFile, PaginatedResponse } from '@/lib/types'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Wallet, FileSpreadsheet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, SapInput, inputCls, ErpNoAccess } from '@/components/erp'
import {
  CrcHeader, CrcViewTabs, CrcFilterBar, CrcTable, CrcDownloadButton, ViewDataButton,
  NumCell, TextCell, dash, fmtNum, fmtBytes, fmtDateTime, useDebounced, type CrcColumn,
} from '@/components/crc'

type View = 'data' | 'files'

const VENDOR_NO = '501447'

type PasTotalKey = 'qty' | 'sales_amount' | 'cost_amount' | 'vat' | 'vendor_absorb_promo_discount' | 'vendor_leaflet' | 'net_paid'

const fmtPeriod = (d: string | null) => d ? d.slice(0, 7) : '—'

const DATA_COLUMNS: CrcColumn<HpmhPas>[] = [
  { key: 'period', header: 'งวด', w: '70px', render: r => <span className="font-mono text-[10px] text-[#6A6D70]">{fmtPeriod(r.period)}</span> },
  { key: 'sales_office', header: 'สาขา', w: '60px', render: r => <span className="font-mono text-[10px]">{r.sales_office ?? '—'}</span> },
  { key: 'article', header: 'สินค้า', w: '260px', render: r => (
    <>
      <span className="font-mono text-[10px] text-[#0064D9]">{r.article_no ?? '—'}</span>
      <TextCell value={r.article_desc} max={260} />
    </>
  ) },
  { key: 'billing_doc', header: 'Billing Doc', w: '100px', render: r => <TextCell value={r.billing_doc} mono /> },
  { key: 'physical_del_date', header: 'วันที่ส่ง', w: '85px', render: r => <span className="text-[#6A6D70]">{fmtDate(r.physical_del_date)}</span> },
  { key: 'qty', header: 'Qty', w: '70px', align: 'right', render: r => <NumCell value={r.qty} />, total: { key: 'qty' } },
  { key: 'uom', header: 'หน่วย', w: '50px', render: r => <span className="text-[#6A6D70]">{r.uom ?? '—'}</span> },
  { key: 'normal_price', header: 'ราคาปกติ', w: '90px', align: 'right', render: r => <NumCell value={r.normal_price} decimals={2} /> },
  { key: 'prom_price', header: 'ราคาโปร', w: '90px', align: 'right', render: r => <NumCell value={r.prom_price} decimals={2} /> },
  { key: 'sales_amount', header: 'ยอดขาย', w: '110px', align: 'right', render: r => <NumCell value={r.sales_amount} decimals={2} />, total: { key: 'sales_amount', decimals: 2 } },
  { key: 'cost_amount', header: 'ต้นทุน', w: '110px', align: 'right', render: r => <NumCell value={r.cost_amount} decimals={2} />, total: { key: 'cost_amount', decimals: 2 } },
  { key: 'vat', header: 'VAT', w: '90px', align: 'right', render: r => <NumCell value={r.vat} decimals={2} />, total: { key: 'vat', decimals: 2 } },
  { key: 'vendor_absorb_promo_discount', header: 'Vendor รับส่วนลดโปร', w: '120px', align: 'right', render: r => <NumCell value={r.vendor_absorb_promo_discount} decimals={2} />, total: { key: 'vendor_absorb_promo_discount', decimals: 2 } },
  { key: 'vendor_leaflet', header: 'Vendor Leaflet', w: '100px', align: 'right', render: r => <NumCell value={r.vendor_leaflet} decimals={2} />, total: { key: 'vendor_leaflet', decimals: 2 } },
  { key: 'net_paid', header: 'Net Paid', w: '110px', align: 'right', render: r => <NumCell value={r.net_paid} decimals={2} colored />, total: { key: 'net_paid', decimals: 2 } },
  { key: 'gp_pct', header: 'GP %', w: '60px', align: 'right', render: r => <NumCell value={r.gp_pct} decimals={2} /> },
  { key: 'net_gp_pct', header: 'Net GP %', w: '70px', align: 'right', render: r => <NumCell value={r.net_gp_pct} decimals={2} /> },
  { key: 'noted_no', header: 'Noted No.', w: '100px', render: r => <TextCell value={r.noted_no} mono /> },
  { key: 'clearing_doc', header: 'Clearing Doc', w: '100px', render: r => <TextCell value={r.clearing_doc} mono /> },
  { key: 'vendor_invoice_no', header: 'Vendor Invoice', w: '100px', render: r => <TextCell value={r.vendor_invoice_no} mono /> },
]

export default function HpmhPasPage() {
  const { can } = useAuth()
  const allowed = can('hpmh-pas.view')
  const [view, setView] = useState<View>('data')

  // ── Data filters ── (fileId '' = latest file of each period)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('')
  const [salesOffice, setSalesOffice] = useState('')
  const [fileId, setFileId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  // ── File list ──
  const [filePage, setFilePage] = useState(1)

  const { data: options } = useQuery<{ periods: string[]; sales_offices: string[] }>({
    queryKey: ['hpmh-pas-options', VENDOR_NO],
    queryFn: () => api.get('/hpmh/pas-options', { params: { vendor_no: VENDOR_NO } }).then(r => r.data),
    enabled: allowed,
  })

  const { data: fileOptions } = useQuery<PaginatedResponse<HpmhPasFile>>({
    queryKey: ['hpmh-pas-files', VENDOR_NO, 'options'],
    queryFn: () => api.get('/hpmh/pas-files', { params: { vendor_no: VENDOR_NO, per_page: 200 } }).then(r => r.data),
    enabled: allowed,
  })

  const { data: filesData, isLoading: filesLoading } = useQuery<PaginatedResponse<HpmhPasFile>>({
    queryKey: ['hpmh-pas-files', VENDOR_NO, filePage],
    queryFn: () => api.get('/hpmh/pas-files', { params: { vendor_no: VENDOR_NO, page: filePage, per_page: 20 } }).then(r => r.data),
    enabled: allowed && view === 'files',
  })

  const { data, isLoading } = useQuery<CrcPaginatedResponse<HpmhPas, PasTotalKey>>({
    queryKey: ['hpmh-pas', VENDOR_NO, debouncedSearch, period, salesOffice, fileId, startDate, endDate, page],
    queryFn: () => api.get('/hpmh/pas', {
      params: {
        vendor_no: VENDOR_NO,
        search: debouncedSearch || undefined,
        period: period || undefined,
        sales_office: salesOffice || undefined,
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

  const hasFilter = !!(search || period || salesOffice || fileId || startDate || endDate)
  const resetFilters = () => {
    setSearch(''); setPeriod(''); setSalesOffice(''); setFileId(''); setStartDate(''); setEndDate(''); setPage(1)
  }

  const FILE_COLUMNS: CrcColumn<HpmhPasFile>[] = [
    { key: 'id', header: 'ID', w: '50px', align: 'center', render: f => <span className="text-[#6A6D70] font-mono text-[10px]">{f.id}</span> },
    { key: 'period', header: 'งวด', w: '70px', render: f => <span className="font-mono text-[10px]">{fmtPeriod(f.period)}</span> },
    { key: 'file_name', header: 'ชื่อไฟล์', w: '320px', render: f => <TextCell value={f.file_name} max={320} mono /> },
    { key: 'row_count', header: 'แถว', w: '70px', align: 'right', render: f => f.row_count != null ? <span className="font-semibold tabular-nums">{fmtNum(f.row_count)}</span> : dash },
    { key: 'total_qty', header: 'Qty รวม', w: '80px', align: 'right', render: f => <NumCell value={f.total_qty} /> },
    { key: 'total_sales_amount', header: 'ยอดขายรวม', w: '120px', align: 'right', render: f => <NumCell value={f.total_sales_amount} decimals={2} /> },
    { key: 'file_size', header: 'ขนาดไฟล์', w: '80px', align: 'right', render: f => <span className="text-[#6A6D70]">{fmtBytes(f.file_size)}</span> },
    { key: 'report_updated_at', header: 'รายงานอัปเดต', w: '130px', render: f => <span className="text-[#6A6D70] whitespace-nowrap">{fmtDateTime(f.report_updated_at)}</span> },
    { key: 'downloaded_at', header: 'ดึงข้อมูลเมื่อ', w: '130px', render: f => <span className="text-[#6A6D70] whitespace-nowrap">{fmtDateTime(f.downloaded_at)}</span> },
    { key: 'actions', header: '', w: '90px', align: 'center', render: f => (
      <div className="flex items-center justify-center gap-1">
        <ViewDataButton onClick={() => { resetFilters(); setFileId(String(f.id)); setView('data') }} />
        <CrcDownloadButton base="/hpmh" type="pas" id={f.id} />
      </div>
    ) },
  ]

  return (
    <div className="space-y-0 text-[#32363A]">
      <CrcHeader
        section={`HP-MH / Vendor ${VENDOR_NO}`}
        crumb="PAS"
        title="ชำระเงินหลังการขาย (PAS)"
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
                  placeholder="รหัส/ชื่อสินค้า, Billing Doc, Noted No...."
                  className={`${inputCls} pl-7 w-72`}
                />
              </div>
            </SapInput>
            <SapInput label="งวด">
              <select value={period} onChange={e => { setPeriod(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[110px]`}>
                <option value="">ทั้งหมด</option>
                {options?.periods.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </SapInput>
            <SapInput label="สาขา">
              <select value={salesOffice} onChange={e => { setSalesOffice(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[100px]`}>
                <option value="">ทั้งหมด</option>
                {options?.sales_offices.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </SapInput>
            <SapInput label="ไฟล์">
              <select value={fileId} onChange={e => { setFileId(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[240px]`}>
                <option value="">ไฟล์ล่าสุดของแต่ละงวด</option>
                {fileOptions?.data.map(f => (
                  <option key={f.id} value={f.id}>#{f.id} · {fmtPeriod(f.period)} · {fmtDateTime(f.downloaded_at)}</option>
                ))}
              </select>
            </SapInput>
            <SapInput label="วันที่ส่ง ตั้งแต่">
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
            emptyText="ไม่พบข้อมูล PAS"
            emptyIcon={<Wallet className="w-8 h-8" />}
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
