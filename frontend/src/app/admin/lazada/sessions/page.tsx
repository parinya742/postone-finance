'use client'

import api from '@/lib/api'
import { LazadaSession, AuditLog, PaginatedResponse } from '@/lib/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Plus, Pencil, Trash2, Search, Lock, X, Cookie,
  CheckCircle2, AlertTriangle, XCircle, ClipboardList, Eye, EyeOff, RefreshCw, Landmark,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

// ---- helpers ----

function StatusBadge({ session }: { session: LazadaSession }) {
  const daysAgo = session.days_ago

  if (session.status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Active{daysAgo !== null ? ` (${daysAgo} วันที่แล้ว)` : ''}
      </span>
    )
  }
  if (session.status === 'warning') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 text-yellow-700 rounded-full text-xs font-medium">
        <AlertTriangle className="w-3.5 h-3.5" />
        ใกล้หมดอายุ ({daysAgo} วัน)
      </span>
    )
  }
  if (session.status === 'expired') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-xs font-medium">
        <XCircle className="w-3.5 h-3.5" />
        หมดอายุแล้ว ({daysAgo} วัน)
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">
      ไม่ทราบ
    </span>
  )
}

// ---- Modal ----

const EMPTY_FORM = { seller_key: '', cookie: '' }

function SessionModal({
  item,
  shopKeys,
  onClose,
  onSuccess,
}: {
  item: LazadaSession | null
  shopKeys: Record<string, string>
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState(
    item ? { seller_key: item.seller_key, cookie: '' } : EMPTY_FORM
  )
  const [showCookie, setShowCookie] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const isEdit = !!item

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.seller_key.trim()) { setError('กรุณาระบุ Seller Key'); return }
    if (!isEdit && !form.cookie.trim()) { setError('กรุณาวาง Cookie'); return }
    if (isEdit && !form.cookie.trim()) {
      setError('กรุณาวาง Cookie ใหม่ (ต้อง update เสมอ)')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        await api.put(`/lazada/sessions/${item.id}`, {
          seller_key: form.seller_key,
          cookie: form.cookie,
        })
      } else {
        await api.post('/lazada/sessions', form)
      }
      onSuccess()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  const shopEntries = Object.entries(shopKeys)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-slate-800">
            {isEdit ? 'อัพเดท Cookie Session' : 'เพิ่ม Cookie Session'}
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Seller Key <span className="text-red-500">*</span>
            </label>
            {shopEntries.length > 0 ? (
              <select
                value={form.seller_key}
                onChange={(e) => setForm((f) => ({ ...f, seller_key: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                disabled={isEdit}
              >
                <option value="">— เลือกร้านค้า —</option>
                {shopEntries.map(([name, key]) => (
                  <option key={key} value={key}>{name} ({key})</option>
                ))}
              </select>
            ) : (
              <input
                value={form.seller_key}
                onChange={(e) => setForm((f) => ({ ...f, seller_key: e.target.value }))}
                disabled={isEdit}
                placeholder="เช่น TH1XRSBY"
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            )}
            <p className="text-xs text-slate-400 mt-1">ตรงกับ Short Code ของร้านค้า Lazada</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-700">
                Cookie <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowCookie((v) => !v)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
              >
                {showCookie ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showCookie ? 'ซ่อน' : 'แสดง'}
              </button>
            </div>
            <textarea
              value={form.cookie}
              onChange={(e) => setForm((f) => ({ ...f, cookie: e.target.value }))}
              rows={5}
              placeholder={
                isEdit
                  ? 'วาง Cookie ใหม่จาก browser เพื่ออัพเดท (จำเป็นต้องกรอก)'
                  : 'วาง Cookie ที่ copy จาก browser DevTools > Application > Cookies'
              }
              className={`w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none ${!showCookie ? 'text-transparent [text-shadow:0_0_8px_rgba(0,0,0,0.5)] select-none' : ''}`}
            />
            {form.cookie && (
              <p className="text-xs text-slate-400 mt-1">{form.cookie.length.toLocaleString()} ตัวอักษร</p>
            )}
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-700 space-y-1">
            <p className="font-semibold">วิธีก็อป Cookie จาก browser</p>
            <ol className="list-decimal list-inside space-y-0.5 text-orange-600">
              <li>เปิด Lazada Seller Center แล้วล็อกอิน</li>
              <li>กด F12 เปิด DevTools</li>
              <li>ไปที่ Application → Storage → Cookies → sellercentre.lazada.co.th</li>
              <li>คลิกขวาที่ Cookie list → Copy all as header value</li>
              <li>วางใน textarea ด้านบน</li>
            </ol>
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
              {saving ? 'กำลังบันทึก...' : isEdit ? 'อัพเดท Cookie' : 'บันทึก Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Page ----

export default function LazadaSessionsPage() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [editingItem, setEditingItem] = useState<LazadaSession | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading, refetch, isFetching } = useQuery<{ data: LazadaSession[]; total: number }>({
    queryKey: ['lazada-sessions', search],
    queryFn: () =>
      api.get('/lazada/sessions', { params: { search: search || undefined } }).then((r) => r.data),
    enabled: can('lazada-sessions.view'),
  })

  const { data: shopKeys } = useQuery<Record<string, string>>({
    queryKey: ['lazada-session-shop-keys'],
    queryFn: () => api.get('/lazada/sessions/shop-keys').then((r) => r.data),
    enabled: can('lazada-sessions.view'),
  })

  const { data: auditData, isLoading: auditLoading } = useQuery<PaginatedResponse<AuditLog>>({
    queryKey: ['lazada-session-audit'],
    queryFn: () =>
      api.get('/audit-logs', { params: { target_type: 'lazada_session', per_page: 30 } }).then((r) => r.data),
    enabled: can('lazada-sessions.view'),
  })

  const deleteItem = useMutation({
    mutationFn: (id: number) => api.delete(`/lazada/sessions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lazada-sessions'] })
      qc.invalidateQueries({ queryKey: ['lazada-session-audit'] })
    },
  })

  if (!can('lazada-sessions.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const items = data?.data ?? []
  const activeCount = items.filter((s) => s.status === 'active').length
  const warningCount = items.filter((s) => s.status === 'warning').length
  const expiredCount = items.filter((s) => s.status === 'expired').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Cookie className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-bold text-slate-800">จัดการเซสชั่น Lazada</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            ทั้งหมด {data?.total ?? 0} sessions ·
            <span className="text-green-600 ml-1">{activeCount} Active</span>
            {warningCount > 0 && <span className="text-yellow-600 ml-1">· {warningCount} ใกล้หมดอายุ</span>}
            {expiredCount > 0 && <span className="text-red-600 ml-1">· {expiredCount} หมดอายุ</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            รีเฟรช
          </button>
          {can('lazada-sessions.create') && (
            <button
              onClick={() => { setEditingItem(null); setShowForm(true) }}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              เพิ่ม Session
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Active</p>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">อัพเดทภายใน 7 วัน</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">ใกล้หมดอายุ</p>
          <p className="text-2xl font-bold text-yellow-600">{warningCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">7-14 วันที่ผ่านมา</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">หมดอายุ</p>
          <p className="text-2xl font-bold text-red-500">{expiredCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">มากกว่า 14 วัน</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหา Seller Key หรือชื่อร้านค้า..."
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">ร้านค้า</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Cookie Preview</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">ขนาด Cookie</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">สถานะ</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">อัพเดทล่าสุด</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(3)].map((_, i) => (
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
                    <Cookie className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ไม่พบ Session — กดปุ่ม &ldquo;เพิ่ม Session&rdquo; เพื่อเริ่มต้น
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${item.status === 'expired' ? 'bg-red-50/40' : item.status === 'warning' ? 'bg-yellow-50/30' : ''}`}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">
                        {item.shop_name ?? <span className="text-slate-400 italic text-xs">ไม่พบร้านค้า</span>}
                      </p>
                      <span className="font-mono text-xs text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                        {item.seller_key}
                      </span>
                      {item.bank_name_th && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                          <Landmark className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{item.bank_name_th}</span>
                          {item.bank_account_number && (
                            <span className="font-mono text-slate-400">· {item.bank_account_number}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-400 max-w-[200px] truncate">
                      {item.cookie_preview ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-center text-xs text-slate-500">
                      {item.cookie_length.toLocaleString()} chars
                    </td>
                    <td className="px-5 py-4 text-center">
                      <StatusBadge session={item} />
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {item.updated_at
                        ? new Date(item.updated_at).toLocaleString('th-TH', {
                            day: '2-digit', month: 'short', year: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {can('lazada-sessions.edit') && (
                          <button
                            onClick={() => { setEditingItem(item); setShowForm(true) }}
                            title="อัพเดท Cookie"
                            className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {can('lazada-sessions.delete') && (
                          <button
                            onClick={() => {
                              if (confirm(`ลบ Session "${item.seller_key}"?`)) {
                                deleteItem.mutate(item.id)
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700 space-y-1">
        <p className="font-semibold text-amber-800">หมายเหตุเกี่ยวกับ Cookie Session</p>
        <ul className="list-disc list-inside space-y-0.5 text-amber-600">
          <li>Cookie มีอายุประมาณ 7-14 วัน ต้องอัพเดทสม่ำเสมอ</li>
          <li>n8n workflows จะดึง Cookie จากตาราง <span className="font-mono bg-amber-100 px-1 rounded">lazada_session</span> โดยอ้างอิงจาก <span className="font-mono bg-amber-100 px-1 rounded">seller_key</span></li>
          <li>Seller Key ต้องตรงกับ Short Code ของร้านค้า Lazada</li>
          <li>ถ้า n8n ส่ง error เกี่ยวกับ authentication ให้ลอง refresh Cookie ก่อน</li>
        </ul>
      </div>

      {/* Audit Log */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <ClipboardList className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">ประวัติการแก้ไข Cookie Sessions</h2>
          <span className="ml-auto text-xs text-slate-400">{auditData?.total ?? 0} รายการล่าสุด</span>
        </div>
        <div className="divide-y divide-slate-50">
          {auditLoading ? (
            [...Array(3)].map((_, i) => (
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
                create: { label: 'สร้าง',        cls: 'bg-green-100 text-green-700' },
                update: { label: 'อัพเดท Cookie', cls: 'bg-blue-100 text-blue-700' },
                delete: { label: 'ลบ',            cls: 'bg-red-100 text-red-600' },
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
                    <span className="font-mono font-medium text-slate-700">{log.target_name}</span>
                    {payloadStr && (
                      <span className="ml-2 text-xs text-slate-400">{payloadStr}</span>
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

      {showForm && (
        <SessionModal
          item={editingItem}
          shopKeys={shopKeys ?? {}}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            qc.invalidateQueries({ queryKey: ['lazada-sessions'] })
            qc.invalidateQueries({ queryKey: ['lazada-session-audit'] })
          }}
        />
      )}
    </div>
  )
}
