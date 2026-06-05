'use client'

import api from '@/lib/api'
import { TikTokTransactionFile, TikTokShop, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Lock, FileSpreadsheet, ExternalLink, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtNum(n: number | null, decimals = 0) {
  if (n == null) return '—'
  return n.toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtBytes(bytes: number | null) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function TikTokFilesPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [shopName, setShopName] = useState('')

  const { data: shopsData } = useQuery<PaginatedResponse<TikTokShop>>({
    queryKey: ['tiktok-shops-all'],
    queryFn: () => api.get('/tiktok/shops', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('tiktok-shops.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<TikTokTransactionFile>>({
    queryKey: ['tiktok-files', search, page, shopName],
    queryFn: () =>
      api.get('/tiktok/files', {
        params: { search, page, per_page: 20, shop_name: shopName || undefined },
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
  const shops = shopsData?.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-rose-500" />
          <h1 className="text-2xl font-bold text-slate-800">ไฟล์ส่งออก TikTok</h1>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          ทั้งหมด {data?.total ?? 0} ไฟล์ · สร้างอัตโนมัติโดย n8n และอัปโหลดขึ้น S3
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="ชื่อร้าน, ชื่อไฟล์, Shops Code..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <select
          value={shopName}
          onChange={(e) => { setShopName(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
        >
          <option value="">ทุกร้านค้า</option>
          {shops.map((s) => (
            <option key={s.id} value={s.seller_name ?? s.seller_id}>{s.seller_name ?? s.seller_id}</option>
          ))}
        </select>

        {(search || shopName) && (
          <button
            onClick={() => { setSearch(''); setShopName(''); setPage(1) }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-slate-600">ID</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">ร้านค้า</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">ชื่อไฟล์</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">ช่วงวันที่</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600">จำนวนแถว</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600">รายได้ (฿)</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600">Settlement (฿)</th>
              <th className="text-right px-5 py-3 font-medium text-slate-600">ขนาดไฟล์</th>
              <th className="text-center px-5 py-3 font-medium text-slate-600">Mode</th>
              <th className="text-center px-5 py-3 font-medium text-slate-600">สถานะ</th>
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
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบไฟล์ส่งออก
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 text-xs text-slate-500 text-center">{item.id}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-800 text-sm">{item.shop_name}</p>
                    {item.shops_code && (
                      <span className="text-xs font-mono text-rose-600">{item.shops_code}</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-xs font-mono text-slate-700 truncate max-w-[220px]" title={item.file_name ?? ''}>
                      {item.file_name ?? '—'}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-xs font-mono text-slate-600 whitespace-nowrap">
                    {item.start_date && item.end_date
                      ? `${item.start_date} → ${item.end_date}`
                      : '—'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {item.row_count != null ? (
                      <span className="font-semibold text-slate-700">{fmtNum(item.row_count)}</span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {item.total_revenue != null ? (
                      <span className={`font-semibold ${item.total_revenue < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {fmtNum(item.total_revenue, 2)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {item.total_settlement != null ? (
                      <span className={`font-semibold ${item.total_settlement < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {fmtNum(item.total_settlement, 2)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-4 text-right text-xs text-slate-500">
                    {fmtBytes(item.file_size_bytes)}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {item.report_mode ? (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono">
                        {item.report_mode}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {item.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        สำเร็จ
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                        {item.status ?? '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">{fmtDate(item.created_at)}</td>
                  <td className="px-5 py-4">
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

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
