'use client'

import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import EdiTablePage, { EdiColumn, formatDateTime } from '@/components/pc-tracking/EdiTablePage'
import { PcShopPkCustomer, PcShopPkCustomerOptions, PcShopPkCustomerStatus } from '@/lib/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { apiErrorMessage } from '../parse-result'

const inputCls =
  'w-full border border-[#89919A] rounded px-3 py-2 text-sm text-[#32363A] placeholder:text-[#9EA1A4] focus:outline-none focus:border-[#0070F2] focus:ring-1 focus:ring-[#0070F2] bg-white'
const labelCls = 'block text-xs font-medium text-[#32363A] mb-1'
const btnPrimary = 'inline-flex items-center gap-1.5 bg-[#0070F2] hover:bg-[#0064D9] disabled:opacity-60 text-white px-3.5 py-2 rounded text-sm font-medium transition-colors'
const btnGhost = 'inline-flex items-center gap-1.5 border border-[#89919A] text-[#32363A] hover:bg-[#F5F5F5] disabled:opacity-60 px-3.5 py-2 rounded text-sm font-medium transition-colors'

const STATUS: Record<PcShopPkCustomerStatus, { label: string; cls: string }> = {
  active: { label: 'ใช้งาน', cls: 'bg-[#F1FDF6] text-[#256F3A]' },
  inactive: { label: 'เลิกใช้', cls: 'bg-[#F5F5F5] text-[#6A6D70]' },
  suspended: { label: 'ระงับชั่วคราว', cls: 'bg-[#FEF7F1] text-[#C44500]' },
}

