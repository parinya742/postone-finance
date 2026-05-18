'use client'

import api from '@/lib/api'
import { ThailandPostAcceptance, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Lock, Truck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'

const SOURCE_COLORS: Record<string, string> = {
  zip_extracted: 'bg-yellow-100 text-yellow-700',
  direct: 'bg-blue-100 text-blue-700',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtNum(n: number | null, decimals = 2) {
  if (n == null) return '—'
  return n.toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export default function ThaipostPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<PaginatedResponse<ThailandPostAcceptance>>({
    queryKey: ['thaipost', search, sourceType, page],
    queryFn: () =>
      api.get('/thaipost', { params: { search, file_source_type: sourceType, page, per_page: 20 } }).then((r) => r.data),
    enabled: can('thaipost.view'),
  })

  if (!can('thaipost.view')) {
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
        <h1 className="text-2xl font-bold text-slate-800">ไปรษณีย์ไทย — Acceptance</h1>
        <p className="text-slate-500 text-sm mt-1">ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} รายการ</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Barcode, ชื่อผู้รับ, ผู้ส่ง, TR No..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={sourceType}
          onChange={(e) => { setSourceType(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">ทุกประเภท</option>
          <option value="zip_extracted">Zip Extracted</option>
          <option value="direct">Direct</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Barcode</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">ผู้รับ</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">ผู้ส่ง</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">ที่ทำการ</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">บริการ</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">น้ำหนัก (g)</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">ค่าบริการ</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">COD</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">แหล่งข้อมูล</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">นำเข้า</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {[...Array(10)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-5 py-12 text-center text-slate-400">
                  <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{item.barcode ?? '—'}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 truncate max-w-[140px] text-xs">{item.recipient_name ?? '—'}</p>
                    {item.recipient_phone && <p className="text-slate-400 text-xs">{item.recipient_phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs truncate max-w-[120px]">{item.sender_name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    <p className="text-slate-700 truncate max-w-[120px]">{item.office_name ?? '—'}</p>
                    {item.office_code && <p className="text-slate-400 font-mono">{item.office_code}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs truncate max-w-[100px]">{item.service_name ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700 text-xs font-mono">
                    {item.weight_grams != null ? fmtNum(item.weight_grams, 0) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 text-xs font-medium">
                    {item.service_fee != null ? `฿${fmtNum(item.service_fee)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-medium">
                    {item.cod_amount != null && item.cod_amount > 0 ? (
                      <span className="text-emerald-600">฿{fmtNum(item.cod_amount)}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {item.file_source_type ? (
                      <span className={clsx('px-2 py-0.5 rounded text-[10px] font-medium', SOURCE_COLORS[item.file_source_type] ?? 'bg-slate-100 text-slate-600')}>
                        {item.file_source_type}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(item.imported_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

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
