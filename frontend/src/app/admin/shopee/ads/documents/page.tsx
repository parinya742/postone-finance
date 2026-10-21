'use client'

import api from '@/lib/api'
import { ShopeeAdsTransactionRow, ShopeeShop, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { Search, Lock, FileText, Download, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import * as XLSX from 'xlsx'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtAmount(n: string | number | null) {
  if (n == null) return '—'
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (Number.isNaN(num)) return '—'
  return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ShopeeAdsDocumentsPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [shopName, setShopName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exporting, setExporting] = useState(false)

  const { data: shopsData } = useQuery<PaginatedResponse<ShopeeShop>>({
    queryKey: ['shopee-shops-all'],
    queryFn: () => api.get('/shopee/shops', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: can('shopee-ads.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<ShopeeAdsTransactionRow>>({
    queryKey: ['shopee-ads-transactions-all', search, page, shopName, startDate, endDate],
    queryFn: () =>
      api.get('/shopee/ads-transactions', {
        params: {
          search: search || undefined,
          page,
          per_page: 50,
          shop_name: shopName || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
      }).then((r) => r.data),
    enabled: can('shopee-ads.view'),
  })

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get('/shopee/ads-transactions', {
        params: {
          search: search || undefined,
          per_page: 50000,
          shop_name: shopName || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
      })
      const fetchItems: ShopeeAdsTransactionRow[] = res.data?.data ?? []
      if (fetchItems.length === 0) {
        alert('ไม่พบข้อมูลสำหรับส่งออก')
        return
      }

      const rows = fetchItems.map((item) => ({
        'วันที่': fmtDate(item.txn_date),
        'ร้านค้า': item.shop_name ?? item.shop_id ?? '',
        'ไฟล์ต้นทาง': item.file_name ?? '',
        'ประเภท': item.txn_type ?? '',
        'หมายเหตุ': item.remark ?? '',
        'จำนวนเงิน': typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount ?? '',
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 40 }, { wch: 30 }, { wch: 24 }, { wch: 14 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Shopee Ads Documents')

      const dateStr = new Date().toISOString().slice(0, 10)
      const filename = `shopee-ads-documents-${dateStr}.xlsx`
      XLSX.writeFile(wb, filename)

      api.post('/audit-logs', {
        action: 'export',
        target_type: 'shopee-ads-documents',
        target_id: 0,
        target_name: filename,
        payload: {
          row_count: fetchItems.length,
          filters: {
            search: search || null,
            shop_name: shopName || null,
            start_date: startDate || null,
            end_date: endDate || null,
          },
        },
      }).catch(() => {})
    } catch (err) {
      console.error('Export failed:', err)
      alert('เกิดข้อผิดพลาดในการส่งออก')
    } finally {
      setExporting(false)
    }
  }

  if (!can('shopee-ads.view')) {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/shopee/ads"
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-orange-600 mb-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            กลับไปหน้าไฟล์ค่าใช้จ่ายโฆษณา
          </Link>
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-bold text-slate-800">เอกสารค่าใช้จ่ายโฆษณา Shopee</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} รายการ (รวมทุกไฟล์)
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'กำลังส่งออก...' : 'Export Excel'}
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="ร้านค้า, ประเภท, หมายเหตุ..."
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
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">วันที่</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ร้านค้า</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ไฟล์ต้นทาง</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ประเภท</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">หมายเหตุ</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบเอกสาร
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const amount = typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDate(item.txn_date)}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-700">{item.shop_name ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-[220px]">{item.file_name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{item.txn_type ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{item.remark ?? '—'}</td>
                      <td className={clsx('px-4 py-3 text-right font-mono text-sm whitespace-nowrap', amount < 0 ? 'text-red-600' : 'text-green-600')}>
                        {amount < 0 ? '-' : '+'}{fmtAmount(Math.abs(amount))}
                      </td>
                    </tr>
                  )
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
    </div>
  )
}
