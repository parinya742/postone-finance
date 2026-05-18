'use client'

import api from '@/lib/api'
import { User, Role } from '@/lib/types'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  user: User | null
  allRoles: Role[]
  onClose: () => void
  onSuccess: () => void
}

export default function UserFormModal({ user, allRoles, onClose, onSuccess }: Props) {
  const isEdit = !!user
  const [name, setName] = useState(user?.name ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [status, setStatus] = useState<User['status']>(user?.status ?? 'active')
  const [selectedRoles, setSelectedRoles] = useState<number[]>(user?.roles?.map((r) => r.id) ?? [])
  const [error, setError] = useState('')

  const toggleRole = (id: number) =>
    setSelectedRoles((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = { name, username, email, status, role_ids: selectedRoles }
      if (password) { payload.password = password; payload.password_confirmation = passwordConfirmation }
      return isEdit ? api.put(`/users/${user.id}`, payload) : api.post('/users', { ...payload, password_confirmation: passwordConfirmation })
    },
    onSuccess,
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
      if (data?.errors) {
        setError(Object.values(data.errors).flat().join(' '))
      } else {
        setError(data?.message ?? 'เกิดข้อผิดพลาด')
      }
    },
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ *</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isEdit ? 'รหัสผ่านใหม่ (ถ้าต้องการเปลี่ยน)' : 'รหัสผ่าน *'}
              </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ยืนยันรหัสผ่าน</label>
              <input type="password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as User['status'])}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Roles ({selectedRoles.length} เลือกแล้ว)
            </label>
            <div className="space-y-2 border border-gray-200 rounded-lg p-3">
              {allRoles.map((role) => (
                <label key={role.id} className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => toggleRole(role.id)}
                    className={clsx(
                      'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                      selectedRoles.includes(role.id) ? 'border-violet-600 bg-violet-600' : 'border-gray-300'
                    )}
                  >
                    {selectedRoles.includes(role.id) && <div className="w-2 h-2 bg-white rounded-sm" />}
                  </div>
                  <div className="flex items-center gap-2 flex-1" onClick={() => toggleRole(role.id)}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">{role.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">Level {role.level}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            ยกเลิก
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !name || !email || (!isEdit && !password)}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {save.isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึก' : 'สร้างผู้ใช้'}
          </button>
        </div>
      </div>
    </div>
  )
}
