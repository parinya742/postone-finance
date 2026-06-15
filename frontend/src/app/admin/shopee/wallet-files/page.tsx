'use client'

import api from '@/lib/api'
import { ShopeeWalletFile, ShopeeShop, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Lock, FolderOpen, ExternalLink, FileText } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { dateStyle: 'short' })
}

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ShopeeWalletFilesPage() {
  const { can } = useAuth()
  const [page, setPage] = useState(1)
  const [shopName, setShopName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data: shopsData } = useQuery<PaginatedResponse<ShopeeShop>>({
    queryKey: ['shopee-shops-all'],
    queryFn: () => api.get('/shopee/shops', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('shopee-shops.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<ShopeeWalletFile>>({
    queryKey: ['shopee-wallet-files', page, shopName, startDate, endDate],
    queryFn: () =>
      api.get('/shopee/wallet-files', {
        params: {
          page,
          per_page: 50,
          shop_name: shopName || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
      }).then((r) => r.data),
    enabled: can('shopee-shops.view'),
  })

  if (!can('shopee-shops.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const items = data?.data ?? []
  const shops = shopsData?.data ?? []

  const resetFilters = () => {
    setShopName('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const hasFilter = !!(shopName || startDate || endDate)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FolderOpen className="w-6 h-6 text-orange-500" />
          <h1 className="text-2xl font-bold text-slate-800">ไฟล์ Shopee Wallet</h1>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} ไฟล์ · ไฟล์ Statement Wallet ที่นำเข้าผ่าน n8n
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
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
          title="ช่วงเริ่มต้น (range_from)"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="ช่วงสิ้นสุด (range_to)"
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

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ID</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ร้านค้า</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ช่วงเวลา</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">จำนวนแถว</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">S3 Key</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ดาวน์โหลด</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">นำเข้าเมื่อ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบไฟล์ Wallet
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">{item.id}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700">{item.shop_name ?? item.shop_id ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {fmtDate(item.range_from)} – {fmtDate(item.range_to)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-700 font-medium">
                      {item.row_count?.toLocaleString('th-TH') ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[250px] truncate font-mono" title={item.s3_key ?? ''}>
                      {item.s3_key ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.s3_url ? (
                        <a
                          href={item.s3_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 font-medium"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          เปิด
                        </a>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {fmtDateTime(item.created_at)}
                    </td>
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

      <p className="text-xs text-slate-400 flex items-center gap-1">
        <ExternalLink className="w-3.5 h-3.5" />
        ไฟล์ที่นำเข้าจาก Shopee Wallet Statement ผ่าน n8n และจัดเก็บใน S3
      </p>
    </div>
  )
}
