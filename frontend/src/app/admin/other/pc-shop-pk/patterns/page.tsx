'use client'

import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime } from '@/components/pc-tracking/EdiTablePage'
import { PcShopPkParseRow, PcShopPkPattern, PcShopPkPatternMode } from '@/lib/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Lock, Plus, Pencil, Trash2, X, FlaskConical, Regex, Database } from 'lucide-react'
import { FIELD_HELP, ParseResultTable, apiErrorMessage } from '../parse-result'

const inputCls =
  'w-full border border-[#89919A] rounded px-3 py-2 text-sm text-[#32363A] placeholder:text-[#9EA1A4] focus:outline-none focus:border-[#0070F2] focus:ring-1 focus:ring-[#0070F2] bg-white'
const labelCls = 'block text-xs font-medium text-[#32363A] mb-1'
const btnPrimary = 'inline-flex items-center gap-1.5 bg-[#0070F2] hover:bg-[#0064D9] disabled:opacity-60 text-white px-3.5 py-2 rounded text-sm font-medium transition-colors'
const btnGhost = 'inline-flex items-center gap-1.5 border border-[#89919A] text-[#32363A] hover:bg-[#F5F5F5] disabled:opacity-60 px-3.5 py-2 rounded text-sm font-medium transition-colors'

type PatternsResponse = { data: PcShopPkPattern[]; fields: string[] }
type TestResponse = { data: PcShopPkParseRow[]; compiled: { regex: string; fields: string[] } | null }

type FormState = {
  name: string
  mode: PcShopPkPatternMode
  template: string
  regex: string
  fields: string
  prefix: string
  group_ids: string
  default_qty: string
  default_price: string
  priority: string
  is_active: boolean
  note: string
}

const EMPTY_FORM: FormState = {
  name: '', mode: 'template', template: '', regex: '', fields: '', prefix: '', group_ids: '',
  default_qty: '', default_price: '', priority: '100', is_active: true, note: '',
}

function toForm(p: PcShopPkPattern): FormState {
  const d: { qty?: string; price?: string } = Array.isArray(p.defaults) ? {} : p.defaults
  return {
    name: p.name,
    mode: p.mode,
    template: p.template ?? '',
    regex: p.mode === 'regex' ? p.regex : '',
    fields: p.mode === 'regex' ? p.fields.join(', ') : '',
    prefix: p.prefix ?? '',
    group_ids: p.group_ids.join('\n'),
    default_qty: d.qty ?? '',
    default_price: d.price ?? '',
    priority: String(p.priority),
    is_active: p.is_active,
    note: p.note ?? '',
  }
}

function toPayload(f: FormState) {
  return {
    name: f.name,
    mode: f.mode,
    template: f.mode === 'template' ? f.template : null,
    regex: f.mode === 'regex' ? f.regex : null,
    fields: f.mode === 'regex' ? f.fields : null,
    prefix: f.prefix || null,
    group_ids: f.group_ids.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
    defaults: { qty: f.default_qty, price: f.default_price },
    priority: Number(f.priority || 0),
    is_active: f.is_active,
    note: f.note || null,
  }
}

