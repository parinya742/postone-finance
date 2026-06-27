'use client'

import api from '@/lib/api'
import { AuditLog, PaginatedResponse } from '@/lib/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Lock, History, ChevronDown, ChevronRight,
  CalendarCheck, XCircle, RefreshCw, RotateCcw,
  ShieldCheck, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('th-TH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

// ── Action Metadata ───────────────────────────────────────────────────────────

const ACTION_META: Record<string, {
  label: string
  dotCls: string
  textCls: string
  borderCls: string
  bgCls: string
  icon: React.ReactNode
}> = {
  bulk_transfer: {
    label: 'อัพเดทวันที่โอน',
    dotCls: 'bg-[#107E3E]',
    textCls: 'text-[#107E3E]',
    borderCls: 'border-[#107E3E]/30',
    bgCls: 'bg-[#F1FAF4]',
    icon: <CalendarCheck className="w-3 h-3" />,
  },
  bulk_transfer_clear: {
    label: 'ล้างวันที่โอน',
    dotCls: 'bg-[#BB0000]',
    textCls: 'text-[#BB0000]',
    borderCls: 'border-[#BB0000]/30',
    bgCls: 'bg-[#FFF5F5]',
    icon: <XCircle className="w-3 h-3" />,
  },
  smart_undo: {
    label: 'Smart Undo',
    dotCls: 'bg-[#E9730C]',
    textCls: 'text-[#E9730C]',
    borderCls: 'border-[#E9730C]/30',
    bgCls: 'bg-[#FEF9F0]',
    icon: <RotateCcw className="w-3 h-3" />,
  },
  smart_redate: {
    label: 'Smart Re-date',
    dotCls: 'bg-[#0070F2]',
    textCls: 'text-[#0070F2]',
    borderCls: 'border-[#0070F2]/30',
    bgCls: 'bg-[#EBF5FB]',
    icon: <CalendarCheck className="w-3 h-3" />,
  },
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TransferPayload {
  transferred_at:          string | null
  original_transferred_at?: string | null
  start_date:              string | null
  end_date:                string | null
  ids_count:               number
  updated:                 number
  skipped?:                number
  ids:                     number[]
}

// ── Log Row ───────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: AuditLog }) {
  const qc = useQueryClient()
  const [open, setOpen]               = useState(false)
  const [smartReDateValue, setSmartReDate] = useState('')
  const [forceReDateValue, setForceReDate] = useState('')
  const [acting, setActing]           = useState(false)
  const [feedback, setFeedback]   = useState<{ ok: boolean; msg: string } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    msg: string
    danger?: boolean
    expectedInput?: string
    onConfirm?: () => void
  }>({ open: false, title: '', msg: '' })
  const [confirmInput, setConfirmInput] = useState('')

  const meta    = ACTION_META[log.action] ?? { label: log.action, dotCls: 'bg-[#6A6D70]', textCls: 'text-[#6A6D70]', borderCls: 'border-[#D9D9D9]', bgCls: 'bg-[#F5F5F5]', icon: null }
  const payload = log.payload as TransferPayload | null
  const ids     = payload?.ids ?? []

  function getOriginalValue(): string | null {
    if (!payload) return null
    return (log.action === 'bulk_transfer' || log.action === 'smart_redate')
      ? (payload.transferred_at ?? null)
      : null
  }

  async function withAction(fn: () => Promise<void>) {
    setActing(true); setFeedback(null)
    try { await fn() } catch { setFeedback({ ok: false, msg: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }) }
    finally { setActing(false) }
  }

  async function handleSmartUndo() {
    await withAction(async () => {
      const res = await api.post('/lazada/transactions-work/smart-undo', {
        ids, original_transferred_at: getOriginalValue(),
        start_date: payload?.start_date ?? null, end_date: payload?.end_date ?? null,
      })
      const { updated, skipped } = res.data as { updated: number; skipped: number }
      let msg = `ล้างวันที่โอนสำเร็จ ${updated} รายการ`
      if (skipped > 0) msg += ` · ข้าม ${skipped} รายการ (ถูก log อื่นเปลี่ยนแล้ว)`
      setFeedback({ ok: true, msg })
      qc.invalidateQueries({ queryKey: ['lazada-txwork-audit'] })
    })
  }

  async function handleSmartReDate() {
    if (!smartReDateValue) return
    await withAction(async () => {
      const res = await api.post('/lazada/transactions-work/smart-undo', {
        ids, original_transferred_at: getOriginalValue(), new_transferred_at: smartReDateValue,
        start_date: payload?.start_date ?? null, end_date: payload?.end_date ?? null,
      })
      const { updated, skipped } = res.data as { updated: number; skipped: number }
      let msg = `Smart อัพเดทวันที่โอนเป็น ${fmtDate(smartReDateValue)} สำเร็จ ${updated} รายการ`
      if (skipped > 0) msg += ` · ข้าม ${skipped} รายการ`
      setFeedback({ ok: true, msg }); setSmartReDate('')
      qc.invalidateQueries({ queryKey: ['lazada-txwork-audit'] })
    })
  }

  async function handleForceReDate() {
    if (!forceReDateValue) return
    await withAction(async () => {
      const res = await api.patch('/lazada/transactions-work/bulk-transfer', {
        ids, transferred_at: forceReDateValue,
        start_date: payload?.start_date ?? null, end_date: payload?.end_date ?? null,
      })
      setFeedback({ ok: true, msg: `Force อัพเดทวันที่โอนเป็น ${fmtDate(forceReDateValue)} สำเร็จ ${res.data.updated} รายการ` })
      setForceReDate(''); qc.invalidateQueries({ queryKey: ['lazada-txwork-audit'] })
    })
  }

  const canSmartUndo  = log.action === 'bulk_transfer' && ids.length > 0
  const originalValue = getOriginalValue()

  return (
    <tr className="border-b border-[#EBEBEB] last:border-0">
      <td colSpan={5} className="p-0">

        {/* ── Summary Row ─────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#F9FAFB] cursor-pointer transition-colors select-none"
          onClick={() => { setOpen(v => !v); setFeedback(null) }}
        >
          {/* Action badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold border rounded-sm shrink-0 ${meta.bgCls} ${meta.textCls} ${meta.borderCls}`}>
            {meta.icon}
            {meta.label}
          </span>

          {/* Summary text */}
          <div className="flex-1 min-w-0 text-xs text-[#32363A]">
            <span className="font-medium">{payload?.ids_count ?? 0} รายการ</span>
            {log.action === 'bulk_transfer' && payload?.transferred_at && (
              <span className="ml-2 text-[#107E3E]">→ {fmtDate(payload.transferred_at)}</span>
            )}
            {log.action === 'bulk_transfer_clear' && (
              <span className="ml-2 text-[#BB0000]">→ ล้างวันที่</span>
            )}
            {(log.action === 'smart_undo' || log.action === 'smart_redate') && payload && (
              <>
                <span className={`ml-2 ${meta.textCls}`}>
                  → {log.action === 'smart_redate' ? `${fmtDate(payload.transferred_at)} · ` : 'ล้าง · '}
                  {payload.updated} รายการ
                </span>
                {(payload.skipped ?? 0) > 0 && (
                  <span className="ml-1.5 text-[#6A6D70]">· ข้าม {payload.skipped}</span>
                )}
              </>
            )}
            {/* Date range info */}
            {(payload?.start_date || payload?.end_date) && (
              <span className="ml-3 text-[#6A6D70] text-[10px]">
                ช่วงวันที่: {fmtDate(payload.start_date)} – {fmtDate(payload.end_date)}
              </span>
            )}
          </div>

          {/* User + time */}
          <div className="text-right text-[10px] text-[#6A6D70] shrink-0">
            <p className="font-medium text-[#32363A]">{log.user_name}</p>
            <p>{fmtDateTime(log.created_at)}</p>
          </div>

          <span className="text-[#6A6D70] shrink-0">
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
        </div>

        {/* ── Expanded Detail ─────────────────────────────────────── */}
        {open && (
          <div className="border-t border-[#EBEBEB] bg-[#F9FAFB] px-4 py-4 space-y-4">

            {/* IDs Summary Card */}
            {ids.length > 0 && (
              <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-lg overflow-hidden mb-6">
                <div className="bg-[#F8FAFC] px-4 py-2 border-b border-[#E2E8F0] flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">รหัสธุรกรรมที่ได้รับผลกระทบ</span>
                  <span className="text-[11px] font-semibold text-[#0EA5E9] bg-[#E0F2FE] px-2 py-0.5 rounded-full">{ids.length} รายการ</span>
                </div>
                <div className="p-4 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {ids.map(id => (
                    <span key={id} className="inline-flex items-center px-2 py-1 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] border border-[#CBD5E1] rounded text-[10px] font-mono transition-colors cursor-default">
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions Grid */}
            {ids.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

                {/* ── Zone A: Smart (Safe) ──────────────────────── */}
                <div className="flex flex-col bg-white border border-[#E2E8F0] shadow-sm rounded-lg overflow-hidden transition-shadow hover:shadow-md">
                  {/* Zone header */}
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#E2E8F0] bg-gradient-to-r from-[#F0FDF4] to-white">
                    <div className="p-1.5 bg-[#DCFCE7] rounded-md">
                      <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                    </div>
                    <span className="text-sm font-bold text-[#1E293B]">Smart Operation</span>
                    <span className="text-[10px] text-[#16A34A] font-bold bg-[#DCFCE7] px-2 py-0.5 rounded-full ml-auto uppercase tracking-wide">โหมดปลอดภัย</span>
                  </div>

                  <div className="p-4 flex-1 flex flex-col space-y-4">
                    <p className="text-[11px] text-[#64748B] leading-relaxed bg-[#F8FAFC] p-2.5 rounded border border-[#F1F5F9]">
                      <strong className="text-[#334155]">ระบบตรวจสอบก่อน:</strong> จะอัพเดทเฉพาะ IDs ที่ยังมีค่าเดิมคือ
                      {' '}<strong className="text-[#0EA5E9]">"{fmtDate(originalValue)}"</strong>{' '}
                      IDs ที่ถูกประวัติอื่นเปลี่ยนแปลงไปแล้วจะถูก<strong className="text-[#EF4444]">ข้ามอัตโนมัติ</strong>
                    </p>

                    <div className="space-y-3 mt-auto">
                      {/* Smart Undo button */}
                      {canSmartUndo && (
                        <div className="flex items-center justify-between p-3 border border-[#E2E8F0] rounded-lg hover:border-[#CBD5E1] transition-colors">
                          <div>
                            <p className="text-xs font-bold text-[#1E293B]">Smart Undo</p>
                            <p className="text-[10px] text-[#64748B] mt-0.5">ล้างวันที่โอนให้กลับไปเป็น 'ยังไม่โอน'</p>
                          </div>
                          <button
                            onClick={() => {
                              setConfirmInput('')
                              setConfirmDialog({
                                open: true,
                                title: 'ยืนยันการทำ Smart Undo',
                                msg: `คุณต้องการล้างวันที่เฉพาะ IDs ที่ยังมีค่า "${fmtDate(originalValue)}" อยู่ใช่หรือไม่?`,
                                onConfirm: handleSmartUndo
                              })
                            }}
                            disabled={acting}
                            className="flex items-center gap-1.5 h-8 px-4 border border-[#E2E8F0] rounded-md text-xs font-semibold text-[#334155] bg-white hover:bg-[#F8FAFC] hover:border-[#CBD5E1] disabled:opacity-40 transition-all shadow-sm"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-[#64748B]" />
                            {acting ? 'กำลังทำงาน...' : 'ล้างวันที่'}
                          </button>
                        </div>
                      )}

                      {/* Smart Re-date */}
                      <div className="flex items-center justify-between gap-3 p-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC]">
                        <div className="shrink-0">
                          <p className="text-xs font-bold text-[#1E293B]">Smart Re-date</p>
                          <p className="text-[10px] text-[#64748B] mt-0.5">เปลี่ยนวันที่โอนเฉพาะรายการที่ยังไม่มีการเปลี่ยนแปลง</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={smartReDateValue}
                            onChange={e => setSmartReDate(e.target.value)}
                            className="h-8 border border-[#CBD5E1] rounded-md text-xs px-2.5 text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9] w-[130px] shadow-sm bg-white"
                          />
                          <button
                            onClick={handleSmartReDate}
                            disabled={!smartReDateValue || acting}
                            className="flex items-center gap-1.5 h-8 px-4 bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-50 text-white text-xs font-semibold rounded-md transition-all shadow-sm shadow-[#0EA5E9]/20 whitespace-nowrap"
                          >
                            <CalendarCheck className="w-3.5 h-3.5" />
                            {acting ? 'กำลังทำงาน...' : 'อัพเดทวันที่'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Zone B: Force (Overwrite) ─────────────────── */}
                <div className="flex flex-col bg-white border border-[#E2E8F0] shadow-sm rounded-lg overflow-hidden transition-shadow hover:shadow-md">
                  {/* Zone header */}
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#E2E8F0] bg-gradient-to-r from-[#FFF7ED] to-white">
                    <div className="p-1.5 bg-[#FFEDD5] rounded-md">
                      <AlertTriangle className="w-4 h-4 text-[#F97316]" />
                    </div>
                    <span className="text-sm font-bold text-[#1E293B]">Force Operation</span>
                    <span className="text-[10px] text-[#F97316] font-bold bg-[#FFEDD5] px-2 py-0.5 rounded-full ml-auto uppercase tracking-wide">Warning</span>
                  </div>

                  <div className="p-4 flex-1 flex flex-col space-y-4">
                    <div className="bg-[#FEF2F2] border border-[#FECACA] p-3 rounded-lg flex gap-3">
                      <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                      <p className="text-[11px] text-[#991B1B] leading-relaxed">
                        <strong>คำเตือน:</strong> การทำงานนี้จะเขียนทับข้อมูล<strong className="font-bold">ทั้ง {ids.length} รายการ</strong> โดยไม่สนสถานะปัจจุบัน แม้ว่าข้อมูลนั้นจะถูกแก้ไขโดยประวัติอื่นไปแล้วก็ตาม
                      </p>
                    </div>

                    <div className="mt-auto border border-[#FECACA] bg-[#FFF5F5] rounded-lg p-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="shrink-0">
                          <p className="text-xs font-bold text-[#7F1D1D]">Force Re-date All</p>
                          <p className="text-[10px] text-[#991B1B] mt-0.5">บังคับเขียนทับข้อมูลทั้งหมด</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={forceReDateValue}
                            onChange={e => setForceReDate(e.target.value)}
                            className="h-8 border border-[#FECACA] rounded-md text-xs px-2.5 text-[#7F1D1D] bg-white focus:outline-none focus:ring-2 focus:ring-[#EF4444]/20 focus:border-[#EF4444] w-[130px] shadow-sm"
                          />
                          <button
                            onClick={() => {
                              if (!forceReDateValue) return
                              setConfirmInput('')
                              setConfirmDialog({
                                open: true,
                                title: 'ยืนยันการ Force Re-date',
                                msg: `คุณต้องการอัพเดทวันที่โอนเป็น ${fmtDate(forceReDateValue)} ใช่หรือไม่?\n${(payload?.start_date || payload?.end_date) ? `\nช่วงวันที่ธุรกรรม: ${fmtDate(payload?.start_date ?? null)} – ${fmtDate(payload?.end_date ?? null)}\n` : ''}\nคำเตือน: ระบบจะเขียนทับทุกๆ ${ids.length} รายการ ไม่ว่าค่าปัจจุบันจะเป็นอะไรก็ตาม`,
                                danger: true,
                                expectedInput: 'CONFIRM',
                                onConfirm: handleForceReDate
                              })
                            }}
                            disabled={!forceReDateValue || acting}
                            className="flex items-center gap-1.5 h-8 px-4 bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-50 text-white text-xs font-semibold rounded-md transition-all shadow-sm shadow-[#EF4444]/20 whitespace-nowrap"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {acting ? 'กำลังทำงาน...' : 'บังคับอัพเดท'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Feedback */}
            {feedback && (
              <div className={`mt-4 flex items-start gap-3 p-4 border rounded-lg shadow-sm ${feedback.ok ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FEF2F2] border-[#FECACA]'}`}>
                <div className={`p-1.5 rounded-full shrink-0 ${feedback.ok ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#EF4444]'}`}>
                  {feedback.ok ? <ShieldCheck className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 pt-0.5">
                  <h3 className={`text-xs font-bold ${feedback.ok ? 'text-[#166534]' : 'text-[#991B1B]'}`}>
                    {feedback.ok ? 'ทำรายการสำเร็จ' : 'ทำรายการไม่สำเร็จ'}
                  </h3>
                  <p className={`text-[11px] mt-1 leading-relaxed ${feedback.ok ? 'text-[#15803D]' : 'text-[#B91C1C]'}`}>
                    {feedback.msg}
                  </p>
                </div>
              </div>
            )}

            {/* Custom Confirm Dialog */}
            {confirmDialog.open && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className={`px-5 py-4 border-b flex items-center gap-3 ${confirmDialog.danger ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                    {confirmDialog.danger ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <ShieldCheck className="w-5 h-5 text-slate-600" />}
                    <h3 className={`font-semibold ${confirmDialog.danger ? 'text-red-900' : 'text-slate-900'}`}>
                      {confirmDialog.title}
                    </h3>
                  </div>
                  <div className="px-5 py-6 space-y-4">
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{confirmDialog.msg}</p>
                    {confirmDialog.expectedInput && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                          โปรดพิมพ์คำว่า <strong className="text-red-600 font-mono select-all bg-red-50 px-1 py-0.5 rounded border border-red-100">{confirmDialog.expectedInput}</strong> เพื่อยืนยัน
                        </label>
                        <input
                          type="text"
                          value={confirmInput}
                          onChange={e => setConfirmInput(e.target.value)}
                          placeholder={confirmDialog.expectedInput}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-shadow"
                        />
                      </div>
                    )}
                  </div>
                  <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                      onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
                      className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={() => {
                        setConfirmDialog({ ...confirmDialog, open: false })
                        confirmDialog.onConfirm?.()
                      }}
                      disabled={!!confirmDialog.expectedInput && confirmInput !== confirmDialog.expectedInput}
                      className={`px-4 py-2 text-xs font-medium text-white rounded-lg transition-all shadow-sm ${
                        confirmDialog.danger 
                          ? 'bg-red-600 hover:bg-red-700 shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed' 
                          : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                    >
                      ยืนยัน
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TransactionWorkHistoryPage() {
  const { can } = useAuth()
  const [page, setPage] = useState(1)

  const { data, isLoading, refetch, isFetching } = useQuery<PaginatedResponse<AuditLog>>({
    queryKey: ['lazada-txwork-audit', page],
    queryFn: () =>
      api.get('/audit-logs', {
        params: { target_type: 'lazada_transactions_work', per_page: 30, page },
      }).then(r => r.data),
    enabled: can('lazada-shops.view'),
  })

  if (!can('lazada-shops.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#6A6D70]">
        <Lock className="w-10 h-10 mb-3 text-[#D9D9D9]" />
        <p className="text-sm font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const logs = data?.data ?? []

  return (
    <div className="space-y-0 text-[#32363A]">

      {/* ══ Page Header ══════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#D9D9D9] px-4 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-[#6A6D70] uppercase tracking-wide">Lazada / จัดการธุรกรรม / ประวัติ</p>
          <h1 className="text-sm font-semibold text-[#32363A] leading-tight">ประวัติการจัดการธุรกรรม</h1>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 h-8 px-3 border border-[#D9D9D9] rounded text-xs text-[#32363A] bg-white hover:bg-[#F5F5F5] disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          รีเฟรช
        </button>
      </div>

      {/* ══ Legend Bar ═══════════════════════════════════════════════════════ */}
      <div className="bg-white border-x border-b border-[#D9D9D9] px-4 py-2 flex flex-wrap items-center gap-4">
        <span className="text-[10px] font-semibold text-[#6A6D70] uppercase tracking-wider shrink-0">ประเภท</span>
        {Object.entries(ACTION_META).map(([key, m]) => (
          <span key={key} className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 border rounded-sm ${m.bgCls} ${m.textCls} ${m.borderCls}`}>
            {m.icon}
            {m.label}
          </span>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-[#6A6D70]">
          <ShieldCheck className="w-3 h-3 text-[#107E3E]" />
          Smart = ปลอดภัย (ข้ามรายการที่เปลี่ยนแล้ว)
          <span className="mx-1 text-[#D9D9D9]">·</span>
          <AlertTriangle className="w-3 h-3 text-[#E9730C]" />
          Force = Overwrite ทุก ID
        </div>
      </div>

      {/* ══ Log Table ════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#D9D9D9] border-t-0">
        {/* Table header */}
        <div className="grid grid-cols-[180px_1fr_160px_24px] gap-0 bg-[#F2F4F7] border-b-2 border-[#0070F2]">
          <div className="px-3 py-2 text-[10px] font-semibold text-[#354A5E] uppercase tracking-wider">ประเภท</div>
          <div className="px-3 py-2 text-[10px] font-semibold text-[#354A5E] uppercase tracking-wider">รายละเอียด</div>
          <div className="px-3 py-2 text-[10px] font-semibold text-[#354A5E] uppercase tracking-wider text-right">ผู้ดำเนินการ / เวลา</div>
          <div />
        </div>

        {/* Rows */}
        {isLoading ? (
          <div>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-3 px-3 py-3 border-b border-[#EBEBEB]">
                <div className="h-4 w-24 bg-[#F2F4F7] rounded-sm animate-pulse" />
                <div className="h-4 flex-1 bg-[#F2F4F7] rounded-sm animate-pulse" />
                <div className="h-4 w-32 bg-[#F2F4F7] rounded-sm animate-pulse" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-[#6A6D70]">
            <History className="w-8 h-8 mx-auto mb-3 text-[#D9D9D9]" />
            <p className="text-sm">ยังไม่มีประวัติการโอน</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {logs.map(log => <LogRow key={log.id} log={log} />)}
            </tbody>
          </table>
        )}

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        {data && (
          <div className="px-4 py-2.5 border-t border-[#D9D9D9] flex items-center justify-between bg-[#F9FAFB]">
            <span className="text-xs text-[#6A6D70]">
              {data.total.toLocaleString('th-TH')} รายการ
            </span>
            {data.last_page > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6A6D70]">หน้า {data.current_page} / {data.last_page}</span>
                <div className="flex gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="h-7 px-3 border border-[#D9D9D9] rounded text-xs text-[#32363A] disabled:opacity-40 hover:bg-[#F5F5F5] transition-colors"
                  >
                    ‹ ก่อนหน้า
                  </button>
                  <button
                    disabled={page === data.last_page}
                    onClick={() => setPage(p => p + 1)}
                    className="h-7 px-3 border border-[#D9D9D9] rounded text-xs text-[#32363A] disabled:opacity-40 hover:bg-[#F5F5F5] transition-colors"
                  >
                    ถัดไป ›
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
