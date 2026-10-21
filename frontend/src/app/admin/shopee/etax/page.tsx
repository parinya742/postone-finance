'use client'

import api from '@/lib/api'
import { ShopeeEtaxFile, ShopeeEtaxDocument, ShopeeShop, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import clsx from 'clsx'
import {
  Search,
  Lock,
  FileArchive,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

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

const DOC_TYPE_COLORS: Record<string, string> = {
  Invoice: 'bg-blue-100 text-blue-700',
  Receipt: 'bg-green-100 text-green-700',
  'Credit Note': 'bg-yellow-100 text-yellow-700',
}

// ---- Documents panel (inline expanded row) ----

function EtaxDocumentsPanel({ fileId }: { fileId: number }) {
  const { data: documents = [], isLoading } = useQuery<ShopeeEtaxDocument[]>({
    queryKey: ['shopee-etax-documents', fileId],
    queryFn: () => api.get(`/shopee/etax-files/${fileId}/documents`).then((r) => r.data),
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
        ไม่พบไฟล์ PDF ในไฟล์นี้
      </div>
    )
  }

  return (
    <div className="px-5 py-4 bg-slate-50/70">
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-500">เลขที่เอกสาร</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">ประเภท</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">Provider</th>
              <th className="text-left px-3 py-2 font-medium text-slate-500">วันที่เอกสาร</th>
              <th className="text-right px-3 py-2 font-medium text-slate-500">ขนาดไฟล์</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2 font-mono text-blue-700">{doc.document_no ?? '—'}</td>
                <td className="px-3 py-2">
                  {doc.document_type ? (
                    <span className={clsx('px-2 py-0.5 rounded-full font-medium', DOC_TYPE_COLORS[doc.document_type] ?? 'bg-slate-100 text-slate-600')}>
                      {doc.document_type}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-500">{doc.provider ?? '—'}</td>
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(doc.doc_date)}</td>
                <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">{fmtBytes(doc.file_size)}</td>
                <td className="px-3 py-2 text-center">
                  {doc.s3_url && (
                    <a
                      href={doc.s3_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors inline-flex"
                      title="เปิดไฟล์ PDF"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---- Page ----

export default function ShopeeEtaxPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [shopName, setShopName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [expandedFileId, setExpandedFileId] = useState<number | null>(null)

  const { data: shopsData } = useQuery<PaginatedResponse<ShopeeShop>>({
    queryKey: ['shopee-shops-all'],
    queryFn: () => api.get('/shopee/shops', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('shopee-etax.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<ShopeeEtaxFile>>({
    queryKey: ['shopee-etax-files', search, page, shopName, startDate, endDate],
    queryFn: () =>
      api.get('/shopee/etax-files', {
        params: {
          search: search || undefined,
          page,
          per_page: 20,
          shop_name: shopName || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
      }).then((r) => r.data),
    enabled: can('shopee-etax.view'),
  })

  if (!can('shopee-etax.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const items = data?.data ?? []
  const shops = shopsData?.data ?? []
  const hasFilter = !!(search || shopName || startDate || endDate)

  const resetFilters = () => {
    setSearch('')
    setShopName('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FileArchive className="w-6 h-6 text-orange-500" />
          <h1 className="text-2xl font-bold text-slate-800">ใบกำกับภาษี (e-Tax) Shopee</h1>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} ไฟล์
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="ชื่อไฟล์ zip, ร้านค้า..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <select
          value={shopName}
          onChange={(e) => { setShopName(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
        >
          <option value="">ทุกร้านค้า</option>
          {shops.map((s) => (
            <option key={s.shop_id} value={s.shop_name ?? s.shop_id}>{s.shop_name ?? s.shop_id}</option>
          ))}
        </select>

        <input
          type="date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="วันที่เริ่มต้น"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="วันที่สิ้นสุด"
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
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3" />
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ไฟล์ Zip</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ร้านค้า</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ช่วงวันที่</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">จำนวน PDF</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ขนาดไฟล์</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">สร้างเมื่อ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <FileArchive className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบไฟล์ใบกำกับภาษี
                  </td>
                </tr>
              ) : (
                items.flatMap((item) => {
                  const isExpanded = expandedFileId === item.id
                  return [
                    <tr
                      key={item.id}
                      className={clsx('transition-colors', isExpanded ? 'bg-orange-50/40' : 'hover:bg-slate-50')}
                    >
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setExpandedFileId(isExpanded ? null : item.id)}
                          className={clsx(
                            'p-1.5 rounded transition-colors',
                            isExpanded
                              ? 'text-orange-600 bg-orange-100 hover:bg-orange-200'
                              : 'text-slate-400 hover:text-orange-600 hover:bg-orange-50',
                          )}
                          title={isExpanded ? 'ย่อรายการ PDF' : 'ขยายดูรายการ PDF'}
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 text-sm truncate max-w-[260px]">{item.file_name ?? '—'}</p>
                        <p className="text-xs text-slate-400 font-mono">{item.shop_id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-700">{item.shop_name ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-600 whitespace-nowrap">
                        {fmtDate(item.range_from)} – {fmtDate(item.range_to)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.pdf_count != null ? (
                          <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded text-xs font-medium">
                            {item.pdf_count.toLocaleString('th-TH')} ไฟล์
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500 whitespace-nowrap">{fmtBytes(item.file_size)}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDateTime(item.created_at)}</td>
                      <td className="px-4 py-3">
                        {item.s3_url && (
                          <a
                            href={item.s3_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors inline-flex"
                            title="ดาวน์โหลดไฟล์ zip"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </td>
                    </tr>,
                    isExpanded && (
                      <tr key={`docs-${item.id}`} className="bg-slate-50/70 border-b border-slate-100">
                        <td colSpan={8} className="p-0">
                          <EtaxDocumentsPanel fileId={item.id} />
                        </td>
                      </tr>
                    ),
                  ].filter(Boolean)
                })
              )}
            </tbody>
          </table>
        </div>

        {data && data.last_page > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <span>หน้า {data.current_page} จาก {data.last_page} (ทั้งหมด {data.total?.toLocaleString('th-TH')} รายการ)</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50">ก่อนหน้า</button>
              <button disabled={page === data.last_page} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50">ถัดไป</button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1">
        <FileText className="w-3.5 h-3.5" />
        ข้อมูลดึงจาก Shopee e-Tax (shopee_etax_file / shopee_etax_document) · ไฟล์เก็บใน S3
      </p>
    </div>
  )
}
