'use client'

import api from '@/lib/api'
import { Permission, Role } from '@/lib/types'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  role: Role | null
  allPermissions: Permission[]
  onClose: () => void
  onSuccess: () => void
}

const COLORS = ['#DC2626', '#7C3AED', '#2563EB', '#059669', '#D97706', '#DB2777', '#6B7280']

export default function RoleFormModal({ role, allPermissions, onClose, onSuccess }: Props) {
  const isEdit = !!role
  const [name, setName] = useState(role?.name ?? '')
  const [slug, setSlug] = useState(role?.slug ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [level, setLevel] = useState(role?.level ?? 5)
  const [color, setColor] = useState(role?.color ?? '#6B7280')
  const [isActive, setIsActive] = useState(role?.is_active ?? true)
  const [selectedPerms, setSelectedPerms] = useState<number[]>(
    role?.permissions?.map((p) => p.id) ?? []
  )
  const [error, setError] = useState('')

  const grouped = allPermissions.reduce<Record<string, Permission[]>>((acc, p) => {
    acc[p.module] = [...(acc[p.module] ?? []), p]
    return acc
  }, {})

  const togglePerm = (id: number) =>
    setSelectedPerms((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const toggleModule = (perms: Permission[]) => {
    const ids = perms.map((p) => p.id)
    const allSelected = ids.every((id) => selectedPerms.includes(id))
    setSelectedPerms((prev) =>
      allSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]
    )
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = { name, slug, description, level, color, is_active: isActive, permission_ids: selectedPerms }
      return isEdit ? api.put(`/roles/${role.id}`, payload) : api.post('/roles', payload)
    },
    onSuccess,
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'เกิดข้อผิดพลาด')
    },
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'แก้ไข Role' : 'เพิ่ม Role ใหม่'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ Role *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="เช่น Finance Manager"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                disabled={role?.is_system}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50 disabled:text-gray-400"
                placeholder="finance_manager"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Level (1=สูงสุด)</label>
              <input
                type="number" min={1} max={99}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">สี</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={clsx('w-7 h-7 rounded-full border-2 transition-transform', color === c ? 'border-gray-900 scale-110' : 'border-transparent')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 text-violet-600" />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">เปิดใช้งาน</label>
          </div>

          {allPermissions.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">
                Permissions ({selectedPerms.length}/{allPermissions.length} เลือกแล้ว)
              </p>
              <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {Object.entries(grouped).map(([module, perms]) => {
                  const allSel = perms.every((p) => selectedPerms.includes(p.id))
                  const someSel = perms.some((p) => selectedPerms.includes(p.id))
                  return (
                    <div key={module}>
                      <div
                        className="flex items-center gap-2 mb-1.5 cursor-pointer"
                        onClick={() => toggleModule(perms)}
                      >
                        <div className={clsx(
                          'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                          allSel ? 'bg-violet-600 border-violet-600' : someSel ? 'bg-violet-200 border-violet-400' : 'border-gray-300'
                        )}>
                          {(allSel || someSel) && <div className="w-2 h-2 bg-white rounded-sm" />}
                        </div>
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          {module.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 ml-6">
                        {perms.map((perm) => (
                          <button
                            key={perm.id}
                            onClick={() => togglePerm(perm.id)}
                            className={clsx(
                              'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                              selectedPerms.includes(perm.id)
                                ? 'bg-violet-600 border-violet-600 text-white'
                                : 'border-gray-300 text-gray-600 hover:border-violet-400'
                            )}
                          >
                            {perm.action}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            ยกเลิก
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !name || !slug}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {save.isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึก' : 'สร้าง Role'}
          </button>
        </div>
      </div>
    </div>
  )
}
