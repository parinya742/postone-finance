'use client'

import api from '@/lib/api'
import { SoDocument, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Lock, Database } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

type Col = {
  label: string
  render: (r: SoDocument) => React.ReactNode
  className?: string
}

const SOURCE_BADGE: Record<string, string> = {
  SO: 'bg-blue-50 text-blue-700',
  OO: 'bg-amber-50 text-amber-700',
  IO: 'bg-emerald-50 text-emerald-700',
  Other: 'bg-slate-100 text-slate-600',
}

const mono = 'font-mono text-xs text-slate-600 whitespace-nowrap'
const text = 'text-xs text-slate-600 whitespace-nowrap'
const trunc = 'text-xs text-slate-500 max-w-[200px] truncate'

const COLUMNS: Col[] = [
  {
    label: 'Type',
    render: (r) => (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_BADGE[r.SourceType] ?? SOURCE_BADGE.Other}`}>
        {r.SourceType}
      </span>
    ),
  },
  { label: 'SODate', render: (r) => r.SODate, className: 'font-mono text-xs text-blue-700 whitespace-nowrap' },
  { label: 'SONo', render: (r) => r.SONo, className: mono },
  { label: 'SOStatus', render: (r) => r.SOStatus, className: text },
  { label: 'OODate', render: (r) => r.OODate, className: mono },
  { label: 'OONo', render: (r) => r.OONo, className: mono },
  { label: 'IODate', render: (r) => r.IODate, className: mono },
  { label: 'IONo', render: (r) => r.IONo, className: mono },
  { label: 'PIDate', render: (r) => r.PIDate, className: mono },
  { label: 'PINo', render: (r) => r.PINo, className: 'font-mono text-xs text-slate-700 whitespace-nowrap' },
  { label: 'PIStatus', render: (r) => r.PIStatus, className: text },
  { label: 'DINo', render: (r) => r.DINo, className: mono },
  { label: 'SINo', render: (r) => r.SINo, className: mono },
  { label: 'RefPONo', render: (r) => r.RefPONo, className: text },
  { label: 'CustId', render: (r) => r.CustId, className: text },
  { label: 'CustType', render: (r) => r.CustType, className: text },
  { label: 'CustName', render: (r) => r.CustName, className: 'text-xs text-slate-800 max-w-[220px] truncate' },
  { label: 'CountItem', render: (r) => r.CountItem, className: text },
  { label: 'SaleReptId', render: (r) => r.SaleReptId, className: text },
  { label: 'SaleReptName', render: (r) => r.SaleReptName, className: text },
  { label: 'CreateBy', render: (r) => r.CreateBy, className: text },
  { label: 'CreateByName', render: (r) => r.CreateByName, className: trunc },
  { label: 'SORemark', render: (r) => r.SORemark, className: trunc },
  { label: 'ACCRemark', render: (r) => r.ACCRemark, className: trunc },
]

const SOURCE_FILTERS = ['', 'SO', 'OO', 'IO'] as const

export default function SoDocumentsPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [sourceType, setSourceType] = useState<string>('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<PaginatedResponse<SoDocument>>({
    queryKey: ['iscode-so-documents', search, sourceType, page],
    queryFn: () =>
      api
        .get('/iscode/so-documents', {
          params: { search, source_type: sourceType || undefined, page, per_page: 20 },
        })
        .then((r) => r.data),
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
        <h1 className="text-2xl font-bold text-slate-800">เอกสาร SO / OO / IO</h1>
        <p className="text-slate-500 text-sm mt-1">
          ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} รายการ · ISCODE Replication
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="SONo, OONo, IONo, PINo, DINo, CustName..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={sourceType}
          onChange={(e) => { setSourceType(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SOURCE_FILTERS.map((s) => (
            <option key={s} value={s}>{s || 'ทุกประเภท'}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[2400px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.label} className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {COLUMNS.map((c) => (
                    <td key={c.label} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-5 py-12 text-center text-slate-400">
                  <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={`${item.PINo ?? ''}-${item.SONo ?? item.OONo ?? item.IONo ?? ''}-${idx}`} className="hover:bg-slate-50 transition-colors">
                  {COLUMNS.map((c) => (
                    <td key={c.label} className={`px-4 py-3 ${c.className ?? ''}`}>{c.render(item) ?? '—'}</td>
                  ))}
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