function StatusBadge({ value }: { value: PcShopPkCustomerStatus }) {
  const s = STATUS[value] ?? { label: value, cls: 'bg-[#F5F5F5] text-[#6A6D70]' }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${s.cls}`}>{s.label}</span>
}

type FormState = {
  customer_code: string
  customer_name: string
  customer_status: PcShopPkCustomerStatus
  customer_type: string
  group_id: string
  note: string
}

const EMPTY_FORM: FormState = { customer_code: '', customer_name: '', customer_status: 'active', customer_type: '', group_id: '', note: '' }

function CustomerModal({ item, onClose, onSaved }: { item: PcShopPkCustomer | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(
    item
      ? {
          customer_code: item.customer_code,
          customer_name: item.customer_name,
          customer_status: item.customer_status,
          customer_type: item.customer_type ?? '',
          group_id: item.group_id ?? '',
          note: item.note ?? '',
        }
      : EMPTY_FORM,
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: options } = useQuery<PcShopPkCustomerOptions>({
    queryKey: ['pc-shop-pk-customer-options'],
    queryFn: () => api.get('/pc-shop-pk/customers/options').then((r) => r.data),
  })

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const pickGroup = (groupId: string) => {
    const g = options?.groups.find((x) => x.group_id === groupId)
    setForm((f) => ({
      ...f,
      group_id: groupId,
      // new customer without a name yet → borrow the LINE group name
      customer_name: !f.customer_name.trim() && g?.group_name ? g.group_name : f.customer_name,
    }))
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = { ...form, customer_type: form.customer_type || null, group_id: form.group_id || null, note: form.note || null }
    try {
      if (item) await api.put(`/pc-shop-pk/customers/${item.id}`, payload)
      else await api.post('/pc-shop-pk/customers', payload)
      onSaved()
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded shadow-2xl w-full max-w-xl my-8">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#EBEBEB]">
          <h2 className="font-semibold text-[#32363A]">{item ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้า'}</h2>
          <button onClick={onClose} className="p-1.5 rounded text-[#6A6D70] hover:bg-[#F5F5F5]"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="p-3 bg-[#FFEAF4] border border-[#F5B0C7] text-[#AA0808] text-sm rounded">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4">
            <div>
              <label className={labelCls}>รหัสลูกค้า *</label>
              <input className={`${inputCls} font-mono`} value={form.customer_code} onChange={(e) => set('customer_code', e.target.value)} maxLength={50} required />
            </div>
            <div>
              <label className={labelCls}>ชื่อลูกค้า *</label>
              <input className={inputCls} value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} maxLength={255} required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>สถานะลูกค้า *</label>
              <select className={inputCls} value={form.customer_status} onChange={(e) => set('customer_status', e.target.value as PcShopPkCustomerStatus)}>
                {(Object.keys(STATUS) as PcShopPkCustomerStatus[]).map((k) => (
                  <option key={k} value={k}>{STATUS[k].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>ประเภทลูกค้า</label>
              <input
                className={inputCls}
                list="pc-shop-pk-customer-types"
                value={form.customer_type}
                onChange={(e) => set('customer_type', e.target.value)}
                maxLength={50}
                placeholder="เลือกหรือพิมพ์ใหม่"
              />
              <datalist id="pc-shop-pk-customer-types">
                {options?.types.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
          </div>

          <div>
            <label className={labelCls}>กลุ่ม LINE</label>
            <select className={inputCls} value={form.group_id} onChange={(e) => pickGroup(e.target.value)}>
              <option value="">— ไม่ผูกกลุ่ม —</option>
              {options?.groups.map((g) => {
                const takenByOther = g.customer_id !== null && g.customer_id !== item?.id
                return (
                  <option key={g.group_id} value={g.group_id} disabled={takenByOther}>
                    {g.group_name ?? '(ไม่มีชื่อ)'} · {g.group_id.slice(0, 10)}…{takenByOther ? ` — ผูกกับ ${g.customer_code} แล้ว` : ''}
                  </option>
                )
              })}
            </select>
            <p className="text-[11px] text-[#6A6D70] mt-1">1 กลุ่มผูกได้กับลูกค้า 1 ราย · กลุ่มจะขึ้นในรายการเมื่อบอทได้รับข้อความจากกลุ่มนั้นแล้ว</p>
          </div>

          <div>
            <label className={labelCls}>หมายเหตุ</label>
            <textarea rows={2} className={inputCls} value={form.note} onChange={(e) => set('note', e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={btnGhost}>ยกเลิก</button>
            <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PcShopPkCustomersPage() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const canEdit = can('pc-shop-pk-customers.edit')
  const [editing, setEditing] = useState<PcShopPkCustomer | 'new' | null>(null)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['pc-tracking'] })
    qc.invalidateQueries({ queryKey: ['pc-shop-pk-customer-options'] })
    qc.invalidateQueries({ queryKey: ['pc-shop-pk-group-options'] })
  }

  const remove = async (c: PcShopPkCustomer) => {
    if (!confirm(`ลบลูกค้า ${c.customer_code} · ${c.customer_name}?\n(ถ้าเลิกค้าขาย แนะนำให้เปลี่ยนสถานะเป็น "เลิกใช้" แทน)`)) return
    try {
      await api.delete(`/pc-shop-pk/customers/${c.id}`)
      refresh()
    } catch (err) {
      alert(apiErrorMessage(err))
    }
  }

  const columns: EdiColumn<PcShopPkCustomer>[] = [
    { label: 'รหัสลูกค้า', render: (r) => r.customer_code, className: 'font-mono text-xs text-[#0070F2] whitespace-nowrap' },
    { label: 'ชื่อลูกค้า', render: (r) => r.customer_name, className: 'text-sm text-[#32363A] whitespace-nowrap' },
    { label: 'สถานะ', render: (r) => <StatusBadge value={r.customer_status} /> },
    { label: 'ประเภท', render: (r) => r.customer_type },
    {
      label: 'กลุ่ม LINE',
      render: (r) =>
        r.group_id ? (
          <div>
            <div className="text-xs text-[#32363A]">{r.group_name ?? '(ไม่มีชื่อ)'}</div>
            <div className="font-mono text-[11px] text-[#6A6D70]">{r.group_id}</div>
          </div>
        ) : (
          <span className="text-xs text-[#9EA1A4] italic">ไม่ได้ผูกกลุ่ม</span>
        ),
      className: 'whitespace-nowrap',
    },
    { label: 'ข้อความล่าสุด', render: (r) => (r.last_message_at ? formatDateTime(r.last_message_at) : null), className: 'text-xs text-[#6A6D70] whitespace-nowrap' },
    { label: 'หมายเหตุ', render: (r) => r.note, className: 'text-xs text-[#6A6D70] min-w-[120px] max-w-[260px]' },
    ...(canEdit
      ? [{
          label: 'จัดการ',
          render: (r: PcShopPkCustomer) => (
            <div className="flex gap-1">
              <button onClick={() => setEditing(r)} title="แก้ไข" className="p-1.5 rounded text-[#0070F2] hover:bg-[#EBF5FF]"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(r)} title="ลบ" className="p-1.5 rounded text-[#AA0808] hover:bg-[#FFF5F5]"><Trash2 className="w-4 h-4" /></button>
            </div>
          ),
        }]
      : []),
  ]

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button onClick={() => setEditing('new')} className={btnPrimary}><Plus className="w-4 h-4" /> เพิ่มลูกค้า</button>
        </div>
      )}

      <EdiTablePage<PcShopPkCustomer>
        permission="pc-shop-pk-customers.view"
        title="ลูกค้า"
        subtitle="PC SHOP PK · customers ↔ line_groups (group_id)"
        endpoint="/pc-shop-pk/customers"
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="รหัส, ชื่อลูกค้า, ประเภท, กลุ่ม LINE..."
        selectFilters={[
          {
            param: 'customer_status',
            placeholder: 'ทุกสถานะ',
            options: (Object.keys(STATUS) as PcShopPkCustomerStatus[]).map((k) => ({ value: k, label: STATUS[k].label })),
          },
          {
            param: 'linked',
            placeholder: 'ผูกกลุ่ม: ทั้งหมด',
            options: [{ value: '1', label: 'ผูกกลุ่ม LINE แล้ว' }, { value: '0', label: 'ยังไม่ผูกกลุ่ม' }],
          },
        ]}
      />

      {editing && (
        <CustomerModal
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh() }}
        />
      )}
    </div>
  )
}
