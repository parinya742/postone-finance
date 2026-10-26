'use client'

import api from '@/lib/api'
import { CrcPaginatedResponse, HpmhStockCsv, HpmhStockFile, HpmhStockInventory, PaginatedResponse } from '@/lib/types'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Boxes, FileArchive } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, StatusBadge, SapInput, inputCls, ErpNoAccess } from '@/components/erp'
import {
  CrcHeader, CrcViewTabs, CrcFilterBar, CrcTable, CrcDownloadButton, MtAuditLogTable, ViewDataButton,
  NumCell, TextCell, dash, fmtNum, fmtBytes, fmtDateTime, useDebounced, type CrcColumn,
} from '@/components/crc'

type View = 'data' | 'files' | 'logs'

const VENDOR_NO = '501447'
const API = '/hpmh-stock'

type Options = {
  stock_dates: string[]
  sites: { site_no: string; site_name: string | null }[]
  mch3: { mch3: string; mch2_desc: string | null }[]
  non_move_types: string[]
}

type Totals = 'onhand_qty' | 'onhand_value' | 'stock_available_qty' | 'stock_available_value'
  | 'rtv_qty' | 'rtv_value' | 'avg_sale_qty_8w' | 'avg_sale_amt_8w'

// Non-move buckets (days without movement) — numeric ones sorted, then the text buckets
function sortNonMove(types: string[]) {
  const n = (t: string) => (t.startsWith('>') ? Number(t.slice(1)) + 0.5 : Number(t))
  return [...types].sort((a, b) => {
    const na = n(a), nb = n(b)
    if (isNaN(na) && isNaN(nb)) return a.localeCompare(b)
    if (isNaN(na)) return 1
    if (isNaN(nb)) return -1
    return na - nb
  })
}

const NON_MOVE_COLORS: Record<string, string> = {
  'NO STOCK': 'bg-[#F5F5F5] text-[#6A6D70] border-[#D9D9D9]',
  '30':  'bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40',
  '60':  'bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40',
  '90':  'bg-[#FEF7F1] text-[#E9730C] border-[#E9730C]/40',
  '120': 'bg-[#FEF7F1] text-[#E9730C] border-[#E9730C]/40',
  '150': 'bg-[#FEF7F1] text-[#E9730C] border-[#E9730C]/40',
  '180': 'bg-[#FEF7F1] text-[#E9730C] border-[#E9730C]/40',
  '360': 'bg-[#FFEBEB] text-[#BB0000] border-[#BB0000]/40',
  '720': 'bg-[#FFEBEB] text-[#BB0000] border-[#BB0000]/40',
  '>720': 'bg-[#FFEBEB] text-[#BB0000] border-[#BB0000]/40',
}

const DATA_COLUMNS: CrcColumn<HpmhStockInventory>[] = [
  { key: 'site', header: 'สาขา', w: '160px', render: r => (
    <>
      <span className="font-mono text-[10px] text-[#6A6D70]">{r.site_no ?? '—'}</span>
      <TextCell value={r.site_name} max={160} />
    </>
  ) },
  { key: 'article', header: 'สินค้า (HomePro)', w: '260px', render: r => (
    <>
      <span className="font-mono text-[10px] text-[#0064D9]">{r.art_no ?? '—'}</span>
      <TextCell value={r.art_desc} max={260} />
    </>
  ) },
  { key: 'vendor_article', header: 'รหัสสินค้า Vendor', w: '130px', render: r => (
    <>
      <span className="font-mono text-[10px]">{r.vd_art_no ?? '—'}</span>
      {r.vd_art_desc && <span className="block text-[10px] text-[#6A6D70]">{r.vd_art_desc}</span>}
    </>
  ) },
  { key: 'mch', header: 'หมวดสินค้า', w: '170px', render: r => (
    <>
      <span className="font-mono text-[10px]">{r.mch3 ?? '—'}</span>
      <TextCell value={[r.mch2_desc, r.mch1_desc].filter(Boolean).join(' / ') || null} max={170} muted />
    </>
  ) },
  { key: 'onhand_qty', header: 'On-hand', w: '75px', align: 'right', render: r => <NumCell value={r.onhand_qty} />, total: { key: 'onhand_qty' } },
  { key: 'onhand_value', header: 'มูลค่า On-hand', w: '115px', align: 'right', render: r => <NumCell value={r.onhand_value} decimals={2} />, total: { key: 'onhand_value', decimals: 2 } },
  { key: 'stock_available_qty', header: 'พร้อมขาย', w: '75px', align: 'right', render: r => <NumCell value={r.stock_available_qty} />, total: { key: 'stock_available_qty' } },
  { key: 'rtv_qty', header: 'RTV', w: '60px', align: 'right', render: r => <NumCell value={r.rtv_qty} />, total: { key: 'rtv_qty' } },
  { key: 'avg_sale_qty_8w', header: 'ขายเฉลี่ย 8 สัปดาห์', w: '95px', align: 'right', render: r => <NumCell value={r.avg_sale_qty_8w} decimals={2} />, total: { key: 'avg_sale_qty_8w', decimals: 2 } },
  { key: 'coverage_day', header: 'Coverage (วัน)', w: '85px', align: 'right', render: r => <NumCell value={r.coverage_day} decimals={1} /> },
  { key: 'non_move', header: 'Non-move', w: '90px', align: 'center', render: r => (
    <span title={r.non_move_day != null ? `${r.non_move_day} วัน` : undefined}>
      <StatusBadge value={r.non_move_type} colorMap={NON_MOVE_COLORS} />
    </span>
  ) },
  { key: 'last_dates', header: 'รับเข้า / ขายล่าสุด', w: '120px', render: r => (
    <span className="text-[10px] text-[#6A6D70] whitespace-nowrap">
      {fmtDate(r.last_receive_date)}<br />{fmtDate(r.last_billing_date)}
    </span>
  ) },
]

