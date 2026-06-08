'use client'

import api from '@/lib/api'
import { SpecialPostalZone, PaginatedResponse } from '@/lib/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Pencil, Trash2, Search, Lock, MapPin, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const EMPTY_FORM = {
  seq: '',
  area_group: '',
  province: '',
  office_name: '',
  postal_code: '',
  area_description: '',
  rate: '20',
}

function ZoneModal({
  item,
  onClose,
  onSuccess,
}: {
  item: SpecialPostalZone | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState(
    item
      ? {
          seq: String(item.seq),
          area_group: String(item.area_group),
          province: item.province,
          office_name: item.office_name,
          postal_code: item.postal_code,
          area_description: item.area_description ?? '',
          rate: String(item.rate),
        }
      : EMPTY_FORM
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        seq: Number(form.seq),
        area_group: Number(form.area_group),
        province: form.province,
        office_name: form.office_name,
        postal_code: form.postal_code,
        area_description: form.area_description || null,
        rate: Number(form.rate),
      }
      if (item) {
        await api.put(`/special-postal-zones/${item.id}`, payload)
      } else {
        await api.post('/special-postal-zones', payload)
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">
            {item ? 'แก้ไขพื้นที่พิเศษ' : 'เพิ่มพื้นที่พิเศษ'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">ลำดับ <span className="text-red-500">*</span></label>
              <input type="number" value={form.seq} onChange={set('seq')} required
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">กลุ่มพื้นที่ <span className="text-red-500">*</span></label>
              <input type="number" value={form.area_group} onChange={set('area_group')} required
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">จังหวัด <span className="text-red-500">*</span></label>
              <input value={form.province} onChange={set('province')} required maxLength={100}
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="เช่น ชลบุรี" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">ชื่อที่ทำการ <span className="text-red-500">*</span></label>
              <input value={form.office_name} onChange={set('office_name')} required maxLength={100}
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="เช่น เกาะสีชัง" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">รหัสไปรษณีย์ <span className="text-red-500">*</span></label>
              <input value={form.postal_code} onChange={set('postal_code')} required maxLength={5}
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="เช่น 20120" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">อัตรา (บาท) <span className="text-red-500">*</span></label>
              <input type="number" step="0.01" value={form.rate} onChange={set('rate')} required
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">พื้นที่</label>
            <input value={form.area_description} onChange={set('area_description')} maxLength={200}
              className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="เช่น เฉพาะเกาะล้าน / ทุกพื้นที่ของรหัสไปรษณีย์" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-slate-300 rounded-lg py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SpecialPostalZonesPage() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editingItem, setEditingItem] = useState<SpecialPostalZone | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading } = useQuery<PaginatedResponse<SpecialPostalZone>>({
    queryKey: ['special-postal-zones', search, page],
    queryFn: () =>
      api.get('/special-postal-zones', { params: { search, page, per_page: 20 } }).then((r) => r.data),
    enabled: can('special-zones.view'),
  })

  const deleteItem = useMutation({
    mutationFn: (id: number) => api.delete(`/special-postal-zones/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['special-postal-zones'] }),
  })

  if (!can('special-zones.view')) {
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
          <h1 className="text-2xl font-bold text-slate-800">พื้นที่ไปรษณีย์พิเศษ</h1>
          <p className="text-slate-500 text-sm mt-1">
            ทั้งหมด {data?.total?.toLocaleString('th-TH') ?? 0} รายการ · รหัสไปรษณีย์ที่มีอัตราพิเศษ
          </p>
        </div>
        {can('special-zones.create') && (
          <button
            onClick={() => { setEditingItem(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            เพิ่มพื้นที่
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="จังหวัด, ชื่อที่ทำการ, รหัสไปรษณีย์..."
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-center px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ลำดับ</th>
              <th className="text-center px-4 py-3 font-medium text-slate-600 whitespace-nowrap">กลุ่ม</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">จังหวัด</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">ชื่อที่ทำการ</th>
              <th className="text-center px-4 py-3 font-medium text-slate-600 whitespace-nowrap">รหัสไปรษณีย์</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">พื้นที่</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">อัตรา</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {[...Array(8)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-center text-xs text-slate-500">{item.seq}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold">
                      {item.area_group}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{item.province}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium whitespace-nowrap">{item.office_name}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-blue-700 bg-blue-50/40">{item.postal_code}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">
                    {item.area_description ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {Number(item.rate).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {can('special-zones.edit') && (
                        <button
                          onClick={() => { setEditingItem(item); setShowForm(true) }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {can('special-zones.delete') && (
                        <button
                          onClick={() => {
                            if (confirm(`ลบ "${item.office_name} (${item.postal_code})"?`)) {
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

      {showForm && (
        <ZoneModal
          item={editingItem}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['special-postal-zones'] }) }}
        />
      )}
    </div>
  )
}
