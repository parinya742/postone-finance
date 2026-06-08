'use client'

import api from '@/lib/api'
import { PostoneExportFile, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Lock, FileDown, ExternalLink } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtNum(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('th-TH')
}

export default function ExportFilesPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<PaginatedResponse<PostoneExportFile>>({
    queryKey: ['export-files', search, page],
    queryFn: () =>
      api.get('/export-files', {
        params: { search, page, per_page: 20 },
      }).then((r) => r.data),
    enabled: can('shipments.view'),
  })

  if (!can('shipments.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const items = data?.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-800">รายการไฟล์ไปรษณีย์ (Header Export Files Shipments)</h1>
        </div>
        <p className="text-slate-500 text-sm mt-1">ทั้งหมด {data?.total ?? 0} รายการ</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="ชื่อไฟล์, Account, Shop ID, ช่วงวันที่..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-slate-600">ID</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Account Name</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Shop ID</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">File Name</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">จำนวนแถว</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">ช่วงวันที่</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">สร้างเมื่อ</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  {[...Array(8)].map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                  <FileDown className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <span className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded text-xs font-mono font-medium">#{item.id}</span>
                  </td>
                  <td className="px-5 py-4 text-slate-700 text-sm font-medium">{item.account_name ?? '—'}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-600">{item.shop_id ?? '—'}</td>
                  <td className="px-5 py-4">
                    <p className="text-slate-800 text-xs truncate max-w-[240px]">{item.file_name ?? '—'}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-700 text-sm">
                    {item.row_count != null ? (
                      <span className="font-medium">{fmtNum(item.row_count)}</span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-4 text-slate-600 text-xs font-mono">{item.filter_range ?? '—'}</td>
                  <td className="px-5 py-4 text-slate-400 text-xs">{fmtDate(item.created_at)}</td>
                  <td className="px-5 py-4">
                    {item.s3_url && (
                      <a
                        href={item.s3_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors inline-flex"
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
