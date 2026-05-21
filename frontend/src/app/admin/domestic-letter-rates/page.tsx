'use client'

import api from '@/lib/api'
import { DomesticLetterRate, DomesticLetterRatesResponse } from '@/lib/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Lock, Package, X, Save } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const EMPTY_FORM = { weight: '', rate: '' }

function RateModal({
  item,
  onClose,
  onSuccess,
}: {
  item: DomesticLetterRate | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState(
    item ? { weight: String(item.weight), rate: String(item.rate) } : EMPTY_FORM
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { weight: Number(form.weight), rate: Number(form.rate) }
      if (item) {
        await api.put(`/domestic-letter-rates/${item.id}`, payload)
      } else {
        await api.post('/domestic-letter-rates', payload)
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">
            {item ? 'แก้ไขอัตราจดหมาย' : 'เพิ่มอัตราจดหมาย'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              น้ำหนัก <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.weight}
              onChange={set('weight')}
              required
              className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="เช่น 0.01, 0.5, 1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              อัตรา (บาท) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.rate}
              onChange={set('rate')}
              required
              className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="เช่น 18, 24, 30"
            />
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

export default function DomesticLetterRatesPage() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const [editingItem, setEditingItem] = useState<DomesticLetterRate | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [offsetInput, setOffsetInput] = useState('0')
  const [offsetSaving, setOffsetSaving] = useState(false)
  const [offsetSaved, setOffsetSaved] = useState(false)

  const { data, isLoading } = useQuery<DomesticLetterRatesResponse>({
    queryKey: ['domestic-letter-rates'],
    queryFn: () => api.get('/domestic-letter-rates').then((r) => r.data),
    enabled: can('domestic-letter-rates.view'),
  })

  useEffect(() => {
    if (data?.offset !== undefined) {
      setOffsetInput(String(data.offset))
    }
  }, [data?.offset])

  const deleteItem = useMutation({
    mutationFn: (id: number) => api.delete(`/domestic-letter-rates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domestic-letter-rates'] }),
  })

  const handleSaveOffset = async () => {
    setOffsetSaving(true)
    try {
      await api.put('/domestic-letter-rates/offset', { offset: Number(offsetInput) })
      qc.invalidateQueries({ queryKey: ['domestic-letter-rates'] })
      setOffsetSaved(true)
      setTimeout(() => setOffsetSaved(false), 2000)
    } catch {
      // ignore
    } finally {
      setOffsetSaving(false)
    }
  }

  if (!can('domestic-letter-rates.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const rates = data?.data ?? []
  const offset = Number(offsetInput) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">อัตราค่าขนส่งจดหมายในประเทศ - ซอง</h1>
          <p className="text-slate-500 text-sm mt-1">
            ทั้งหมด {rates.length} รายการ · ตารางอัตราค่าขนส่งจดหมายในประเทศตามน้ำหนัก
          </p>
        </div>
        {can('domestic-letter-rates.create') && (
          <button
            onClick={() => { setEditingItem(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            เพิ่มอัตรา
          </button>
        )}
      </div>

      {/* Offset / Input control */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-yellow-800">Input (ส่วนเพิ่ม)</p>
          <p className="text-xs text-yellow-600 mt-0.5">
            ค่านี้จะถูกบวกเพิ่มเข้ากับทุกอัตราเสมอ เมื่อนำไปคำนวณค่าขนส่ง
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="1"
            value={offsetInput}
            onChange={(e) => setOffsetInput(e.target.value)}
            disabled={!can('domestic-letter-rates.edit')}
            className="w-28 border border-yellow-300 bg-white rounded-lg px-3 py-2 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-50"
          />
          {can('domestic-letter-rates.edit') && (
            <button
              onClick={handleSaveOffset}
              disabled={offsetSaving}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                offsetSaved
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-yellow-500 hover:bg-yellow-600 text-white'
              } disabled:opacity-60`}
            >
              <Save className="w-3.5 h-3.5" />
              {offsetSaved ? 'บันทึกแล้ว' : offsetSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-center px-4 py-3 font-medium text-slate-600 whitespace-nowrap w-16">#</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">น้ำหนัก (กิโลกรัม)</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">อัตราฐาน (บาท)</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">
                อัตรารวม (+ Input {offset !== 0 ? (offset > 0 ? `+${offset}` : offset) : '0'})
              </th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i}>
                  {[...Array(5)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              rates.map((item, idx) => {
                const displayRate = Number(item.rate) + offset 
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-center text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                      {Number(item.weight).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {Number(item.rate).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-semibold ${offset !== 0 ? 'text-blue-700' : 'text-slate-800'}`}>
                        {displayRate.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {can('domestic-letter-rates.edit') && (
                          <button
                            onClick={() => { setEditingItem(item); setShowForm(true) }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {can('domestic-letter-rates.delete') && (
                          <button
                            onClick={() => {
                              if (confirm(`ลบอัตราน้ำหนัก ${item.weight}?`)) {
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
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <RateModal
          item={editingItem}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['domestic-letter-rates'] }) }}
        />
      )}
    </div>
  )
}