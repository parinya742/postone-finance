'use client'

import api from '@/lib/api'
import { PostoneShipment, PostoneAccountType, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Lock, Package, Info } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'

const CHANNEL_COLORS: Record<string, string> = {
  Online: 'bg-blue-100 text-blue-700',
  Offline: 'bg-orange-100 text-orange-700',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ShipmentsPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [accountTypeFilter, setAccountTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<PaginatedResponse<PostoneShipment>>({
    queryKey: ['shipments', search, channelFilter, accountTypeFilter, dateFrom, dateTo, page],
    queryFn: () =>
      api.get('/shipments', {
        params: { search, channel: channelFilter, account_type_id: accountTypeFilter, date_from: dateFrom || undefined, date_to: dateTo || undefined, page, per_page: 20 },
      }).then((r) => r.data),
    enabled: can('shipments.view'),
  })

  const { data: accountTypes } = useQuery<PaginatedResponse<PostoneAccountType>>({
    queryKey: ['account-types-all'],
    queryFn: () => api.get('/account-types', { params: { per_page: 100 } }).then((r) => r.data),
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
          <h1 className="text-2xl font-bold text-slate-800">รายการพัสดุไปรษณีย์ (Postone Shipments Sync)</h1>
          <div className="relative group flex items-center">
            <Info className="w-4 h-4 text-slate-400 hover:text-slate-650 cursor-pointer transition-colors" />
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block w-64 bg-slate-900 text-slate-100 text-xs rounded-lg py-2 px-3 shadow-xl z-20 pointer-events-none border border-slate-800 text-center font-normal leading-normal">
              เป็นข้อมูลที่ดึงมาจากระบบไปรษณีย์ Postone
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
            </div>
          </div>
        </div>
        <p className="text-slate-500 text-sm mt-1">ทั้งหมด {data?.total ?? 0} รายการ</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Label ID, ชื่อลูกค้า, Tracking..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {/* <select
          value={channelFilter}
          onChange={(e) => { setChannelFilter(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">ทุก Channel</option>
          <option value="Online">Online</option>
          <option value="Offline">Offline</option>
        </select> */}
        <select
          value={accountTypeFilter}
          onChange={(e) => { setAccountTypeFilter(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">ทุก Account Type</option>
          {(accountTypes?.data ?? []).map((at) => (
            <option key={at.id} value={at.id}>{at.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">Due Date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-slate-400 text-sm">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Label ID</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Product Details</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600 min-w-[120px]">PI NO</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">SO NO</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">ลูกค้า</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Tracking</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600 min-w-[180px]">Channel</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Account Type</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">COD</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Export File Ref</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">สถานะล่าสุด</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">เวลากำหนดส่ง</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">อัปเดต</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  {[...Array(11)].map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-5 py-12 text-center text-slate-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.label_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs text-blue-600">{item.label_id}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-700 font-mono">{item.product_details ?? '—'}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-700 font-mono">{item.pi_number ?? '—'}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-700 font-mono">{item.so_number ?? '—'}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-800 truncate max-w-[150px]">{item.customer_name ?? '—'}</p>
                    {/* {item.so_number && <p className="text-xs text-slate-400 font-mono">{item.so_number}</p>} */}
                  </td>
                  <td className="px-5 py-4">
                    {item.tracking_no ? (
                      <span className="font-mono text-xs text-slate-700">{item.tracking_no}</span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-4">
                    {item.channel ? (
                      <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium', CHANNEL_COLORS[item.channel] ?? 'bg-slate-100 text-slate-600')}>
                        {item.channel}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-4 text-slate-600 text-xs">{item.account_type?.name ?? '—'}</td>
                  <td className="px-5 py-4 text-slate-700 text-xs font-medium">
                    {item.cod_amount ? `฿${item.cod_amount}` : '—'}
                  </td>
                  <td className="px-5 py-4">
                    {item.last_export_file_id != null ? (
                      <span className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded text-xs font-mono font-medium">#{item.last_export_file_id}</span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-4 text-slate-500 text-xs max-w-[160px] truncate">{item.latest_status ?? '—'}</td>
                  <td className="px-5 py-4 text-slate-500 text-xs max-w-[160px] truncate">{item.due_date ?? '—'}</td>
                  <td className="px-5 py-4 text-slate-400 text-xs">{fmtDate(item.updated_at)}</td>
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
