'use client'

import api from '@/lib/api'
import { Permission } from '@/lib/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Lock, Pencil, Trash2, Plus, Search } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import clsx from 'clsx'
import PermissionFormModal from '@/components/rbac/PermissionFormModal'
import ConfirmModal from '@/components/ui/ConfirmModal'

const ACTION_COLORS: Record<string, string> = {
  view: 'bg-blue-100 text-blue-700',
  create: 'bg-green-100 text-green-700',
  edit: 'bg-yellow-100 text-yellow-700',
  delete: 'bg-red-100 text-red-700',
  export: 'bg-purple-100 text-purple-700',
  approve: 'bg-orange-100 text-orange-700',
}

export default function PermissionsPage() {
  const { can } = useAuth()
  const { addToast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null)
  const [deletingPermission, setDeletingPermission] = useState<Permission | null>(null)

  const { data, isLoading } = useQuery<{ data: Permission[]; grouped: { module: string; permissions: Permission[] }[]; modules: string[] }>({
    queryKey: ['permissions', search, moduleFilter],
    queryFn: () => api.get('/permissions', { params: { search, module: moduleFilter } }).then((r) => r.data),
    enabled: can('permissions.view'),
  })

  const deletePermission = useMutation({
    mutationFn: (id: number) => api.delete(`/permissions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions'] })
      addToast('ลบ Permission สำเร็จ', 'success')
    },
    onError: () => addToast('ลบ Permission ไม่สำเร็จ', 'error'),
  })

  if (!can('permissions.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const handleOpenAdd = () => {
    setSelectedPermission(null)
    setShowModal(true)
  }

  const handleOpenEdit = (perm: Permission) => {
    setSelectedPermission(perm)
    setShowModal(true)
  }

  const handleSuccess = () => {
    setShowModal(false)
    const isEdit = !!selectedPermission
    setSelectedPermission(null)
    qc.invalidateQueries({ queryKey: ['permissions'] })
    addToast(isEdit ? 'แก้ไข Permission สำเร็จ' : 'เพิ่ม Permission สำเร็จ', 'success')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการ Permissions</h1>
          <p className="text-gray-500 text-sm mt-1">ทั้งหมด {data?.data.length ?? 0} permissions</p>
        </div>
        {can('permissions.create') && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            เพิ่ม Permission
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">ทุก Module</option>
          {data?.modules.map((m) => (
            <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {(data?.grouped ?? []).map(({ module, permissions }) => (
            <div key={module} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-700 uppercase text-sm tracking-wide">
                  {module.replace(/_/g, ' ')}
                </h3>
                <span className="text-xs text-gray-400">{permissions.length} permissions</span>
              </div>
              <div className="divide-y divide-gray-50">
                {permissions.map((perm) => (
                  <div key={perm.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-medium w-16 text-center', ACTION_COLORS[perm.action] ?? 'bg-gray-100 text-gray-600')}>
                        {perm.action}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{perm.name}</p>
                        <code className="text-xs text-gray-400">{perm.slug}</code>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={clsx('w-2 h-2 rounded-full', perm.is_active ? 'bg-green-500' : 'bg-gray-300')} />
                      {can('permissions.edit') && (
                        <button
                          onClick={() => handleOpenEdit(perm)}
                          className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors ml-2"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {can('permissions.delete') && (
                        <button
                          onClick={() => setDeletingPermission(perm)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <PermissionFormModal
          permission={selectedPermission}
          onClose={() => { setShowModal(false); setSelectedPermission(null) }}
          onSuccess={handleSuccess}
        />
      )}

      {deletingPermission && (
        <ConfirmModal
          title="ลบ Permission"
          message={`คุณต้องการลบ Permission "${deletingPermission.name}" ใช่หรือไม่?`}
          confirmLabel="ลบ"
          danger
          onConfirm={() => { deletePermission.mutate(deletingPermission.id); setDeletingPermission(null) }}
          onCancel={() => setDeletingPermission(null)}
        />
      )}
    </div>
  )
}
