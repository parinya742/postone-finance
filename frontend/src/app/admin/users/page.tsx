'use client'

import api from '@/lib/api'
import { User, Role, PaginatedResponse } from '@/lib/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Pencil, Trash2, Search, Lock, UserCheck, UserX } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import UserFormModal from '@/components/rbac/UserFormModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import clsx from 'clsx'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  suspended: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'ใช้งาน',
  inactive: 'ปิดใช้งาน',
  suspended: 'ระงับ',
  pending: 'รอดำเนินการ',
}

export default function UsersPage() {
  const { can } = useAuth()
  const { addToast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)

  const { data, isLoading } = useQuery<PaginatedResponse<User>>({
    queryKey: ['users', search, statusFilter, page],
    queryFn: () =>
      api.get('/users', { params: { search, status: statusFilter, page, per_page: 12 } }).then((r) => r.data),
    enabled: can('users.view'),
  })

  const { data: rolesData } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((r) => r.data),
    enabled: can('roles.view'),
  })

  const deleteUser = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      addToast('ลบผู้ใช้สำเร็จ', 'success')
    },
    onError: () => addToast('ลบผู้ใช้ไม่สำเร็จ', 'error'),
  })

  if (!can('users.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const users = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการผู้ใช้</h1>
          <p className="text-gray-500 text-sm mt-1">ทั้งหมด {data?.total ?? 0} ผู้ใช้</p>
        </div>
        {can('users.create') && (
          <button
            onClick={() => { setEditingUser(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            เพิ่มผู้ใช้
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="ค้นหาชื่อ, อีเมล..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">ทุกสถานะ</option>
          <option value="active">ใช้งาน</option>
          <option value="inactive">ปิดใช้งาน</option>
          <option value="suspended">ระงับ</option>
          <option value="pending">รอดำเนินการ</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-600">ผู้ใช้</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Roles</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">สถานะ</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">เข้าสู่ระบบล่าสุด</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(5)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-gray-400">ไม่พบผู้ใช้</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-gray-400 text-xs">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {user.roles?.map((role) => (
                        <span
                          key={role.id}
                          className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: role.color }}
                        >
                          {role.name}
                        </span>
                      ))}
                      {(!user.roles || user.roles.length === 0) && (
                        <span className="text-gray-400 text-xs">ไม่มี Role</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium', STATUS_COLORS[user.status])}>
                      {STATUS_LABELS[user.status] ?? user.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-400 text-xs">
                    {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString('th-TH') : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {can('users.edit') && (
                        <button
                          onClick={() => { setEditingUser(user); setShowForm(true) }}
                          className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {can('users.delete') && (
                        <button
                          onClick={() => setDeletingUser(user)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>หน้า {data.current_page} จาก {data.last_page}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                ก่อนหน้า
              </button>
              <button
                disabled={page === data.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <UserFormModal
          user={editingUser}
          allRoles={rolesData ?? []}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            qc.invalidateQueries({ queryKey: ['users'] })
            addToast(editingUser ? 'แก้ไขผู้ใช้สำเร็จ' : 'เพิ่มผู้ใช้สำเร็จ', 'success')
          }}
        />
      )}

      {deletingUser && (
        <ConfirmModal
          title="ลบผู้ใช้"
          message={`คุณต้องการลบผู้ใช้ "${deletingUser.name}" ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`}
          confirmLabel="ลบ"
          danger
          onConfirm={() => { deleteUser.mutate(deletingUser.id); setDeletingUser(null) }}
          onCancel={() => setDeletingUser(null)}
        />
      )}
    </div>
  )
}
