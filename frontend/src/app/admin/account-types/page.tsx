'use client'

import api from '@/lib/api'
import { PostoneAccountType, PaginatedResponse } from '@/lib/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Pencil, Trash2, Search, Lock, Tag, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  Inactive: 'bg-gray-100 text-gray-500',
}

function AccountTypeModal({
  item,
  onClose,
  onSuccess,
}: {
  item: PostoneAccountType | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    name: item?.name ?? '',
    status: item?.status ?? 'Active',
    description: item?.description ?? '',
    shop_id: item?.shop_id?.toString() ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, shop_id: form.shop_id ? Number(form.shop_id) : null }
      if (item) {
        await api.put(`/account-types/${item.id}`, payload)
      } else {
        await api.post('/account-types', payload)
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{item ? 'แก้ไข Account Type' : 'เพิ่ม Account Type'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">ชื่อ <span className="text-red-500">*</span></label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ชื่อ Account Type"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">สถานะ</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Shop ID</label>
            <input
              type="number"
              value={form.shop_id}
              onChange={(e) => setForm({ ...form, shop_id: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="เช่น 36598"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">คำอธิบาย</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="คำอธิบายเพิ่มเติม (ถ้ามี)"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 rounded-lg py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AccountTypesPage() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [editingItem, setEditingItem] = useState<PostoneAccountType | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading } = useQuery<PaginatedResponse<PostoneAccountType>>({
    queryKey: ['account-types', search, statusFilter, page],
    queryFn: () =>
      api.get('/account-types', { params: { search, status: statusFilter, page, per_page: 15 } }).then((r) => r.data),
    enabled: can('account-types.view'),
  })

  const deleteItem = useMutation({
    mutationFn: (id: number) => api.delete(`/account-types/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-types'] }),
  })

  if (!can('account-types.view')) {
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
          <h1 className="text-2xl font-bold text-slate-800">จัดการแอคเคาท์ไปรษณีย์ (Account Types)</h1>
          <p className="text-slate-500 text-sm mt-1">ทั้งหมด {data?.total ?? 0} รายการ</p>
        </div>
        {can('account-types.create') && (
          <button
            onClick={() => { setEditingItem(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            เพิ่ม Account Type
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="ค้นหาชื่อ, คำอธิบาย..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">ทุกสถานะ</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-slate-600">ID</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">ชื่อ</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Shop ID</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">สถานะ</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">คำอธิบาย</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                  <Tag className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 text-slate-400 text-xs font-mono">{item.id}</td>
                  <td className="px-5 py-4 font-medium text-slate-800">{item.name}</td>
                  <td className="px-5 py-4 text-slate-500 font-mono text-xs">{item.shop_id ?? '—'}</td>
                  <td className="px-5 py-4">
                    <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium', STATUS_COLORS[item.status] ?? 'bg-slate-100 text-slate-600')}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-500 text-xs max-w-xs truncate">{item.description ?? '—'}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {can('account-types.edit') && (
                        <button
                          onClick={() => { setEditingItem(item); setShowForm(true) }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {can('account-types.delete') && (
                        <button
                          onClick={() => { if (confirm(`ลบ "${item.name}"?`)) deleteItem.mutate(item.id) }}
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

        {data && data.last_page > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <span>หน้า {data.current_page} จาก {data.last_page}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50">ก่อนหน้า</button>
              <button disabled={page === data.last_page} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50">ถัดไป</button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <AccountTypeModal
          item={editingItem}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['account-types'] }) }}
        />
      )}
    </div>
  )
}
