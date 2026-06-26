'use client'

import api from '@/lib/api'
import { ShopeeShop, AuditLog, PaginatedResponse } from '@/lib/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, useEffect } from 'react'
import {
  Plus, Pencil, Trash2, Search, Lock, Store, X,
  Eye, EyeOff, CheckCircle2, XCircle, KeyRound, ExternalLink, RefreshCw,
  ClipboardList,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const EMPTY_FORM = {
  shop_name: '',
  access_token: '',
  refresh_token: '',
}

function ShopModal({
  item,
  partnerId,
  onClose,
  onSuccess,
}: {
  item: ShopeeShop | null
  partnerId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState(
    item
      ? {
          shop_name: item.shop_name ?? '',
          access_token: item.access_token ?? '',
          refresh_token: item.refresh_token ?? '',
        }
      : EMPTY_FORM
  )
  const [showToken, setShowToken] = useState(false)
  const [showRefresh, setShowRefresh] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (item) {
        await api.put(`/shopee/shops/${item.shop_id}`, {
          shop_name: form.shop_name || null,
          access_token: form.access_token || null,
          refresh_token: form.refresh_token || null,
        })
      } else {
        await api.post('/shopee/shops', {
          shop_name: form.shop_name || null,
        })
      }
      onSuccess()
    } catch (err: unknown) {
      if (!mountedRef.current) return
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'เกิดข้อผิดพลาด')
    } finally {
      if (mountedRef.current) setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-slate-800">
            {item ? 'แก้ไขร้านค้า Shopee' : 'เพิ่มร้านค้า Shopee'}
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

          <div className="space-y-4">
            {item && (
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">Shop ID</label>
                <input
                  value={item.shop_id}
                  disabled
                  readOnly
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm font-mono bg-slate-50 text-slate-500 cursor-not-allowed"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">ชื่อร้านค้า</label>
              <input
                value={form.shop_name}
                onChange={set('shop_name')}
                maxLength={255}
                placeholder="เช่น My Shopee Shop"
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              {!item && (
                <p className="mt-1 text-xs text-slate-400">Shop ID จะได้รับอัตโนมัติหลังจาก Authorize กับ Shopee</p>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">API Credentials</p>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1.5">Partner ID</label>
              <input
                value={partnerId || 'ยังไม่ได้ตั้งค่า SHOPEE_PARTNER_ID'}
                disabled
                readOnly
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm font-mono bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          {item && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Tokens (แก้ไขด้วยตนเอง)</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Access Token</label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={form.access_token}
                      onChange={set('access_token')}
                      placeholder="ว่างไว้ = ไม่เปลี่ยน"
                      className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button type="button" onClick={() => setShowToken((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
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
                      placeholder="ว่างไว้ = ไม่เปลี่ยน"
                      className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button type="button" onClick={() => setShowRefresh((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showRefresh ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

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

export default function ShopeeShopsPage() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editingItem, setEditingItem] = useState<ShopeeShop | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [authUrlLoading, setAuthUrlLoading] = useState<string | null>(null)
  const [codeModal, setCodeModal] = useState<{ shopId: string; shopName: string } | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeExchanging, setCodeExchanging] = useState(false)
  const [codeError, setCodeError] = useState('')

  const { data: authConfig } = useQuery<{ partner_id: string }>({
    queryKey: ['shopee-auth-config'],
    queryFn: () => api.get('/shopee/auth-config').then((r) => r.data),
    enabled: can('shopee-shops.view'),
  })

  const { data, isLoading } = useQuery<PaginatedResponse<ShopeeShop>>({
    queryKey: ['shopee-shops', search, page],
    queryFn: () =>
      api.get('/shopee/shops', { params: { search, page, per_page: 50 } }).then((r) => r.data),
    enabled: can('shopee-shops.view'),
  })

  const { data: auditData, isLoading: auditLoading } = useQuery<PaginatedResponse<AuditLog>>({
    queryKey: ['shopee-shop-audit'],
    queryFn: () => api.get('/audit-logs', { params: { target_type: 'shopee_shop', per_page: 30 } }).then((r) => r.data),
    enabled: can('shopee-shops.view'),
  })

  const deleteItem = useMutation({
    mutationFn: (shopId: string) => api.delete(`/shopee/shops/${shopId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopee-shops'] })
      qc.invalidateQueries({ queryKey: ['shopee-shop-audit'] })
    },
  })

  const refreshToken = useMutation({
    mutationFn: (shopId: string) => api.post(`/shopee/shops/${shopId}/refresh-token`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopee-shops'] })
      qc.invalidateQueries({ queryKey: ['shopee-shop-audit'] })
    },
  })

  const handleGetAuthUrl = async (item: ShopeeShop) => {
    setAuthUrlLoading(item.shop_id)
    try {
      const res = await api.get(`/shopee/shops/${item.shop_id}/auth-url`)
      window.open(res.data.url, '_blank')
      setCodeInput('')
      setCodeError('')
      setCodeModal({ shopId: item.shop_id, shopName: item.shop_name ?? `Shop #${item.shop_id}` })
    } catch {
      alert('ไม่สามารถสร้าง URL ได้ กรุณาตรวจสอบ SHOPEE_PARTNER_ID และ SHOPEE_PARTNER_KEY ใน .env')
    } finally {
      setAuthUrlLoading(null)
    }
  }

  const handleExchangeCode = async () => {
    if (!codeModal || !codeInput.trim()) return
    setCodeExchanging(true)
    setCodeError('')
    try {
      await api.post(`/shopee/shops/${codeModal.shopId}/exchange-token`, { code: codeInput.trim() })
      setCodeModal(null)
      qc.invalidateQueries({ queryKey: ['shopee-shops'] })
      qc.invalidateQueries({ queryKey: ['shopee-shop-audit'] })
    } catch (err: unknown) {
      const shopeeErr = (err as { response?: { data?: { shopee_error?: { message?: string; error?: string }; message?: string } } })?.response?.data
      setCodeError(shopeeErr?.shopee_error?.message ?? shopeeErr?.shopee_error?.error ?? shopeeErr?.message ?? 'เกิดข้อผิดพลาด')
    } finally {
      setCodeExchanging(false)
    }
  }

  if (!can('shopee-shops.view')) {
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
            <h1 className="text-2xl font-bold text-slate-800">ร้านค้า Shopee</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            ทั้งหมด {data?.total ?? 0} ร้านค้า · n8n จะ Sync เฉพาะร้านที่มี Access Token
          </p>
        </div>
        {can('shopee-shops.create') && (
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
          placeholder="ชื่อร้าน, Shop ID..."
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">ชื่อร้านค้า</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Shop ID</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Access Token</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Refresh Token</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">อัปเดตล่าสุด</th>
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
                items.map((item) => {
                  const isPending = item.shop_id.startsWith('PENDING_')
                  const hasToken = !!item.access_token && !isPending
                  const hasRefresh = !!item.refresh_token && !isPending
                  const updatedAt = item.updated_at
                    ? new Date(item.updated_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
                    : '—'

                  return (
                    <tr key={item.shop_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">{item.shop_name ?? '—'}</p>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-600">
                        {isPending ? (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium">รอ Token</span>
                        ) : item.shop_id}
                      </td>

                      <td className="px-5 py-4 text-center">
                        {!hasToken ? (
                          can('shopee-shops.edit') ? (
                            <button
                              onClick={() => handleGetAuthUrl(item)}
                              disabled={authUrlLoading === item.shop_id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-full text-xs font-medium transition-colors"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              {authUrlLoading === item.shop_id ? 'กำลังโหลด...' : 'ขอ Token'}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-xs font-medium">
                              <XCircle className="w-3.5 h-3.5" />
                              ไม่มี Token
                            </span>
                          )
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              มี Token
                            </span>
                            {can('shopee-shops.edit') && (
                              <button
                                onClick={() => refreshToken.mutate(item.shop_id)}
                                disabled={refreshToken.isPending}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-600 rounded text-[11px] font-medium transition-colors"
                              >
                                <RefreshCw className="w-3 h-3" />
                                Refresh
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-center">
                        {hasRefresh ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            มี
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-500">{updatedAt}</td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {can('shopee-shops.edit') && (
                            <button
                              onClick={() => { setEditingItem(item); setShowForm(true) }}
                              className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {can('shopee-shops.delete') && (
                            <button
                              onClick={() => {
                                if (confirm(`ลบร้านค้า "${item.shop_name ?? item.shop_id}"? ข้อมูลจะถูกลบถาวรและ n8n จะหยุด Sync ร้านนี้`)) {
                                  deleteItem.mutate(item.shop_id)
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
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
            <span>หน้า {data.current_page} จาก {data.last_page} (ทั้งหมด {data.total} รายการ)</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50">ก่อนหน้า</button>
              <button disabled={page === data.last_page} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50">ถัดไป</button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <ExternalLink className="w-3.5 h-3.5" />
        กดปุ่ม &ldquo;ขอ Token&rdquo; เพื่อ Authorize กับ Shopee · หน้า Shopee จะเปิดใน tab ใหม่ แล้วนำ code กลับมาวางที่นี่
      </p>

      {codeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">วาง Authorization Code</h2>
              <button onClick={() => setCodeModal(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                ร้านค้า: <span className="font-semibold text-slate-800">{codeModal.shopName}</span>
              </p>
              <ol className="text-sm text-slate-500 space-y-1 list-decimal list-inside">
                <li>Authorize บน Shopee ใน tab ที่เปิดใหม่</li>
                <li>หลัง authorize สำเร็จ copy <span className="font-mono bg-slate-100 px-1 rounded">code=...</span> จาก URL ที่ redirect มา</li>
                <li>วาง code ด้านล่าง แล้วกด &ldquo;บันทึก Token&rdquo;</li>
              </ol>
              {codeError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{codeError}</div>
              )}
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="วาง code ที่ได้จาก URL ที่นี่"
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setCodeModal(null)}
                  className="flex-1 border border-slate-300 rounded-lg py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleExchangeCode}
                  disabled={codeExchanging || !codeInput.trim()}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors"
                >
                  {codeExchanging ? 'กำลังบันทึก...' : 'บันทึก Token'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <ShopModal
          item={editingItem}
          partnerId={authConfig?.partner_id ?? ''}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            qc.invalidateQueries({ queryKey: ['shopee-shops'] })
            qc.invalidateQueries({ queryKey: ['shopee-shop-audit'] })
          }}
        />
      )}

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <ClipboardList className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">ประวัติการแก้ไขร้านค้า Shopee</h2>
          <span className="ml-auto text-xs text-slate-400">{auditData?.total ?? 0} รายการล่าสุด</span>
        </div>
        <div className="divide-y divide-slate-50">
          {auditLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="px-5 py-3 flex gap-3">
                <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 flex-1 bg-slate-100 rounded animate-pulse" />
              </div>
            ))
          ) : !auditData?.data.length ? (
            <p className="px-5 py-6 text-sm text-center text-slate-400">ยังไม่มีประวัติ</p>
          ) : (
            auditData.data.map((log) => {
              const ACTION_LABEL: Record<string, { label: string; cls: string }> = {
                create:         { label: 'สร้าง',          cls: 'bg-green-100 text-green-700' },
                update:         { label: 'แก้ไข',          cls: 'bg-blue-100 text-blue-700' },
                delete:         { label: 'ลบ',             cls: 'bg-red-100 text-red-600' },
                exchange_token: { label: 'ขอ Token ใหม่',  cls: 'bg-orange-100 text-orange-700' },
                refresh_token:  { label: 'Refresh Token',  cls: 'bg-purple-100 text-purple-700' },
              }
              const a = ACTION_LABEL[log.action] ?? { label: log.action, cls: 'bg-slate-100 text-slate-600' }
              const dt = new Date(log.created_at).toLocaleString('th-TH', {
                day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
              })
              const payloadStr = log.payload
                ? Object.entries(log.payload)
                    .filter(([, v]) => v != null)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ')
                : null

              return (
                <div key={log.id} className="px-5 py-2.5 flex items-start gap-3 text-sm hover:bg-slate-50">
                  <span className={`mt-0.5 shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${a.cls}`}>
                    {a.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-700">{log.target_name}</span>
                    {payloadStr && (
                      <span className="ml-2 text-xs text-slate-400 truncate">{payloadStr}</span>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-400 leading-5">
                    <p className="font-medium text-slate-600">{log.user_name}</p>
                    <p>{dt}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
