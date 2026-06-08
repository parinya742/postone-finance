'use client'

import api from '@/lib/api'
import { SoHead, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Lock, Database } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const COL_COUNT = 12

export default function SoHeadPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<PaginatedResponse<SoHead>>({
    queryKey: ['iscode-so-head', search, page],
    queryFn: () =>
      api.get('/iscode/so-head', { params: { search, page, per_page: 20 } }).then((r) => r.data),
    enabled: can('iscode.view'),
  })

  if (!can('iscode.view')) {
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
        <h1 className="text-2xl font-bold text-slate-800">SO Head</h1>
        <p className="text-slate-500 text-sm mt-1">
          ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} รายการ · ISCODE
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="CustName, SoNo, PINo, DINo, PONo..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1400px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">SODate</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">SoNo</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">PINo</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">DINo</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">PONo</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">CustID</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">CustName</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">NumOfItem</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">FieldSaleID</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">FieldSaleName</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">CreateBy</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">CreateByName</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">DocRemark</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ACCRemark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {[...Array(COL_COUNT)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={COL_COUNT} className="px-5 py-12 text-center text-slate-400">
                  <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={item.SoNo ?? idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-blue-700 whitespace-nowrap">{item.SODate ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{item.SoNo ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">{item.PINo ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{item.DINo ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{item.PONo ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-800 max-w-[180px] truncate">{item.CustID ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{item.CustName ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{item.NumOfItem ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{item.FieldSaleID ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{item.FieldSaleName ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{item.CreateBy ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{item.CreateByName ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{item.DocRemark ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{item.ACCRemark ?? '—'}</td>
                </tr>
              ))
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
    </div>
  )
}
