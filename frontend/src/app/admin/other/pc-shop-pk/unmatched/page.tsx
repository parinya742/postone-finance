'use client'

import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import EdiTablePage, { EdiColumn, formatDateTime } from '@/components/pc-tracking/EdiTablePage'
import { PcShopPkUnmatchedMessage } from '@/lib/types'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { sourceLabel } from '../source-type'
import { apiErrorMessage } from '../parse-result'

const COLUMNS: EdiColumn<PcShopPkUnmatchedMessage>[] = [
  { label: 'เวลาส่ง', render: (r) => formatDateTime(r.sent_at), className: 'text-xs text-[#0070F2] whitespace-nowrap' },
  {
    label: 'สถานะ',
    render: (r) =>
      r.looks_like_order ? (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#FEF7F1] text-[#C44500] whitespace-nowrap">น่าจะเป็นออเดอร์</span>
      ) : (
        <span className="px-2 py-0.5 rounded text-xs bg-[#F5F6F7] text-[#6A6D70] whitespace-nowrap">แชททั่วไป</span>
      ),
  },
  { label: 'ข้อความ', render: (r) => r.message_text, className: 'font-mono text-xs text-[#32363A] whitespace-pre-line min-w-[240px] max-w-[480px]' },
  { label: 'ผู้ส่ง', render: (r) => r.display_name ?? r.user_id },
  { label: 'แชท', render: (r) => r.group_name ?? sourceLabel(r.source_type, r.group_id), className: 'text-xs text-[#6A6D70] max-w-[180px] truncate' },
]

const today = () => new Date().toLocaleDateString('sv-SE') // yyyy-mm-dd (local)
const monthStart = () => today().slice(0, 8) + '01'

/** Re-run the active patterns on messages that have no orders yet. */
function ReparsePanel() {
  const qc = useQueryClient()
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const run = async () => {
    if (!confirm(`ประมวลผลข้อความที่ยังจับไม่ได้ ช่วง ${from} ถึง ${to} ด้วยรูปแบบที่เปิดใช้งานอยู่?\n(บอทจะไม่ตอบกลับในแชท)`)) return
    setRunning(true)
    setResult(null)
    try {
      const res = await api.post<{ message: string }>('/pc-shop-pk/reparse', { date_from: from, date_to: to })
      setResult({ ok: true, text: res.data.message })
      qc.invalidateQueries({ queryKey: ['pc-tracking'] })
      qc.invalidateQueries({ queryKey: ['pc-shop-pk-patterns'] })
    } catch (err) {
      setResult({ ok: false, text: apiErrorMessage(err) })
    } finally {
      setRunning(false)
    }
  }

  const inputCls = 'border border-[#89919A] rounded px-3 py-2 text-sm text-[#32363A] focus:outline-none focus:border-[#0070F2] bg-white'

  return (
    <div className="bg-[#F5FAFF] border border-[#D1E8FF] rounded px-4 py-3 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[220px]">
        <p className="text-sm font-semibold text-[#32363A]">ประมวลผลย้อนหลัง</p>
        <p className="text-xs text-[#6A6D70]">เพิ่มรูปแบบใหม่แล้ว กดเพื่อจับข้อความเก่าที่ตกหล่นเป็นออเดอร์ (ไม่แตะข้อความที่จับได้แล้ว)</p>
      </div>
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
      <span className="text-[#6A6D70] text-sm">—</span>
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
      <button
        onClick={run}
        disabled={running || !from || !to}
        className="inline-flex items-center gap-1.5 bg-[#0070F2] hover:bg-[#0064D9] disabled:opacity-60 text-white px-3.5 py-2 rounded text-sm font-medium"
      >
        <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} /> {running ? 'กำลังประมวลผล...' : 'ประมวลผล'}
      </button>
      {result && (
        <p className={`w-full text-xs ${result.ok ? 'text-[#107E3E]' : 'text-[#AA0808]'}`}>{result.text}</p>
      )}
    </div>
  )
}

export default function PcShopPkUnmatchedPage() {
  const { can } = useAuth()

  return (
    <div className="space-y-4">
      {can('pc-shop-pk-patterns.edit') && <ReparsePanel />}
      <EdiTablePage<PcShopPkUnmatchedMessage>
        permission="pc-shop-pk-patterns.view"
        title="ข้อความที่จับไม่ได้"
        subtitle="PC SHOP PK · ข้อความ text ที่ยังไม่มีออเดอร์ — ใช้หารูปแบบใหม่ที่ผู้ใช้เริ่มพิมพ์"
        endpoint="/pc-shop-pk/unmatched"
        columns={COLUMNS}
        rowKey={(r) => r.id}
        searchPlaceholder="ข้อความ, ชื่อผู้ส่ง, กลุ่ม..."
        dateFilter="วันที่ส่ง"
        selectFilters={[
          { param: 'suspect', placeholder: 'ทุกข้อความ', options: [{ value: '1', label: 'เฉพาะที่น่าจะเป็นออเดอร์' }] },
        ]}
      />
    </div>
  )
}
