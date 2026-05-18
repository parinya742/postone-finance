'use client'

import api from '@/lib/api'
import { Role, Permission } from '@/lib/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Pencil, Trash2, ShieldCheck, Users, Lock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import RoleFormModal from '@/components/rbac/RoleFormModal'

export default function RolesPage() {
  const { can, hasRole } = useAuth()
  const qc = useQueryClient()
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((r) => r.data),
    enabled: can('roles.view'),
  })

  const { data: permData } = useQuery<{ data: Permission[] }>({
    queryKey: ['permissions'],
    queryFn: () => api.get('/permissions').then((r) => r.data),
    enabled: can('permissions.view'),
  })
  const allPermissions = permData?.data ?? []

  const deleteRole = useMutation({
    mutationFn: (id: number) => api.delete(`/roles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })

  if (!can('roles.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการ Roles</h1>
          <p className="text-gray-500 text-sm mt-1">กำหนดบทบาทและสิทธิ์การเข้าถึงระบบ</p>
        </div>
        {can('roles.create') && (
          <button
            onClick={() => { setEditingRole(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            เพิ่ม Role
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map((role) => (
            <div key={role.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: role.color + '20' }}>
                    <ShieldCheck className="w-5 h-5" style={{ color: role.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{role.name}</h3>
                    <code className="text-xs text-gray-400">{role.slug}</code>
                  </div>
                </div>
                <div className="flex gap-1">
                  {can('roles.edit') && (!role.is_system || hasRole('super_admin')) && (
                    <button
                      onClick={() => { setEditingRole(role); setShowForm(true) }}
                      className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {can('roles.edit') && (
                    <button
                      onClick={() => { setEditingRole(role); setShowForm(true) }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="แก้ไข Permissions"
                    >
                      <Lock className="w-4 h-4" />
                    </button>
                  )}
                  {can('roles.delete') && !role.is_system && (
                    <button
                      onClick={() => { if (confirm(`ลบ Role "${role.name}"?`)) deleteRole.mutate(role.id) }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-3 min-h-[2.5rem] line-clamp-2">{role.description ?? '—'}</p>

              <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-100 pt-3">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{role.users_count ?? 0} ผู้ใช้</span>
                <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5" />{role.permissions?.length ?? 0} permissions</span>
                <span
                  className="px-2 py-0.5 rounded-full text-white text-xs font-medium"
                  style={{ backgroundColor: role.color }}
                >
                  Level {role.level}
                </span>
              </div>

              {role.is_system && (
                <div className="mt-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">System Role — ลบไม่ได้</div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <RoleFormModal
          role={editingRole}
          allPermissions={allPermissions}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['roles'] }) }}
        />
      )}
    </div>
  )
}
