'use client'

import api from '@/lib/api'
import { CrcPaginatedResponse, HpmhCorrespondence, HpmhLeaflet, PaginatedResponse } from '@/lib/types'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Newspaper } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, SapInput, inputCls, ErpNoAccess } from '@/components/erp'
import {
  CrcHeader, CrcFilterBar, CrcTable, NumCell, TextCell, useDebounced, type CrcColumn,
} from '@/components/crc'

type SumKey =
  | 'billing_qty' | 'billing_amount_before_discount' | 'discount_total'
  | 'billing_amount' | 'leaflet_disc' | 'leaflet_disc_vat'

const COLUMNS: CrcColumn<HpmhLeaflet>[] = [
  { key: 'billing_date', header: 'Billing Date', w: '90px', render: r => <span className="text-[#6A6D70]">{fmtDate(r.billing_date)}</span> },
  { key: 'doc', header: 'หนังสือ', w: '150px', render: r => (
    <>
      <TextCell value={r.subject} max={150} />
      <span className="block font-mono text-[10px] text-[#6A6D70]">#{r.content_item_id} · row {r.row_no ?? '—'}</span>
    </>
  ) },
  { key: 'invoice_no', header: 'Invoice', w: '100px', render: r => <TextCell value={r.invoice_no} mono /> },
  { key: 'store', header: 'Store', w: '180px', render: r => (
    <>
      <span className="font-mono text-[10px] text-[#0064D9]">{r.store_code ?? '—'}</span>
      <TextCell value={r.store_name} max={180} muted />
    </>
  ) },
  { key: 'ticket_no', header: 'Ticket', w: '150px', render: r => (
    <>
      <TextCell value={r.ticket_no} mono />
      <span className="block text-[10px] text-[#6A6D70]">{r.sales_channel ?? ''}</span>
    </>
  ) },
  { key: 'article', header: 'Article', w: '240px', render: r => (
    <>
      <span className="font-mono text-[10px]">{r.article_no ?? '—'}</span>
      <TextCell value={r.article_name} max={240} muted />
    </>
  ) },
  { key: 'discount_reason', header: 'Discount Reason', w: '100px', render: r => (
    <TextCell value={[r.discount_reason_code, r.discount_reason].filter(Boolean).join(' · ') || null} max={100} mono />
  ) },
  { key: 'billing_qty', header: 'Qty', w: '60px', align: 'right', render: r => <NumCell value={r.billing_qty} />, total: { key: 'billing_qty' } },
  { key: 'billing_amount_before_discount', header: 'ก่อนลด', w: '100px', align: 'right', render: r => <NumCell value={r.billing_amount_before_discount} decimals={2} />, total: { key: 'billing_amount_before_discount', decimals: 2 } },
  { key: 'discount_pct', header: '% ลด', w: '60px', align: 'right', render: r => <NumCell value={r.discount_pct} decimals={2} /> },
  { key: 'discount_total', header: 'ส่วนลดรวม', w: '100px', align: 'right', render: r => <NumCell value={r.discount_total} decimals={2} />, total: { key: 'discount_total', decimals: 2 } },
  { key: 'billing_amount', header: 'Billing Amount', w: '100px', align: 'right', render: r => <NumCell value={r.billing_amount} decimals={2} />, total: { key: 'billing_amount', decimals: 2 } },
  { key: 'leaflet_disc', header: 'Leaflet Disc', w: '100px', align: 'right', render: r => <NumCell value={r.leaflet_disc} decimals={2} colored />, total: { key: 'leaflet_disc', decimals: 2 } },
  { key: 'leaflet_disc_vat', header: 'Leaflet Disc + VAT', w: '110px', align: 'right', render: r => <NumCell value={r.leaflet_disc_vat} decimals={2} colored />, total: { key: 'leaflet_disc_vat', decimals: 2 } },
]

function HpmhLeafletsContent() {
  const { can } = useAuth()
  const allowed = can('hpmh-leaflets.view')
  const searchParams = useSearchParams()

  const [search, setSearch] = useState('')
  const [contentItemId, setContentItemId] = useState(() => searchParams.get('content_item_id') ?? '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  const { data: docs } = useQuery<PaginatedResponse<HpmhCorrespondence>>({
    queryKey: ['hpmh-correspondence', 'options', 'LEAFLET'],
    queryFn: () => api.get('/hpmh/correspondence', { params: { attachment_type: 'LEAFLET', per_page: 500 } }).then(r => r.data),
    enabled: allowed,
  })

  const { data, isLoading } = useQuery<CrcPaginatedResponse<HpmhLeaflet, SumKey>>({
    queryKey: ['hpmh-leaflets', debouncedSearch, contentItemId, startDate, endDate, page],
    queryFn: () => api.get('/hpmh/leaflets', {
      params: {
        search: debouncedSearch || undefined,
        content_item_id: contentItemId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        per_page: 50,
      },
    }).then(r => r.data),
    enabled: allowed,
    placeholderData: keepPreviousData,
  })

  if (!allowed) return <ErpNoAccess />

  const hasFilter = !!(search || contentItemId || startDate || endDate)
  const resetFilters = () => { setSearch(''); setContentItemId(''); setStartDate(''); setEndDate(''); setPage(1) }

  return (
    <div className="space-y-0 text-[#32363A]">
      <CrcHeader
        section="HP-MH"
        crumb="Leaflet"
        title="ชดเชย Leaflet (รายการส่วนลดจากหนังสือ)"
        right={isLoading ? '...' : `${data?.total?.toLocaleString('th-TH') ?? 0} รายการ`}
      />
      <CrcFilterBar hasFilter={hasFilter} onReset={resetFilters}>
        <SapInput label="ค้นหา">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6A6D70]" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Invoice, Ticket, Article, สาขา..."
              className={`${inputCls} pl-7 w-72`}
            />
          </div>
        </SapInput>
        <SapInput label="หนังสือ">
          <select value={contentItemId} onChange={e => { setContentItemId(e.target.value); setPage(1) }} className={`${inputCls} pr-7 min-w-[240px]`}>
            <option value="">ทั้งหมด</option>
            {docs?.data.map(d => (
              <option key={d.content_item_id} value={d.content_item_id}>{d.subject} (#{d.content_item_id})</option>
            ))}
          </select>
        </SapInput>
        <SapInput label="Billing Date ตั้งแต่">
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
        emptyText="ไม่พบรายการ Leaflet"
        emptyIcon={<Newspaper className="w-8 h-8" />}
      />
    </div>
  )
}

export default function HpmhLeafletsPage() {
  return (
    <Suspense>
      <HpmhLeafletsContent />
    </Suspense>
  )
}
