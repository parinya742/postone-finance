'use client'

import api from '@/lib/api'
import { Permission } from '@/lib/types'
import { useMutation } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  permission: Permission | null
  onClose: () => void
  onSuccess: () => void
}

export default function PermissionFormModal({ permission, onClose, onSuccess }: Props) {
  const isEdit = !!permission
  const [name, setName] = useState(permission?.name ?? '')
  const [module, setModule] = useState(permission?.module ?? '')
  const [action, setAction] = useState(permission?.action ?? 'view')
  const [slug, setSlug] = useState(permission?.slug ?? '')
  const [description, setDescription] = useState(permission?.description ?? '')
  const [isActive, setIsActive] = useState(permission?.is_active ?? true)
  const [error, setError] = useState('')

  // Auto-generate slug when module or action changes (if not editing or if manually requested)
  useEffect(() => {
    if (!isEdit && module) {
      const sanitizedModule = module.toLowerCase().replace(/[^a-z0-9_-]/g, '')
      const sanitizedAction = action.toLowerCase().replace(/[^a-z0-9_-]/g, '')
      setSlug(`${sanitizedModule}.${sanitizedAction}`)
    }
  }, [module, action, isEdit])

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        slug,
        description,
        module: module.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
        action: action.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
        is_active: isActive,
      }
      return isEdit ? api.put(`/permissions/${permission.id}`, payload) : api.post('/permissions', payload)
    },
    onSuccess,
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    },
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'แก้ไข Permission' : 'เพิ่ม Permission ใหม่'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ Permission *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="เช่น View Thailand Post"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Module *</label>
              <input
                value={module}
                onChange={(e) => setModule(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="เช่น thaipost"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Action *</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="view">view</option>
                <option value="create">create</option>
                <option value="edit">edit</option>
                <option value="delete">delete</option>
                <option value="export">export</option>
                <option value="approve">approve</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Slug (สำหรับเทียบในโค้ด) *</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '.'))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono text-slate-600 bg-slate-50"
              placeholder="thaipost.view"
              required
            />
            <p className="text-[10px] text-slate-400 mt-1 font-mono">โครงสร้างรูปแบบแนะนำ: module.action</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">คำอธิบาย</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="รายละเอียดสิทธิ์การใช้งานนี้..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-violet-600 focus:ring-violet-500 border-slate-300 rounded"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-slate-700">เปิดใช้งาน</label>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            ยกเลิก
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !name || !module || !slug}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {save.isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึก' : 'สร้าง Permission'}
          </button>
        </div>
      </div>
    </div>
  )
}
