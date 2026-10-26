'use client'

import api from '@/lib/api'
import { CrcPaginatedResponse, HpmhCorrespondence, HpmhCoupon, PaginatedResponse } from '@/lib/types'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Ticket } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, SapInput, inputCls, ErpNoAccess } from '@/components/erp'
import {
  CrcHeader, CrcFilterBar, CrcTable, NumCell, TextCell, useDebounced, type CrcColumn,
} from '@/components/crc'

type SumKey = 'qty' | 'net_price' | 'coupon_amount'

const COLUMNS: CrcColumn<HpmhCoupon>[] = [
  { key: 'sale_date', header: 'Sale Date', w: '90px', render: r => <span className="text-[#6A6D70]">{fmtDate(r.sale_date)}</span> },
  { key: 'doc', header: 'หนังสือ', w: '150px', render: r => (
    <>
      <TextCell value={r.subject} max={150} />
      <span className="block font-mono text-[10px] text-[#6A6D70]">#{r.content_item_id} · row {r.row_no ?? '—'}</span>
    </>
  ) },
  { key: 'promotion', header: 'Promotion', w: '230px', render: r => (
    <>
      <span className="font-mono text-[10px] text-[#0064D9]">{r.promotion_code ?? '—'}</span>
      <TextCell value={r.promotion_name} max={230} muted />
    </>
  ) },
  { key: 'promotion_group', header: 'Group', w: '100px', render: r => <TextCell value={r.promotion_group} max={100} muted /> },
  { key: 'store_code', header: 'Store', w: '60px', render: r => <span className="font-mono text-[10px]">{r.store_code ?? '—'}</span> },
  { key: 'ticket', header: 'Ticket', w: '100px', render: r => <TextCell value={r.ticket} mono /> },
  { key: 'article', header: 'Article', w: '200px', render: r => (
    <>
      <span className="font-mono text-[10px]">{r.article_no ?? '—'}</span>
      <TextCell value={r.article_name} max={200} muted />
    </>
  ) },
  { key: 'mch', header: 'MCH', w: '80px', render: r => <TextCell value={r.mch} mono /> },
  { key: 'invoice_no', header: 'Invoice', w: '100px', render: r => <TextCell value={r.invoice_no} mono /> },
  { key: 'qty', header: 'Qty', w: '60px', align: 'right', render: r => <NumCell value={r.qty} />, total: { key: 'qty' } },
  { key: 'net_price', header: 'Net Price', w: '110px', align: 'right', render: r => <NumCell value={r.net_price} decimals={2} />, total: { key: 'net_price', decimals: 2 } },
  { key: 'coupon_amount', header: 'Coupon Amount', w: '110px', align: 'right', render: r => <NumCell value={r.coupon_amount} decimals={2} colored />, total: { key: 'coupon_amount', decimals: 2 } },
]

function HpmhCouponsContent() {
  const { can } = useAuth()
  const allowed = can('hpmh-coupons.view')
  const searchParams = useSearchParams()

  const [search, setSearch] = useState('')
  const [contentItemId, setContentItemId] = useState(() => searchParams.get('content_item_id') ?? '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  const { data: docs } = useQuery<PaginatedResponse<HpmhCorrespondence>>({
    queryKey: ['hpmh-correspondence', 'options', 'COUPON'],
    queryFn: () => api.get('/hpmh/correspondence', { params: { attachment_type: 'COUPON', per_page: 500 } }).then(r => r.data),
    enabled: allowed,
  })

  const { data, isLoading } = useQuery<CrcPaginatedResponse<HpmhCoupon, SumKey>>({
    queryKey: ['hpmh-coupons', debouncedSearch, contentItemId, startDate, endDate, page],
    queryFn: () => api.get('/hpmh/coupons', {
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
        crumb="Vendor Coupon"
        title="Vendor Coupon (รายการคูปองจากหนังสือ)"
        right={isLoading ? '...' : `${data?.total?.toLocaleString('th-TH') ?? 0} รายการ`}
      />
      <CrcFilterBar hasFilter={hasFilter} onReset={resetFilters}>
        <SapInput label="ค้นหา">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6A6D70]" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Promotion, Ticket, Article, สาขา, Invoice..."
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
        <SapInput label="Sale Date ตั้งแต่">
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
        emptyText="ไม่พบรายการคูปอง"
        emptyIcon={<Ticket className="w-8 h-8" />}
      />
    </div>
  )
}

export default function HpmhCouponsPage() {
  return (
    <Suspense>
      <HpmhCouponsContent />
    </Suspense>
  )
}