/** CSV entries inside one inventory ZIP — shown inline under the file row. */
function FileCsvs({ fileId }: { fileId: number }) {
  const { data, isLoading } = useQuery<HpmhStockCsv[]>({
    queryKey: ['hpmh-stock-file-csvs', fileId],
    queryFn: () => api.get(`${API}/files/${fileId}/csvs`).then(r => r.data),
  })
  if (isLoading) return <span className="text-[10px] text-[#6A6D70]">กำลังโหลด...</span>
  if (!data?.length) return <span className="text-[10px] text-[#6A6D70]">ไม่มี CSV</span>
  return (
    <div className="space-y-0.5">
      {data.map(c => (
        <div key={c.id} className="flex items-center gap-2 text-[10px] text-[#6A6D70]">
          <span className="font-mono truncate" style={{ maxWidth: 300 }} title={c.csv_file_name ?? ''}>{c.csv_file_name}</span>
          <span className="tabular-nums">· {fmtNum(c.row_count)} แถว · {fmtBytes(c.file_size)}</span>
        </div>
      ))}
    </div>
  )
}

export default function HpmhStockInventoryPage() {
  const { can } = useAuth()
  const allowed = can('hpmh-stock-inventory.view')
  const [view, setView] = useState<View>('data')

  // ── Data filters ── (stockDate '' = latest stock date)
  const [search, setSearch] = useState('')
  const [stockDate, setStockDate] = useState('')
  const [siteNo, setSiteNo] = useState('')
  const [mch3, setMch3] = useState('')
  const [nonMoveType, setNonMoveType] = useState('')
  const [inStock, setInStock] = useState(false)
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  const [filePage, setFilePage] = useState(1)

  const { data: options } = useQuery<Options>({
    queryKey: ['hpmh-stock-options', VENDOR_NO],
    queryFn: () => api.get(`${API}/options`, { params: { vendor_no: VENDOR_NO } }).then(r => r.data),
    enabled: allowed,
  })

  const { data, isLoading } = useQuery<CrcPaginatedResponse<HpmhStockInventory, Totals>>({
    queryKey: ['hpmh-stock-inventory', VENDOR_NO, debouncedSearch, stockDate, siteNo, mch3, nonMoveType, inStock, page],
    queryFn: () => api.get(`${API}/inventory`, {
      params: {
        vendor_no: VENDOR_NO,
        search: debouncedSearch || undefined,
        stock_date: stockDate || undefined,
        site_no: siteNo || undefined,
        mch3: mch3 || undefined,
        non_move_type: nonMoveType || undefined,
        in_stock: inStock ? 1 : undefined,
        page,
        per_page: 50,
      },
    }).then(r => r.data),
    enabled: allowed && view === 'data',
    placeholderData: keepPreviousData,
  })

  const { data: filesData, isLoading: filesLoading } = useQuery<PaginatedResponse<HpmhStockFile>>({
    queryKey: ['hpmh-stock-files', VENDOR_NO, filePage],
    queryFn: () => api.get(`${API}/files`, { params: { vendor_no: VENDOR_NO, page: filePage, per_page: 20 } }).then(r => r.data),
    enabled: allowed && view === 'files',
  })

  if (!allowed) return <ErpNoAccess />

  const hasFilter = !!(search || stockDate || siteNo || mch3 || nonMoveType || inStock)
  const resetFilters = () => {
    setSearch(''); setStockDate(''); setSiteNo(''); setMch3(''); setNonMoveType(''); setInStock(false); setPage(1)
  }
  const shownDate = stockDate || options?.stock_dates[0]

  const FILE_COLUMNS: CrcColumn<HpmhStockFile>[] = [
    { key: 'id', header: 'ID', w: '50px', align: 'center', render: f => <span className="text-[#6A6D70] font-mono text-[10px]">{f.id}</span> },
    { key: 'stock_date', header: 'วันที่สต็อก', w: '90px', render: f => <span className="whitespace-nowrap">{fmtDate(f.stock_date)}</span> },
    { key: 'file_name', header: 'ไฟล์ / CSV ในไฟล์', w: '360px', render: f => (
      <>
        <TextCell value={f.file_name} max={360} mono />
        <FileCsvs fileId={f.id} />
      </>
    ) },
    { key: 'row_count', header: 'แถว', w: '80px', align: 'right', render: f => f.row_count != null ? <span className="font-semibold tabular-nums">{fmtNum(f.row_count)}</span> : dash },
    { key: 'total_onhand_qty', header: 'On-hand รวม', w: '90px', align: 'right', render: f => <NumCell value={f.total_onhand_qty} /> },
    { key: 'total_onhand_value', header: 'มูลค่ารวม', w: '130px', align: 'right', render: f => <NumCell value={f.total_onhand_value} decimals={2} /> },
    { key: 'file_size', header: 'ขนาดไฟล์', w: '80px', align: 'right', render: f => <span className="text-[#6A6D70]">{fmtBytes(f.file_size)}</span> },
    { key: 'downloaded_at', header: 'ดึงข้อมูลเมื่อ', w: '130px', render: f => <span className="text-[#6A6D70] whitespace-nowrap">{fmtDateTime(f.downloaded_at)}</span> },
    { key: 'actions', header: '', w: '90px', align: 'center', render: f => (
      <div className="flex items-center justify-center gap-1">
        {f.stock_date && <ViewDataButton onClick={() => { resetFilters(); setStockDate(f.stock_date!); setView('data') }} />}
        <CrcDownloadButton path={`${API}/files/${f.id}/download`} title="ดาวน์โหลดไฟล์ (zip)" />
      </div>
    ) },
  ]

  const headerCount = view === 'data'
    ? (isLoading ? '...' : `${data?.total?.toLocaleString('th-TH') ?? 0} รายการ${shownDate ? ` · สต็อก ณ ${fmtDate(shownDate)}` : ''}`)
    : view === 'files'
      ? (filesLoading ? '...' : `${filesData?.total?.toLocaleString('th-TH') ?? 0} ไฟล์`)
      : undefined

  return (
    <div className="space-y-0 text-[#32363A]">
      <CrcHeader
        section={`HP-MH Stock / Vendor ${VENDOR_NO}`}
        crumb="Inventory"
        title="สต็อกสินค้าคงเหลือ (Inventory Export)"
        right={headerCount}
      />
      <CrcViewTabs<View>
        tabs={[
          { key: 'data', label: 'รายการสต็อก' },
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
                  placeholder="รหัส/ชื่อสินค้า, EAN, รหัส Vendor, สาขา..."
                  className={`${inputCls} pl-7 w-72`}
                />
              </div>
            </SapInput>
            <SapInput label="วันที่สต็อก">
              <select value={stockDate} onChange={e => { setStockDate(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[150px]`}>
                <option value="">ล่าสุด</option>
                {options?.stock_dates.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
              </select>
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
            <SapInput label="Non-move (วัน)">
              <select value={nonMoveType} onChange={e => { setNonMoveType(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[120px]`}>
                <option value="">ทั้งหมด</option>
                {sortNonMove(options?.non_move_types ?? []).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </SapInput>
            <label className="flex items-center gap-1.5 h-8 text-xs text-[#32363A] cursor-pointer select-none">
              <input type="checkbox" checked={inStock} onChange={e => { setInStock(e.target.checked); setPage(1) }} className="accent-[#0070F2]" />
              เฉพาะที่มีของ (On-hand &gt; 0)
            </label>
          </CrcFilterBar>
          <CrcTable
            columns={DATA_COLUMNS}
            data={data}
            isLoading={isLoading}
            page={page}
            setPage={setPage}
            emptyText="ไม่พบข้อมูลสต็อก"
            emptyIcon={<Boxes className="w-8 h-8" />}
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
          emptyIcon={<FileArchive className="w-8 h-8" />}
          unit="ไฟล์"
        />
      )}

      {view === 'logs' && <MtAuditLogTable base={API} queryKey="hpmh-stock" />}
    </div>
  )
}
