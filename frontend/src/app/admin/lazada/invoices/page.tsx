'use client'

import api from '@/lib/api'
import { LazadaInvoices, LazadaShop, PaginatedResponse } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, Lock, FileText, ExternalLink } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const INVOICE_TYPE_COLORS: Record<string, string> = {
  Invoice: 'bg-blue-100 text-blue-700',
  Receipt: 'bg-green-100 text-green-700',
  'Credit Note': 'bg-yellow-100 text-yellow-700',
}

export default function LazadaInvoicesPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [shopName, setShopName] = useState('')
  const [invoiceType, setInvoiceType] = useState('')
  const [provider, setProvider] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data: shopsData } = useQuery<PaginatedResponse<LazadaShop>>({
    queryKey: ['lazada-shops-all'],
    queryFn: () => api.get('/lazada/shops', { params: { per_page: 100, is_active: true } }).then((r) => r.data),
    enabled: can('lazada-invoices.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<LazadaInvoices>>({
    queryKey: ['lazada-invoices', search, page, shopName, invoiceType, provider, startDate, endDate],
    queryFn: () =>
      api.get('/lazada/invoices', {
        params: {
          search: search || undefined,
          page,
          per_page: 50,
          shop_name: shopName || undefined,
          invoice_type: invoiceType || undefined,
          provider: provider || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
      }).then((r) => r.data),
    enabled: can('lazada-invoices.view'),
  })

  if (!can('lazada-invoices.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const items = data?.data ?? []
  const shops = shopsData?.data ?? []
  const hasFilter = !!(search || shopName || invoiceType || provider || startDate || endDate)

  const resetFilters = () => {
    setSearch('')
    setShopName('')
    setInvoiceType('')
    setProvider('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-orange-500" />
          <h1 className="text-2xl font-bold text-slate-800">ใบแจ้งหนี้ Lazada</h1>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} รายการ
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="เลขที่ใบแจ้งหนี้..."
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
            <option key={s.id} value={s.shop_name}>{s.shop_name}</option>
          ))}
        </select>

        <input
          value={invoiceType}
          onChange={(e) => { setInvoiceType(e.target.value); setPage(1) }}
          placeholder="ประเภทใบแจ้งหนี้"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 min-w-[160px]"
        />

        <input
          value={provider}
          onChange={(e) => { setProvider(e.target.value); setPage(1) }}
          placeholder="Provider"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 min-w-[140px]"
        />

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
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">วันที่ใบแจ้งหนี้</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ร้านค้า</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">เลขที่ใบแจ้งหนี้</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ประเภท</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Provider</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">งวด</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
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
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบใบแจ้งหนี้
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDate(item.invoice_date)}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">{item.shop_name ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{item.invoice_no}</td>
                    <td className="px-4 py-3">
                      {item.invoice_type ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_TYPE_COLORS[item.invoice_type] ?? 'bg-slate-100 text-slate-600'}`}>
                          {item.invoice_type}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{item.provider ?? '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{item.invoice_period ?? '—'}</td>
                    <td className="px-4 py-3">
                      {item.s3_url && (
                        <a
                          href={item.s3_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors inline-flex"
                          title="เปิดไฟล์ PDF"
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
        ข้อมูลดึงจาก Lazada Invoice API · PDF เก็บใน S3
      </p>
    </div>
  )
}
