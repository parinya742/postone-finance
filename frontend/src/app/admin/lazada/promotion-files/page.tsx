'use client'

import api from '@/lib/api'
import { LazadaSvcExportFile, LazadaShop, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import { Search, Download, X, FileSpreadsheet, ListOrdered } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { TH, TD, AmountCell, StatusBadge, SapInput, inputCls, ErpNoAccess, ErpPagination } from '@/components/erp'

// ── Page-specific formatters ──────────────────────────────────────────────────

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtBytes(bytes: number | null) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FILE_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-[#F1FAF4] text-[#107E3E] border-[#107E3E]/40',
  failed:    'bg-[#FFF5F5] text-[#BB0000] border-[#BB0000]/40',
  error:     'bg-[#FFF5F5] text-[#BB0000] border-[#BB0000]/40',
  pending:   'bg-[#FEF9F0] text-[#E9730C] border-[#E9730C]/40',
}
const FILE_STATUS_LABELS: Record<string, string> = {
  completed: 'สำเร็จ',
  failed:    'ล้มเหลว',
  error:     'ผิดพลาด',
  pending:   'รอดำเนินการ',
}

// ─────────────────────────────────────────────────────────────────────────────

export default function LazadaPromotionFilesPage() {
  const { can } = useAuth()
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(1)
  const [sellerKey, setSellerKey] = useState('')
  const [hasRows, setHasRows]     = useState(true)

  const { data: shopsData } = useQuery<PaginatedResponse<LazadaShop>>({
    queryKey: ['lazada-shops-all'],
    queryFn: () => api.get('/lazada/shops', { params: { per_page: 100, is_active: true } }).then(r => r.data),
    enabled: can('lazada-shops.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<LazadaSvcExportFile>>({
    queryKey: ['lazada-svc-files', search, page, sellerKey, hasRows],
    queryFn: () => api.get('/lazada/svc-files', {
      params: {
        search: search || undefined, page, per_page: 20,
        seller_key: sellerKey || undefined,
        has_rows: hasRows ? 1 : undefined,
      },
    }).then(r => r.data),
    enabled: can('lazada-shops.view'),
  })

  if (!can('lazada-shops.view')) return <ErpNoAccess />

  const items     = data?.data ?? []
  const shops     = shopsData?.data ?? []
  const hasFilter = !!(search || sellerKey)
  const colCount  = 11

  return (
    <div className="space-y-0 text-[#32363A]">

      {/* ══ Page Header ══════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#D9D9D9] px-4 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-[#6A6D70] uppercase tracking-wide">Lazada / เครื่องมือโปรโมทสินค้า</p>
          <h1 className="text-sm font-semibold text-[#32363A] leading-tight">ไฟล์เครื่องมือโปรโมทสินค้า</h1>
        </div>
        <span className="text-xs text-[#6A6D70]">
          {isLoading ? '...' : `${data?.total?.toLocaleString('th-TH') ?? 0} ไฟล์`}
        </span>
      </div>

      {/* ══ Filter Bar ═══════════════════════════════════════════════════════ */}
      <div className="bg-[#F9FAFB] border-x border-b border-[#D9D9D9] px-4 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-semibold text-[#6A6D70] uppercase tracking-wider">ตัวกรอง</span>
          {hasFilter && (
            <button
              onClick={() => { setSearch(''); setSellerKey(''); setPage(1) }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#6A6D70] hover:text-[#32363A] border border-[#D9D9D9] rounded bg-white hover:bg-[#F5F5F5] transition-colors"
            >
              <X className="w-3 h-3" /> ล้างตัวกรอง
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <SapInput label="ค้นหา">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6A6D70]" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="ชื่อร้าน, ชื่อไฟล์, Seller Key..."
                className={`${inputCls} pl-7 w-64`}
              />
            </div>
          </SapInput>

          <SapInput label="ร้านค้า">
            <select
              value={sellerKey}
              onChange={e => { setSellerKey(e.target.value); setPage(1) }}
              className={`${inputCls} pr-7 min-w-[150px]`}
            >
              <option value="">ทั้งหมด</option>
              {shops.map(s => <option key={s.id} value={s.short_code}>{s.shop_name}</option>)}
            </select>
          </SapInput>

          <label className="flex items-center gap-2 h-8 text-xs text-[#32363A] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasRows}
              onChange={e => { setHasRows(e.target.checked); setPage(1) }}
              className="w-3.5 h-3.5 accent-[#0070F2]"
            />
            แสดงเฉพาะไฟล์ที่มีข้อมูล
          </label>
        </div>
      </div>

      {/* ══ Data Table ════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#D9D9D9] border-t-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: '1150px' }}>
          <thead>
            <tr className="bg-[#F2F4F7] border-b-2 border-[#0070F2]">
              <TH w="50px" center>ID</TH>
              <TH w="150px">ร้านค้า</TH>
              <TH w="260px">ชื่อไฟล์</TH>
              <TH w="170px">ช่วงวันที่</TH>
              <TH w="70px" right>แถว</TH>
              <TH w="90px" right>เชื่อมโยง</TH>
              <TH w="110px" right>ยอดรวม (฿)</TH>
              <TH w="70px" right>ขนาดไฟล์</TH>
              <TH w="80px" center>สถานะ</TH>
              <TH w="130px">สร้างเมื่อ</TH>
              <TH w="60px" center>{''}</TH>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-[#EBEBEB]">
                  {[...Array(colCount)].map((_, j) => (
                    <td key={j} className="px-2.5 py-1.5 border-r border-[#EBEBEB]">
                      <div className="h-2.5 bg-[#F2F4F7] rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-5 py-12 text-center text-[#6A6D70] text-sm">
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-[#D9D9D9]" />
                  ไม่พบไฟล์
                </td>
              </tr>
            ) : (
              items.map(item => (
                <tr key={item.id} className="border-b border-[#EBEBEB] hover:bg-[#F9FAFB] transition-colors">
                  <TD center>
                    <span className="text-[#6A6D70] font-mono text-[10px]">{item.id}</span>
                  </TD>
                  <TD>
                    <span className="font-semibold text-[#32363A]">{item.shop_name ?? '—'}</span>
                    <span className="block font-mono text-[10px] text-[#0064D9] mt-0.5">{item.seller_key}</span>
                  </TD>
                  <TD>
                    <span className="font-mono text-[10px] truncate block max-w-[260px]" title={item.file_name ?? ''}>
                      {item.file_name ?? '—'}
                    </span>
                    {item.lazada_filename && (
                      <span className="block text-[10px] text-[#6A6D70] truncate max-w-[260px]" title={item.lazada_filename}>
                        {item.lazada_filename}
                      </span>
                    )}
                  </TD>
                  <TD>
                    {item.date_from && item.date_to ? (
                      <span className="font-mono text-[10px] text-[#6A6D70] whitespace-nowrap">
                        {item.date_from}{item.date_to !== item.date_from ? ` → ${item.date_to}` : ''}
                      </span>
                    ) : <span className="text-[#D9D9D9]">—</span>}
                  </TD>
                  <TD right>
                    <span className="font-semibold tabular-nums">{(item.row_count ?? 0).toLocaleString('th-TH')}</span>
                  </TD>
                  <TD right>
                    {/* Rows re-downloaded in a later export are re-linked to that newer file */}
                    <span
                      className={`tabular-nums ${item.tx_count < (item.row_count ?? 0) ? 'text-[#E9730C]' : 'text-[#6A6D70]'}`}
                      title={item.tx_count < (item.row_count ?? 0) ? 'บางรายการถูกอัปเดตโดยไฟล์ที่ดึงภายหลัง' : undefined}
                    >
                      {Number(item.tx_count).toLocaleString('th-TH')}
                    </span>
                  </TD>
                  <TD right>
                    <AmountCell value={item.tx_amount == null ? null : Number(item.tx_amount)} />
                  </TD>
                  <TD right>
                    <span className="text-[#6A6D70]">{fmtBytes(item.file_size)}</span>
                  </TD>
                  <TD center>
                    <span title={item.error ?? undefined}>
                      <StatusBadge value={item.status} colorMap={FILE_STATUS_COLORS} labels={FILE_STATUS_LABELS} />
                    </span>
                  </TD>
                  <TD>
                    <span className="text-[#6A6D70] whitespace-nowrap">{fmtDateTime(item.created_at)}</span>
                  </TD>
                  <TD center>
                    <div className="inline-flex items-center gap-0.5">
                      {item.tx_count > 0 && (
                        <Link
                          href={`/admin/lazada/promotion?file_id=${item.id}`}
                          title="ดูรายการในไฟล์"
                          className="inline-flex items-center justify-center w-6 h-6 rounded text-[#6A6D70] hover:text-[#0070F2] hover:bg-[#EBF5FB] transition-colors"
                        >
                          <ListOrdered className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      {item.s3_url && (
                        <a
                          href={item.s3_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="ดาวน์โหลดไฟล์ Excel"
                          className="inline-flex items-center justify-center w-6 h-6 rounded text-[#6A6D70] hover:text-[#0070F2] hover:bg-[#EBF5FB] transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </TD>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data && <ErpPagination data={data} page={page} setPage={setPage} unit="ไฟล์" />}
      </div>
    </div>
  )
}