function PatternModal({ item, onClose, onSaved }: { item: PcShopPkPattern | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(item ? toForm(item) : EMPTY_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [sample, setSample] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResponse | null>(null)
  const [testError, setTestError] = useState('')

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const insertField = (key: string) => set('template', `${form.template}{${key}}`)

  const runTest = async () => {
    setTesting(true)
    setTestError('')
    try {
      const res = await api.post<TestResponse>('/pc-shop-pk/patterns/test', {
        text: sample,
        pattern: { ...toPayload(form), id: item?.id },
      })
      setTestResult(res.data)
    } catch (err) {
      setTestResult(null)
      setTestError(apiErrorMessage(err))
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (item) await api.put(`/pc-shop-pk/patterns/${item.id}`, toPayload(form))
      else await api.post('/pc-shop-pk/patterns', toPayload(form))
      onSaved()
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded shadow-2xl w-full max-w-3xl my-8">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#EBEBEB]">
          <h2 className="font-semibold text-[#32363A]">{item ? 'แก้ไขรูปแบบข้อความ' : 'เพิ่มรูปแบบข้อความ'}</h2>
          <button onClick={onClose} className="p-1.5 rounded text-[#6A6D70] hover:bg-[#F5F5F5]"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="p-3 bg-[#FFEAF4] border border-[#F5B0C7] text-[#AA0808] text-sm rounded">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
            <div>
              <label className={labelCls}>ชื่อรูปแบบ *</label>
              <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={100} placeholder="เช่น แบบมีสาขา" />
            </div>
            <div>
              <label className={labelCls}>ลำดับ (น้อย = ลองก่อน)</label>
              <input type="number" min={0} max={9999} className={inputCls} value={form.priority} onChange={(e) => set('priority', e.target.value)} />
            </div>
          </div>

          <div className="flex gap-1 border-b border-[#E8E8E8]">
            {([['template', 'แบบง่าย (Template)'], ['regex', 'ขั้นสูง (Regex)']] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => set('mode', m)}
                className={`py-1.5 px-3 text-xs font-semibold border-b-2 -mb-px ${form.mode === m ? 'text-[#0070F2] border-[#0070F2]' : 'text-[#6A6D70] border-transparent hover:text-[#32363A]'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {form.mode === 'template' ? (
            <div className="space-y-2">
              <label className={labelCls}>รูปแบบข้อความ *</label>
              <input
                className={`${inputCls} font-mono`}
                value={form.template}
                onChange={(e) => set('template', e.target.value)}
                placeholder="{sku}/{qty}/{price}"
                maxLength={300}
              />
              <div className="flex flex-wrap gap-1.5">
                {FIELD_HELP.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => insertField(f.key)}
                    title={f.hint}
                    className="px-2 py-1 rounded border border-[#D9D9D9] bg-[#F5F6F7] hover:bg-[#EBF5FE] hover:border-[#0070F2] text-xs"
                  >
                    <span className="font-mono text-[#0070F2]">{`{${f.key}}`}</span> <span className="text-[#6A6D70]">{f.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#6A6D70] leading-relaxed">
                คลิกเพื่อแทรกช่อง แล้วพิมพ์ตัวคั่นเอง (เช่น <code>/</code> <code>x</code> <code>@</code> เว้นวรรค) · เว้นวรรครอบตัวคั่นพิมพ์หรือไม่พิมพ์ก็ได้ ·
                ช่องชื่ออื่น เช่น <code>{'{color}'}</code> จะเก็บไว้ในข้อมูลเพิ่มเติม
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3">
              <div>
                <label className={labelCls}>Regex (PostgreSQL, ไม่สนตัวพิมพ์เล็ก/ใหญ่) *</label>
                <textarea rows={2} className={`${inputCls} font-mono`} value={form.regex} onChange={(e) => set('regex', e.target.value)} placeholder="^(\w+)\s*-\s*(\d+)$" />
              </div>
              <div>
                <label className={labelCls}>ชื่อช่องตามลำดับกลุ่ม *</label>
                <input className={`${inputCls} font-mono`} value={form.fields} onChange={(e) => set('fields', e.target.value)} placeholder="sku, qty" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Prefix ขึ้นต้นบรรทัด</label>
              <input className={`${inputCls} font-mono`} value={form.prefix} onChange={(e) => set('prefix', e.target.value)} maxLength={10} placeholder="ไม่บังคับ เช่น #" />
            </div>
            <div>
              <label className={labelCls}>จำนวนเริ่มต้น</label>
              <input type="number" min={0} step="any" className={inputCls} value={form.default_qty} onChange={(e) => set('default_qty', e.target.value)} placeholder="1" />
            </div>
            <div>
              <label className={labelCls}>ราคาเริ่มต้น</label>
              <input type="number" min={0} step="any" className={inputCls} value={form.default_price} onChange={(e) => set('default_price', e.target.value)} placeholder="ว่าง" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-[#32363A] pb-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="w-4 h-4 accent-[#0070F2]" />
                เปิดใช้งาน
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>ใช้เฉพาะกลุ่ม (Group ID บรรทัดละ 1 · ว่าง = ทุกแชท)</label>
              <textarea rows={2} className={`${inputCls} font-mono text-xs`} value={form.group_ids} onChange={(e) => set('group_ids', e.target.value)} placeholder="Cxxxxxxxx..." />
            </div>
            <div>
              <label className={labelCls}>หมายเหตุ</label>
              <textarea rows={2} className={inputCls} value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={500} />
            </div>
          </div>

          {/* Test box — runs the unsaved form values through the same DB parser the bot uses */}
          <div className="border border-[#D1E8FF] bg-[#F5FAFF] rounded p-3 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#0070F2]">
              <FlaskConical className="w-3.5 h-3.5" /> ทดลองกับรูปแบบนี้ (ยังไม่ต้องบันทึก)
            </label>
            <textarea rows={3} className={`${inputCls} font-mono`} value={sample} onChange={(e) => setSample(e.target.value)} placeholder={'วางข้อความตัวอย่าง หลายบรรทัดได้\n50299/1/1890'} />
            <div className="flex items-center gap-2">
              <button type="button" onClick={runTest} disabled={testing || !sample.trim()} className={btnGhost}>
                <FlaskConical className="w-4 h-4" /> {testing ? 'กำลังทดสอบ...' : 'ทดสอบ'}
              </button>
              {testError && <span className="text-xs text-[#AA0808]">{testError}</span>}
            </div>
            {testResult && (
              <>
                <ParseResultTable rows={testResult.data} />
                {testResult.compiled && (
                  <p className="text-[11px] text-[#6A6D70] font-mono break-all">regex: {testResult.compiled.regex}</p>
                )}
              </>
            )}
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

/** Test box for the page — runs every *active* pattern (exactly what the bot does now). */
function LiveTester() {
  const [text, setText] = useState('')
  const [groupId, setGroupId] = useState('')
  const [rows, setRows] = useState<PcShopPkParseRow[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post<TestResponse>('/pc-shop-pk/patterns/test', { text, group_id: groupId || null })
      setRows(res.data.data)
    } catch (err) {
      setRows(null)
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-[#EBEBEB] rounded p-4 space-y-3">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-[#32363A]">
        <FlaskConical className="w-4 h-4 text-[#0070F2]" /> ทดสอบข้อความกับรูปแบบที่เปิดใช้งานทั้งหมด
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">
        <textarea rows={3} className={`${inputCls} font-mono`} value={text} onChange={(e) => setText(e.target.value)} placeholder={'พิมพ์เหมือนส่งใน LINE\n50299/1/1890\n50300/2/100'} />
        <div className="space-y-2">
          <input className={`${inputCls} font-mono text-xs`} value={groupId} onChange={(e) => setGroupId(e.target.value)} placeholder="Group ID (ไม่บังคับ)" />
          <button onClick={run} disabled={loading || !text.trim()} className={`${btnPrimary} w-full justify-center`}>
            <FlaskConical className="w-4 h-4" /> {loading ? 'กำลังทดสอบ...' : 'ทดสอบ'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-[#AA0808]">{error}</p>}
      {rows && <ParseResultTable rows={rows} />}
    </div>
  )
}

export default function PcShopPkPatternsPage() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const canEdit = can('pc-shop-pk-patterns.edit')
  const [editing, setEditing] = useState<PcShopPkPattern | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading } = useQuery<PatternsResponse>({
    queryKey: ['pc-shop-pk-patterns'],
    queryFn: () => api.get('/pc-shop-pk/patterns').then((r) => r.data),
    enabled: can('pc-shop-pk-patterns.view'),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['pc-shop-pk-patterns'] })

  const toggle = useMutation({
    mutationFn: (p: PcShopPkPattern) => api.put(`/pc-shop-pk/patterns/${p.id}`, { ...toPayload(toForm(p)), is_active: !p.is_active }),
    onSuccess: refresh,
    onError: (err) => alert(apiErrorMessage(err)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/pc-shop-pk/patterns/${id}`),
    onSuccess: refresh,
    onError: (err) => alert(apiErrorMessage(err)),
  })

  if (!can('pc-shop-pk-patterns.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#6A6D70]">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const patterns = data?.data ?? []
  const activeCount = patterns.filter((p) => p.is_active).length

  return (
    <div className="space-y-4">
      <div className="pb-1 border-b border-[#EBEBEB] flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#32363A]">รูปแบบข้อความ</h1>
          <p className="text-[#6A6D70] text-sm mt-0.5">
            เปิดใช้งาน {activeCount} จาก {patterns.length} รูปแบบ · บอทลองจับทีละบรรทัดตามลำดับ ตรงรูปแบบแรกที่เจอ · มีผลทันทีไม่ต้องแก้ n8n
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditing(null); setShowForm(true) }} className={btnPrimary}>
            <Plus className="w-4 h-4" /> เพิ่มรูปแบบ
          </button>
        )}
      </div>

      <div className="bg-white border border-[#EBEBEB] rounded">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F5F6F7] border-b border-[#EBEBEB]">
              <tr>
                {['ลำดับ', 'ชื่อ', 'รูปแบบ', 'Prefix', 'ใช้กับ', 'ค่าเริ่มต้น', 'สถานะ', 'จับได้', 'จับล่าสุด', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-[#6A6D70] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i}>{[...Array(10)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-[#F0F0F0] rounded animate-pulse" /></td>)}</tr>
                ))
              ) : patterns.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-[#6A6D70]">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    ยังไม่มีรูปแบบ — บอทจะไม่บันทึกออเดอร์จนกว่าจะเพิ่มอย่างน้อย 1 รูปแบบ
                  </td>
                </tr>
              ) : (
                patterns.map((p) => {
                  const d: { qty?: string; price?: string } = Array.isArray(p.defaults) ? {} : p.defaults
                  return (
                    <tr key={p.id} className={`align-top hover:bg-[#F5F5F5] ${p.is_active ? '' : 'opacity-60'}`}>
                      <td className="px-4 py-3 text-xs text-[#6A6D70]">{p.priority}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-[#32363A] whitespace-nowrap">{p.name}</div>
                        {p.note && <div className="text-xs text-[#6A6D70] mt-0.5 max-w-[240px]">{p.note}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {p.mode === 'template' ? (
                          <code className="font-mono text-xs text-[#0070F2] bg-[#EBF5FE] px-1.5 py-0.5 rounded whitespace-nowrap">{p.template}</code>
                        ) : (
                          <div className="flex items-start gap-1">
                            <Regex className="w-3.5 h-3.5 text-[#C44500] mt-0.5 shrink-0" />
                            <div>
                              <code className="font-mono text-xs text-[#32363A] break-all">{p.regex}</code>
                              <div className="text-[11px] text-[#6A6D70]">{p.fields.join(', ')}</div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{p.prefix ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-[#6A6D70] whitespace-nowrap">{p.group_ids.length ? `${p.group_ids.length} กลุ่ม` : 'ทุกแชท'}</td>
                      <td className="px-4 py-3 text-xs text-[#6A6D70] whitespace-nowrap">
                        {[d.qty && `จำนวน ${d.qty}`, d.price && `ราคา ${d.price}`].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          disabled={!canEdit || toggle.isPending}
                          onClick={() => toggle.mutate(p)}
                          className={`px-2 py-0.5 rounded text-xs font-medium ${p.is_active ? 'bg-[#F1FDF6] text-[#107E3E]' : 'bg-[#F5F6F7] text-[#6A6D70]'} ${canEdit ? 'hover:ring-1 hover:ring-[#89919A]' : 'cursor-default'}`}
                          title={canEdit ? 'คลิกเพื่อเปิด/ปิด' : undefined}
                        >
                          {p.is_active ? 'เปิด' : 'ปิด'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-right">{Number(p.order_count).toLocaleString('th-TH')}</td>
                      <td className="px-4 py-3 text-xs text-[#6A6D70] whitespace-nowrap">{formatDateTime(p.last_matched_at)}</td>
                      <td className="px-4 py-3">
                        {canEdit && (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setEditing(p); setShowForm(true) }} className="p-1.5 text-[#6A6D70] hover:text-[#0070F2] hover:bg-[#EBF5FE] rounded" title="แก้ไข">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                const warn = p.order_count > 0 ? `\nออเดอร์ที่จับได้แล้ว ${p.order_count} รายการจะยังอยู่ (แสดงเป็น "ลบแล้ว") — ถ้าแค่อยากหยุดใช้ ให้ปิดแทน` : ''
                                if (confirm(`ลบรูปแบบ "${p.name}"?${warn}`)) remove.mutate(p.id)
                              }}
                              className="p-1.5 text-[#6A6D70] hover:text-[#AA0808] hover:bg-[#FFEAF4] rounded"
                              title="ลบ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LiveTester />

      {showForm && (
        <PatternModal
          item={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refresh() }}
        />
      )}
    </div>
  )
}
