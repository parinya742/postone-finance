'use client'

import api from '@/lib/api'
import { LineGroupFile, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Lock, FileArchive, ExternalLink } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'

const EXT_COLORS: Record<string, string> = {
  zip: 'bg-yellow-100 text-yellow-700',
  pdf: 'bg-red-100 text-red-700',
  xlsx: 'bg-green-100 text-green-700',
  xls: 'bg-green-100 text-green-700',
  csv: 'bg-teal-100 text-teal-700',
  png: 'bg-purple-100 text-purple-700',
  jpg: 'bg-purple-100 text-purple-700',
  jpeg: 'bg-purple-100 text-purple-700',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

export default function LineFilesPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [extFilter, setExtFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<PaginatedResponse<LineGroupFile>>({
    queryKey: ['line-files', search, extFilter, page],
    queryFn: () =>
      api.get('/line-files', { params: { search, extension: extFilter, page, per_page: 20 } }).then((r) => r.data),
    enabled: can('line-files.view'),
  })

  if (!can('line-files.view')) {
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
        <h1 className="text-2xl font-bold text-slate-800">LINE Group Files</h1>
        <p className="text-slate-500 text-sm mt-1">ทั้งหมด {data?.total ?? 0} ไฟล์</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="ชื่อไฟล์, Group ID, Message ID..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={extFilter}
          onChange={(e) => { setExtFilter(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">ทุกประเภท</option>
          {['zip', 'pdf', 'xlsx', 'xls', 'csv', 'png', 'jpg'].map((ext) => (
            <option key={ext} value={ext}>.{ext}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-slate-600">ID</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">ชื่อไฟล์</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">ประเภท</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Group ID</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Extracted</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">วันที่</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                  <FileArchive className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 text-slate-400 text-xs font-mono">{item.id}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-800 truncate max-w-[220px]">{item.original_file_name ?? '—'}</p>
                    <p className="text-xs text-slate-400 font-mono truncate max-w-[220px]">{item.message_id ?? ''}</p>
                  </td>
                  <td className="px-5 py-4">
                    {item.file_extension ? (
                      <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium uppercase', EXT_COLORS[item.file_extension.toLowerCase()] ?? 'bg-slate-100 text-slate-600')}>
                        .{item.file_extension}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-4 text-slate-500 font-mono text-xs truncate max-w-[120px]">{item.group_id ?? '—'}</td>
                  <td className="px-5 py-4">
                    {item.extracted_files_count != null ? (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-medium">{item.extracted_files_count} ไฟล์</span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-4 text-slate-400 text-xs">{fmtDate(item.created_at)}</td>
                  <td className="px-5 py-4">
                    {item.file_url && (
                      <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors inline-flex">
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
            <span>หน้า {data.current_page} จาก {data.last_page}</span>
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
