'use client'

import api from '@/lib/api'
import { TikTokOrderExportFile, TikTokShop, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import { Search, Lock, FileText, ExternalLink, ListOrdered } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { dateStyle: 'short' })
}

function fmtNum(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('th-TH')
}

function fmtBytes(bytes: number | null) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function TikTokOrderFilesPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [shopCode, setShopCode] = useState('')

  const { data: shopsData } = useQuery<PaginatedResponse<TikTokShop>>({
    queryKey: ['tiktok-shops-all'],
    queryFn: () => api.get('/tiktok/shops', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('tiktok-shops.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<TikTokOrderExportFile>>({
    queryKey: ['tiktok-order-files', search, page, shopCode],
    queryFn: () =>
      api.get('/tiktok/order-files', {
        params: { search, page, per_page: 20, shop_code: shopCode || undefined },
      }).then((r) => r.data),
    enabled: can('tiktok-shops.view'),
  })

  if (!can('tiktok-shops.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const items = data?.data ?? []
  const shops = (shopsData?.data ?? []).filter((s) => s.shops_code)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-rose-500" />
          <h1 className="text-2xl font-bold text-slate-800">ไฟล์คำสั่งซื้อ TikTok</h1>
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
            placeholder="ชื่อร้าน, ชื่อไฟล์, Shop Code..."
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

        {(search || shopCode) && (
          <button
            onClick={() => { setSearch(''); setShopCode(''); setPage(1) }}
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
                <th className="text-left px-5 py-3 font-medium text-slate-600">ID</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">ร้านค้า</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">ชื่อไฟล์</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">ช่วงวันที่</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">คำสั่งซื้อ</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">จำนวนแถว</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">ขนาดไฟล์</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">สร้างเมื่อ</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบไฟล์คำสั่งซื้อ
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 text-xs text-slate-500 text-center">{item.id}</td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800 text-sm">{item.shop_name ?? '—'}</p>
                      <span className="text-xs font-mono text-rose-600">{item.shop_code}</span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs font-mono text-slate-700 truncate max-w-[260px]" title={item.file_name ?? ''}>
                        {item.file_name ?? '—'}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-slate-600 whitespace-nowrap">
                      {fmtDate(item.range_from)}
                      {item.range_from && item.range_to ? ' – ' : ''}
                      {fmtDate(item.range_to)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-700">{fmtNum(item.order_count)}</td>
                    <td className="px-5 py-4 text-right text-slate-600">{fmtNum(item.row_count)}</td>
                    <td className="px-5 py-4 text-right text-xs text-slate-500">{fmtBytes(item.file_size)}</td>
                    <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">{fmtDateTime(item.created_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/admin/tiktok/orders?file_id=${item.id}`}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors inline-flex"
                          title="ดูรายการคำสั่งซื้อในไฟล์"
                        >
                          <ListOrdered className="w-4 h-4" />
                        </Link>
                        {item.s3_url && (
                          <a
                            href={item.s3_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors inline-flex"
                            title="ดาวน์โหลดไฟล์"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
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
