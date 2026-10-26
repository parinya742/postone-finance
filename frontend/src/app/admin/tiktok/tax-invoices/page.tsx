'use client'

import api from '@/lib/api'
import { TikTokTaxInvoiceFile, TikTokTaxInvoiceDocument, TikTokShop, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { Search, Lock, FileArchive, Download, ChevronRight, ChevronDown, Eye } from 'lucide-react'
import clsx from 'clsx'
import PdfViewer from '@/components/ui/PdfViewer'
import { useAuth } from '@/context/AuthContext'

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtBytes(bytes: number | null) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const INVOICE_TYPES: Record<string, { label: string; cls: string }> = {
  PlatformInvoice: { label: 'ใบกำกับภาษีค่าธรรมเนียมแพลตฟอร์ม', cls: 'bg-blue-100 text-blue-700' },
  AffiliateCommission: { label: 'ค่าคอมมิชชัน Affiliate', cls: 'bg-purple-100 text-purple-700' },
  AffiliateCommissionInvoice: { label: 'ใบกำกับภาษีค่าคอมมิชชัน Affiliate', cls: 'bg-fuchsia-100 text-fuchsia-700' },
}

function InvoiceTypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-slate-300">—</span>
  const t = INVOICE_TYPES[type]
  return (
    <div>
      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${t?.cls ?? 'bg-slate-100 text-slate-600'}`}>
        {type}
      </span>
      {t && <p className="text-[10px] text-slate-500 mt-0.5">{t.label}</p>}
    </div>
  )
}

// ---- PDFs extracted from the zip (inline expanded row) ----

function docPrefix(docNo: string) {
  return docNo.match(/^[A-Z]+/)?.[0] ?? null
}

// S3 has no CORS, so ask the API for a presigned URL with attachment disposition
async function downloadDocument(doc: TikTokTaxInvoiceDocument) {
  try {
    const { data } = await api.get<{ url: string }>(`/tiktok/tax-invoice-documents/${doc.id}/download`)
    const a = document.createElement('a')
    a.href = data.url
    a.click()
  } catch {
    alert('ดาวน์โหลดไฟล์ PDF ไม่สำเร็จ')
  }
}

function TaxDocumentsPanel({ fileId }: { fileId: number }) {
  const [search, setSearch] = useState('')
  const [viewingId, setViewingId] = useState<number | null>(null)
  const { data: documents = [], isLoading } = useQuery<TikTokTaxInvoiceDocument[]>({
    queryKey: ['tiktok-tax-invoice-documents', fileId],
    queryFn: () => api.get(`/tiktok/tax-invoices/${fileId}/documents`).then((r) => r.data),
  })

  if (isLoading) {
    return (
      <div className="px-5 py-4 bg-slate-50/70 space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="px-5 py-6 bg-slate-50/70 text-center text-xs text-slate-400">
        ไม่พบไฟล์ PDF ในไฟล์นี้ (อาจยังไม่ได้แตกไฟล์ zip)
      </div>
    )
  }

  const q = search.trim().toLowerCase()
  const shown = q
    ? documents.filter((d) => d.document_no.toLowerCase().includes(q) || (d.file_name ?? '').toLowerCase().includes(q))
    : documents

  // Viewer navigates within the currently filtered list
  const viewingIdx = viewingId == null ? -1 : shown.findIndex((d) => d.id === viewingId)
  const viewing = viewingIdx >= 0 ? shown[viewingIdx] : null

  return (
    <div className="px-5 py-4 bg-slate-50/70 space-y-2">
      <div className="flex items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาเลขที่เอกสาร..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <span className="text-xs text-slate-500">
          {q ? `${shown.length} / ` : ''}{documents.length} ไฟล์ PDF
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden max-h-[420px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-500 w-12">#</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">เลขที่เอกสาร</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">Prefix</th>
              <th className="text-right px-3 py-2 font-medium text-slate-500">ขนาดไฟล์</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">บันทึกเมื่อ</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((doc, i) => {
              const prefix = docPrefix(doc.document_no)
              return (
                <tr
                  key={doc.id}
                  onClick={() => setViewingId(doc.id)}
                  className="hover:bg-[#EBF5FE] transition-colors cursor-pointer"
                >
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-[#0070F2] hover:underline">{doc.document_no}</td>
                  <td className="px-3 py-2">
                    {prefix ? (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{prefix}</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">{fmtBytes(doc.file_size)}</td>
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtDateTime(doc.created_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setViewingId(doc.id)}
                        className="p-1 text-slate-400 hover:text-[#0070F2] hover:bg-[#EBF5FE] rounded transition-colors inline-flex"
                        title="ดูเอกสาร PDF"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {doc.s3_key && (
                        <button
                          onClick={() => downloadDocument(doc)}
                          className="p-1 text-slate-400 hover:text-[#0070F2] hover:bg-[#EBF5FE] rounded transition-colors inline-flex"
                          title="ดาวน์โหลด PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <PdfViewer
        open={viewing != null}
        onClose={() => setViewingId(null)}
        title={viewing?.document_no ?? ''}
        subtitle={viewing ? [
          viewing.invoice_type && (INVOICE_TYPES[viewing.invoice_type]?.label ?? viewing.invoice_type),
          viewing.period_from && `รอบ ${viewing.period_from}${viewing.period_to && viewing.period_to !== viewing.period_from ? ` – ${viewing.period_to}` : ''}`,
          fmtBytes(viewing.file_size),
        ].filter(Boolean).join(' · ') : undefined}
        src={viewing?.s3_url ?? null}
        onDownload={viewing?.s3_key ? () => downloadDocument(viewing) : undefined}
        nav={viewing ? {
          index: viewingIdx,
          total: shown.length,
          onPrev: () => setViewingId(shown[viewingIdx - 1]?.id ?? viewingId),
          onNext: () => setViewingId(shown[viewingIdx + 1]?.id ?? viewingId),
        } : undefined}
      />
    </div>
  )
}

// ---- Page ----

export default function TikTokTaxInvoicesPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [shopCode, setShopCode] = useState('')
  const [invoiceType, setInvoiceType] = useState('')
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data: shopsData } = useQuery<PaginatedResponse<TikTokShop>>({
    queryKey: ['tiktok-shops-all'],
    queryFn: () => api.get('/tiktok/shops', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('tiktok-tax-invoices.view'),
  })

  const { data: types } = useQuery<string[]>({
    queryKey: ['tiktok-tax-invoice-types'],
    queryFn: () => api.get('/tiktok/tax-invoice-types').then((r) => r.data),
    enabled: can('tiktok-tax-invoices.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<TikTokTaxInvoiceFile>>({
    queryKey: ['tiktok-tax-invoices', search, page, shopCode, invoiceType, periodFrom, periodTo],
    queryFn: () =>
      api.get('/tiktok/tax-invoices', {
        params: {
          search,
          page,
          per_page: 20,
          shop_code: shopCode || undefined,
          invoice_type: invoiceType || undefined,
          period_from: periodFrom || undefined,
          period_to: periodTo || undefined,
        },
      }).then((r) => r.data),
    enabled: can('tiktok-tax-invoices.view'),
  })

  if (!can('tiktok-tax-invoices.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const items = data?.data ?? []
  const shops = (shopsData?.data ?? []).filter((s) => s.shops_code)
  const hasFilter = !!(search || shopCode || invoiceType || periodFrom || periodTo)

  const resetFilters = () => {
    setSearch('')
    setShopCode('')
    setInvoiceType('')
    setPeriodFrom('')
    setPeriodTo('')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FileArchive className="w-6 h-6 text-rose-500" />
          <h1 className="text-2xl font-bold text-slate-800">เอกสารทางภาษี TikTok</h1>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          ทั้งหมด {data?.total ?? 0} ไฟล์
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="ชื่อร้าน, ชื่อไฟล์, Shop Code, เลขที่เอกสาร..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <select
          value={shopCode}
          onChange={(e) => { setShopCode(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
        >
          <option value="">ทุกร้านค้า</option>
          {shops.map((s) => (
            <option key={s.id} value={s.shops_code!}>{s.seller_name ?? s.shops_code}</option>
          ))}
        </select>

        <select
          value={invoiceType}
          onChange={(e) => { setInvoiceType(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
        >
          <option value="">ทุกประเภทเอกสาร</option>
          {(types ?? []).map((t) => (
            <option key={t} value={t}>{INVOICE_TYPES[t]?.label ?? t}</option>
          ))}
        </select>

        <input
          type="month"
          value={periodFrom}
          onChange={(e) => { setPeriodFrom(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          title="รอบเดือน เริ่มต้น"
        />
        <input
          type="month"
          value={periodTo}
          onChange={(e) => { setPeriodTo(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          title="รอบเดือน สิ้นสุด"
        />

        {hasFilter && (
          <button
            onClick={resetFilters}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-10" />
                <th className="text-left px-5 py-3 font-medium text-slate-600">ID</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">ร้านค้า</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">ประเภทเอกสาร</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">รอบเดือน</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Part</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">PDF</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">ชื่อไฟล์</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">ขนาดไฟล์</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">สร้างเมื่อ</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(11)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-slate-400">
                    <FileArchive className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบเอกสารทางภาษี
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <Fragment key={item.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    className={clsx('hover:bg-slate-50 transition-colors cursor-pointer', expandedId === item.id && 'bg-rose-50/40')}
                  >
                    <td className="pl-4 py-4 text-slate-400">
                      {expandedId === item.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 text-center">{item.id}</td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800 text-sm">{item.shop_name ?? '—'}</p>
                      <span className="text-xs font-mono text-rose-600">{item.shop_code}</span>
                    </td>
                    <td className="px-5 py-4"><InvoiceTypeBadge type={item.invoice_type} /></td>
                    <td className="px-5 py-4 text-xs font-mono text-slate-600 whitespace-nowrap">
                      {item.period_from ?? '—'}
                      {item.period_to && item.period_to !== item.period_from ? ` → ${item.period_to}` : ''}
                    </td>
                    <td className="px-5 py-4 text-center text-xs text-slate-600">{item.part_no ?? '—'}</td>
                    <td className="px-5 py-4 text-right">
                      {item.document_count > 0
                        ? <span className="font-semibold text-slate-700">{item.document_count.toLocaleString('th-TH')}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs font-mono text-slate-700 truncate max-w-[280px]" title={item.file_name ?? ''}>
                        {item.file_name ?? '—'}
                      </p>
                      {item.source_file_name && (
                        <p className="text-[10px] text-slate-400 truncate max-w-[280px]" title={item.source_file_name}>
                          ต้นฉบับ: {item.source_file_name}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right text-xs text-slate-500">{fmtBytes(item.file_size)}</td>
                    <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">{fmtDateTime(item.created_at)}</td>
                    <td className="px-5 py-4">
                      {item.s3_url && (
                        <a
                          href={item.s3_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors inline-flex"
                          title="ดาวน์โหลดไฟล์ (zip)"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </td>
                  </tr>
                  {expandedId === item.id && (
                    <tr>
                      <td colSpan={11} className="p-0">
                        <TaxDocumentsPanel fileId={item.id} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.last_page > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <span>หน้า {data.current_page} จาก {data.last_page} (ทั้งหมด {data.total} รายการ)</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50">ก่อนหน้า</button>
              <button disabled={page === data.last_page} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50">ถัดไป</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
