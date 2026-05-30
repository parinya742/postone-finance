'use client'

import api from '@/lib/api'
import { LazadaShop, PaginatedResponse } from '@/lib/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Pencil, Trash2, Search, Lock, Store, X, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const EMPTY_FORM = {
  shop_name: '',
  app_key: '',
  app_secret: '',
  access_token: '',
  refresh_token: '',
  seller_id: '',
  short_code: '',
}

function ShopModal({
  item,
  onClose,
  onSuccess,
}: {
  item: LazadaShop | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState(
    item
      ? {
          shop_name: item.shop_name,
          app_key: item.app_key,
          app_secret: item.app_secret,
          access_token: item.access_token ?? '',
          refresh_token: item.refresh_token ?? '',
          seller_id: item.seller_id,
          short_code: item.short_code,
        }
      : EMPTY_FORM
  )
  const [showSecret, setShowSecret] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [showRefresh, setShowRefresh] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        access_token: form.access_token || null,
        refresh_token: form.refresh_token || null,
      }
      if (item) {
        await api.put(`/lazada/shops/${item.id}`, payload)
      } else {
        await api.post('/lazada/shops', payload)
      }
      onSuccess()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-slate-800">
            {item ? 'แก้ไขร้านค้า Lazada' : 'เพิ่มร้านค้า Lazada'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                ชื่อร้านค้า <span className="text-red-500">*</span>
              </label>
              <input
                value={form.shop_name}
                onChange={set('shop_name')}
                required
                maxLength={100}
                placeholder="เช่น My Lazada Shop"
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Seller ID <span className="text-red-500">*</span>
              </label>
              <input
                value={form.seller_id}
                onChange={set('seller_id')}
                required
                maxLength={50}
                placeholder="เช่น 24147"
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Short Code <span className="text-red-500">*</span>
              </label>
              <input
                value={form.short_code}
                onChange={set('short_code')}
                required
                maxLength={50}
                placeholder="เช่น shop1"
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">API Credentials</p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  App Key <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.app_key}
                  onChange={set('app_key')}
                  required
                  maxLength={255}
                  placeholder="Lazada App Key"
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  App Secret <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={form.app_secret}
                    onChange={set('app_secret')}
                    required
                    maxLength={255}
                    placeholder="Lazada App Secret"
                    className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Access Token</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={form.access_token}
                    onChange={set('access_token')}
                    maxLength={2000}
                    placeholder="Access Token (อัปเดตอัตโนมัติจาก n8n)"
                    className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Refresh Token</label>
                <div className="relative">
                  <input
                    type={showRefresh ? 'text' : 'password'}
                    value={form.refresh_token}
                    onChange={set('refresh_token')}
                    maxLength={2000}
                    placeholder="Refresh Token (อัปเดตอัตโนมัติจาก n8n)"
                    className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRefresh((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showRefresh ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-300 rounded-lg py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LazadaShopsPage() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editingItem, setEditingItem] = useState<LazadaShop | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading } = useQuery<PaginatedResponse<LazadaShop>>({
    queryKey: ['lazada-shops', search, page],
    queryFn: () =>
      api.get('/lazada/shops', { params: { search, page, per_page: 50 } }).then((r) => r.data),
    enabled: can('lazada-shops.view'),
  })

  const deleteItem = useMutation({
    mutationFn: (id: number) => api.delete(`/lazada/shops/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lazada-shops'] }),
  })

  if (!can('lazada-shops.view')) {
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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Store className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-bold text-slate-800">ร้านค้า Lazada</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            ทั้งหมด {data?.total ?? 0} ร้านค้า · n8n จะดึงข้อมูลอัตโนมัติสำหรับทุกร้านที่มี Access Token
          </p>
        </div>
        {can('lazada-shops.create') && (
          <button
            onClick={() => { setEditingItem(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            เพิ่มร้านค้า
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="ชื่อร้าน, Seller ID, Short Code..."
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-slate-600">ชื่อร้านค้า</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Seller ID</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Short Code</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">App Key</th>
              <th className="text-center px-5 py-3 font-medium text-slate-600">Access Token</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                  <Store className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบร้านค้า — กดปุ่ม &ldquo;เพิ่มร้านค้า&rdquo; เพื่อเริ่มต้น
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-800">{item.shop_name}</p>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-600">{item.seller_id}</td>
                  <td className="px-5 py-4">
                    <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs font-mono font-medium">
                      {item.short_code}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">
                    {item.app_key.length > 16
                      ? `${item.app_key.slice(0, 8)}...${item.app_key.slice(-4)}`
                      : item.app_key}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {item.access_token ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        มี Token
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-xs font-medium">
                        <XCircle className="w-3.5 h-3.5" />
                        ไม่มี Token
                      </span>
                    )}
                  </td>
                  {/* <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {can('lazada-shops.edit') && (
                        <button
                          onClick={() => { setEditingItem(item); setShowForm(true) }}
                          className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {can('lazada-shops.delete') && (
                        <button
                          onClick={() => {
                            if (confirm(`ลบร้านค้า "${item.shop_name}"? โฟลว์ n8n จะไม่ดึงข้อมูลร้านนี้อีกต่อไป`)) {
                              deleteItem.mutate(item.id)
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td> */}
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

      {showForm && (
        <ShopModal
          item={editingItem}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['lazada-shops'] }) }}
        />
      )}
    </div>
  )
}
