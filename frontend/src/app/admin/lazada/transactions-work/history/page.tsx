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
  const [open, setOpen]           = useState(false)
  const [reDateValue, setReDate]  = useState('')
  const [acting, setActing]       = useState(false)
  const [feedback, setFeedback]   = useState<{ ok: boolean; msg: string } | null>(null)

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
    if (!reDateValue) return
    await withAction(async () => {
      const res = await api.post('/lazada/transactions-work/smart-undo', {
        ids, original_transferred_at: getOriginalValue(), new_transferred_at: reDateValue,
        start_date: payload?.start_date ?? null, end_date: payload?.end_date ?? null,
      })
      const { updated, skipped } = res.data as { updated: number; skipped: number }
      let msg = `Smart อัพเดทวันที่โอนเป็น ${fmtDate(reDateValue)} สำเร็จ ${updated} รายการ`
      if (skipped > 0) msg += ` · ข้าม ${skipped} รายการ`
      setFeedback({ ok: true, msg }); setReDate('')
      qc.invalidateQueries({ queryKey: ['lazada-txwork-audit'] })
    })
  }

  async function handleForceReDate() {
    if (!reDateValue) return
    await withAction(async () => {
      const res = await api.patch('/lazada/transactions-work/bulk-transfer', {
        ids, transferred_at: reDateValue,
        start_date: payload?.start_date ?? null, end_date: payload?.end_date ?? null,
      })
      setFeedback({ ok: true, msg: `Force อัพเดทวันที่โอนเป็น ${fmtDate(reDateValue)} สำเร็จ ${res.data.updated} รายการ` })
      setReDate(''); qc.invalidateQueries({ queryKey: ['lazada-txwork-audit'] })
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

            {/* IDs */}
            {ids.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-[#6A6D70] uppercase tracking-wider mb-2">
                  IDs ที่ถูกอัพเดท ({ids.length} รายการ)
                </p>
                <div className="flex flex-wrap gap-1">
                  {ids.map(id => (
                    <span key={id} className="inline-block px-1.5 py-0.5 bg-white border border-[#D9D9D9] rounded-sm text-[10px] font-mono text-[#32363A]">
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {ids.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

                {/* ── Zone A: Smart (Safe) ──────────────────────── */}
                <div className="bg-white border border-[#D9D9D9] rounded">
                  {/* Zone header */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-[#EBEBEB] bg-[#F2F4F7]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#107E3E] shrink-0" />
                    <span className="text-xs font-semibold text-[#32363A]">Smart Operation</span>
                    <span className="text-[10px] text-[#107E3E] font-medium ml-auto">ปลอดภัย</span>
                  </div>

                  <div className="px-3 py-3 space-y-3">
                    <p className="text-[11px] text-[#6A6D70] leading-relaxed">
                      ตรวจสอบก่อน: อัพเดทเฉพาะ IDs ที่ยังมีค่า
                      {' '}<strong className="text-[#32363A]">"{fmtDate(originalValue)}"</strong>{' '}
                      อยู่ · IDs ที่ถูก log อื่นเปลี่ยนแล้วจะถูก<strong>ข้าม</strong>
                    </p>

                    <div className="space-y-2.5">
                      {/* Smart Undo button */}
                      {canSmartUndo && (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-medium text-[#32363A]">Smart Undo</p>
                            <p className="text-[10px] text-[#6A6D70]">ล้างวันที่โอน → ยังไม่โอน</p>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm(`Smart Undo: ล้างเฉพาะ IDs ที่ยังมีค่า "${fmtDate(originalValue)}" อยู่?`)) handleSmartUndo()
                            }}
                            disabled={acting}
                            className="flex items-center gap-1 h-7 px-3 border border-[#D9D9D9] rounded text-xs text-[#32363A] bg-white hover:bg-[#F5F5F5] disabled:opacity-40 transition-colors whitespace-nowrap"
                          >
                            <RotateCcw className="w-3 h-3" />
                            {acting ? '...' : 'Smart Undo'}
                          </button>
                        </div>
                      )}

                      {/* Smart Re-date */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="shrink-0">
                          <p className="text-[11px] font-medium text-[#32363A]">Smart Re-date</p>
                          <p className="text-[10px] text-[#6A6D70]">เปลี่ยนวันที่โอนเฉพาะที่ยังมีค่าเดิม</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={reDateValue}
                            onChange={e => setReDate(e.target.value)}
                            className="h-7 border border-[#D9D9D9] rounded text-xs px-2 text-[#32363A] focus:outline-none focus:border-[#0070F2] w-32"
                          />
                          <button
                            onClick={handleSmartReDate}
                            disabled={!reDateValue || acting}
                            className="flex items-center gap-1 h-7 px-3 bg-[#0070F2] hover:bg-[#0064D9] disabled:opacity-40 text-white text-xs font-semibold rounded transition-colors whitespace-nowrap"
                          >
                            <CalendarCheck className="w-3 h-3" />
                            {acting ? '...' : 'อัพเดท'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Zone B: Force (Overwrite) ─────────────────── */}
                <div className="bg-white border border-[#D9D9D9] rounded">
                  {/* Zone header */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-[#EBEBEB] bg-[#F2F4F7]">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#E9730C] shrink-0" />
                    <span className="text-xs font-semibold text-[#32363A]">Force Re-date</span>
                    <span className="text-[10px] text-[#E9730C] font-medium ml-auto">Overwrite</span>
                  </div>

                  <div className="px-3 py-3 space-y-3">
                    <p className="text-[11px] text-[#6A6D70] leading-relaxed">
                      อัพเดท<strong className="text-[#32363A]">ทุก {ids.length} IDs</strong> โดยไม่ตรวจสอบค่าปัจจุบัน
                      · รวมถึง IDs ที่ถูก log อื่นเปลี่ยนไปแล้ว
                    </p>

                    <div className="flex items-center justify-between gap-2">
                      <div className="shrink-0">
                        <p className="text-[11px] font-medium text-[#32363A]">Force อัพเดทวันที่ใหม่</p>
                        <p className="text-[10px] text-[#E9730C]">⚠ Overwrite ทุก ID ใน log นี้</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={reDateValue}
                          onChange={e => setReDate(e.target.value)}
                          className="h-7 border border-[#D9D9D9] rounded text-xs px-2 text-[#32363A] focus:outline-none focus:border-[#E9730C] w-32"
                        />
                        <button
                          onClick={() => {
                            if (!reDateValue) return
                            if (confirm(`Force อัพเดทวันที่โอนเป็น ${fmtDate(reDateValue)}?\n\nจะ overwrite ทุก ${ids.length} IDs ไม่ว่าค่าปัจจุบันจะเป็นอะไร`)) {
                              handleForceReDate()
                            }
                          }}
                          disabled={!reDateValue || acting}
                          className="flex items-center gap-1 h-7 px-3 border border-[#E9730C] text-[#E9730C] hover:bg-[#FEF9F0] disabled:opacity-40 text-xs font-semibold rounded transition-colors whitespace-nowrap bg-white"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {acting ? '...' : 'Force'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Feedback */}
            {feedback && (
              <div className={`flex items-center gap-2 text-xs px-3 py-2 border rounded-sm ${feedback.ok ? 'bg-[#F1FAF4] border-[#107E3E]/30 text-[#107E3E]' : 'bg-[#FFF5F5] border-[#BB0000]/30 text-[#BB0000]'}`}>
                {feedback.ok
                  ? <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
                  : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                {feedback.msg}
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
