'use client'

import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { PcShopPkDashboard, PcShopPkDashboardMetrics } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Lock, Database } from 'lucide-react'
import { SOURCE_TYPE_FILTER } from '../source-type'
import { useGroupFilter } from '../group-filter'
import MultiSelectFilter from '@/components/pc-tracking/MultiSelectFilter'

const PERMISSION = 'pc-shop-pk-dashboard.view'

const inputCls =
  'border border-[#89919A] rounded px-3 py-2 text-sm text-[#32363A] focus:outline-none focus:border-[#0070F2] focus:ring-1 focus:ring-[#0070F2] bg-white'

// Single-series charts → one hue (the app's primary blue); text stays in ink tokens.
const BAR = '#0070F2'
const BAR_HOVER = '#0057BE'
const TRACK = '#EEF3FA'

type Metric = keyof PcShopPkDashboardMetrics

const METRICS: { key: Metric; label: string; unit: string; digits: number }[] = [
  { key: 'amount', label: 'ยอดขาย', unit: 'บาท', digits: 2 },
  { key: 'orders', label: 'คำสั่งซื้อ', unit: 'รายการ', digits: 0 },
  { key: 'quantity', label: 'จำนวนชิ้น', unit: 'ชิ้น', digits: 0 },
]

// ── helpers ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function fmt(v: number, digits = 0) {
  return v.toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Compact axis label: 1.2 ล้าน / 350K / 1,200 */
function compact(v: number) {
  if (v >= 1_000_000) return `${fmt(v / 1_000_000, v % 1_000_000 === 0 ? 0 : 1)} ล้าน`
  if (v >= 10_000) return `${fmt(v / 1000, 0)}K`
  return fmt(v)
}

function shortDate(s: string) {
  const d = new Date(`${s}T00:00:00`)
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

function longDate(s: string) {
  const d = new Date(`${s}T00:00:00`)
  return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

/** Round an axis max up to 1/2/2.5/5 × 10^n so gridlines land on clean numbers. */
function niceMax(max: number, ticks = 4) {
  if (max <= 0) return ticks
  const raw = max / ticks
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].find((m) => m * pow >= raw)! * pow
  return step * ticks
}

/** Every day between from and to (inclusive), so days without orders show as gaps, not skipped. */
function dayRange(from: string, to: string): string[] {
  const out: string[] = []
  const d = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  while (d <= end && out.length < 400) {
    out.push(ymd(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function PcShopPkDashboardPage() {
  const { can } = useAuth()
  const groupFilter = useGroupFilter()

  const today = new Date()
  const [dateFrom, setDateFrom] = useState(ymd(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [dateTo, setDateTo] = useState(ymd(today))
  const [sourceType, setSourceType] = useState('')
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [metric, setMetric] = useState<Metric>('amount')

  const params = {
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    source_type: sourceType || undefined,
    group_id: groupIds.length ? groupIds : undefined,
  }

  const { data, isLoading } = useQuery<PcShopPkDashboard>({
    queryKey: ['pc-shop-pk-dashboard', params],
    queryFn: () => api.get('/pc-shop-pk/order-dashboard', { params }).then((r) => r.data),
    enabled: can(PERMISSION),
  })

  if (!can(PERMISSION)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#6A6D70]">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const s = data?.summary
  const avg = s && s.orders > 0 ? s.amount / s.orders : 0

  return (
    <div className="space-y-4">
      <div className="pb-1 border-b border-[#EBEBEB]">
        <h1 className="text-xl font-semibold text-[#32363A]">Dashboard คำสั่งซื้อ</h1>
        <p className="text-[#6A6D70] text-sm mt-0.5">
          PC SHOP PK · สรุปจากคำสั่งซื้อที่ส่งผ่าน LINE
        </p>
      </div>

      {/* Filters — one row above the charts */}
      <div className="bg-white border border-[#EBEBEB] rounded px-4 py-3 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#6A6D70] whitespace-nowrap">วันที่สั่ง</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
          <span className="text-[#6A6D70] text-sm">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
        </div>
        <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={inputCls}>
          <option value="">{SOURCE_TYPE_FILTER.placeholder}</option>
          {SOURCE_TYPE_FILTER.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <MultiSelectFilter
          placeholder={groupFilter.placeholder}
          options={groupFilter.options}
          value={groupIds}
          onChange={setGroupIds}
        />
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="ยอดขายรวม" value={s ? `฿${fmt(s.amount, 2)}` : null} loading={isLoading} wide />
        <Kpi label="คำสั่งซื้อ" value={s ? fmt(s.orders) : null} sub={s ? `${fmt(s.lines)} บรรทัดสินค้า` : undefined} loading={isLoading} />
        <Kpi label="จำนวนชิ้น" value={s ? fmt(s.quantity) : null} loading={isLoading} />
        <Kpi label="เฉลี่ยต่อคำสั่งซื้อ" value={s ? `฿${fmt(avg, 2)}` : null} loading={isLoading} />
        <Kpi label="ร้านค้าที่สั่ง" value={s ? fmt(s.shops) : null} loading={isLoading} />
        <Kpi label="รหัสสินค้า (SKU)" value={s ? fmt(s.skus) : null} loading={isLoading} />
      </div>

      {/* Daily trend */}
      <div className="bg-white border border-[#EBEBEB] rounded">
        <div className="px-4 py-3 border-b border-[#EBEBEB] flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#32363A]">
            {METRICS.find((m) => m.key === metric)!.label}รายวัน
          </h2>
          <div className="inline-flex rounded border border-[#89919A] overflow-hidden text-xs">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`px-3 py-1.5 transition-colors ${metric === m.key ? 'bg-[#0070F2] text-white' : 'bg-white text-[#32363A] hover:bg-[#F5F5F5]'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="h-64 bg-[#F5F6F7] rounded animate-pulse" />
          ) : (
            <DailyChart
              daily={data?.daily ?? []}
              from={dateFrom || s?.first_date || ''}
              to={dateTo || s?.last_date || ''}
              metric={metric}
            />
          )}
        </div>
      </div>

      {/* Top lists */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TopList
          title="ร้านค้ายอดขายสูงสุด 10 อันดับ"
          loading={isLoading}
          rows={(data?.top_shops ?? []).map((r) => ({ ...r, tag: r.customer_code }))}
        />
        <TopList
          title="สินค้ายอดขายสูงสุด 10 อันดับ"
          loading={isLoading}
          mono
          rows={(data?.top_skus ?? []).map((r) => ({ ...r, key: r.sku, label: r.sku, tag: null }))}
        />
      </div>
    </div>
  )
}

// ── components ───────────────────────────────────────────────────────────────

function Kpi({ label, value, sub, loading, wide }: { label: string; value: string | null; sub?: string; loading: boolean; wide?: boolean }) {
  return (
    <div className={`bg-white border border-[#EBEBEB] rounded px-4 py-3 ${wide ? 'col-span-2 md:col-span-1 xl:col-span-1' : ''}`}>
      <p className="text-xs text-[#6A6D70]">{label}</p>
      {loading ? (
        <div className="h-7 mt-1 bg-[#F0F0F0] rounded animate-pulse" />
      ) : (
        <p className="text-xl font-semibold text-[#32363A] mt-0.5 tabular-nums truncate" title={value ?? ''}>{value ?? '—'}</p>
      )}
      {sub && !loading && <p className="text-xs text-[#6A6D70] mt-0.5">{sub}</p>}
    </div>
  )
}

function DailyChart({ daily, from, to, metric }: { daily: PcShopPkDashboard['daily']; from: string; to: string; metric: Metric }) {
  const [hover, setHover] = useState<number | null>(null)

  const days = useMemo(() => {
    const byDate = new Map(daily.map((d) => [d.date, d]))
    const range = from && to && from <= to ? dayRange(from, to) : daily.map((d) => d.date)
    return range.map((date) => byDate.get(date) ?? { date, orders: 0, quantity: 0, amount: 0 })
  }, [daily, from, to])

  if (days.length === 0 || daily.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-[#6A6D70] text-sm">
        <Database className="w-8 h-8 mb-2 opacity-40" />
        ไม่มีคำสั่งซื้อในช่วงที่เลือก
      </div>
    )
  }

  const max = niceMax(Math.max(...days.map((d) => d[metric])))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const labelEvery = Math.ceil(days.length / 12)
  const h = days[hover ?? -1]

  return (
    <div className="flex gap-2">
      {/* y-axis */}
      <div className="relative h-64 w-14 shrink-0 text-[11px] text-[#6A6D70] tabular-nums">
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / max) * 100}%` }}>
            {compact(t)}
          </span>
        ))}
      </div>

      <div className="flex-1 min-w-0">
        <div className="relative h-64" onMouseLeave={() => setHover(null)}>
          {/* gridlines (recessive) */}
          {ticks.map((t) => (
            <div key={t} className={`absolute inset-x-0 border-t ${t === 0 ? 'border-[#C8CDD3]' : 'border-[#F0F0F0]'}`} style={{ bottom: `${(t / max) * 100}%` }} />
          ))}

          {/* bars — full-height columns are the hit targets, 2px gap between bars */}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {days.map((d, i) => {
              const v = d[metric]
              return (
                <div
                  key={d.date}
                  className="relative flex-1 h-full flex items-end cursor-default"
                  onMouseEnter={() => setHover(i)}
                >
                  {hover === i && <div className="absolute inset-0 bg-[#0070F2]/5" />}
                  <div
                    className="relative w-full max-w-[48px] mx-auto rounded-t-[4px] transition-colors"
                    style={{
                      height: v > 0 ? `max(2px, ${(v / max) * 100}%)` : 0,
                      background: hover === i ? BAR_HOVER : BAR,
                    }}
                  />
                </div>
              )
            })}
          </div>

          {/* tooltip */}
          {h && (
            <div
              className="pointer-events-none absolute top-0 z-10 bg-white border border-[#D9D9D9] rounded shadow-md px-3 py-2 text-xs text-[#32363A] whitespace-nowrap"
              style={{
                left: `${((hover! + 0.5) / days.length) * 100}%`,
                transform: `translateX(${hover! < days.length / 2 ? '8px' : 'calc(-100% - 8px)'})`,
              }}
            >
              <p className="font-semibold mb-1">{longDate(h.date)}</p>
              {METRICS.map((m) => (
                <p key={m.key} className={`flex justify-between gap-4 ${m.key === metric ? 'font-semibold' : 'text-[#6A6D70]'}`}>
                  <span>{m.label}</span>
                  <span className="tabular-nums">{fmt(h[m.key], m.digits)} {m.unit}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        {/* x-axis */}
        <div className="flex gap-[2px] mt-1.5 text-[11px] text-[#6A6D70]">
          {days.map((d, i) => (
            <div key={d.date} className="flex-1 min-w-0 text-center overflow-visible whitespace-nowrap">
              {i % labelEvery === 0 ? shortDate(d.date) : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type TopRow = PcShopPkDashboardMetrics & { key: string; label: string; tag: string | null }

function TopList({ title, rows, loading, mono }: { title: string; rows: TopRow[]; loading: boolean; mono?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.amount))

  return (
    <div className="bg-white border border-[#EBEBEB] rounded">
      <div className="px-4 py-3 border-b border-[#EBEBEB]">
        <h2 className="text-sm font-semibold text-[#32363A]">{title}</h2>
      </div>
      <div className="p-4 space-y-3">
        {loading ? (
          [...Array(6)].map((_, i) => <div key={i} className="h-9 bg-[#F5F6F7] rounded animate-pulse" />)
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#6A6D70]">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
            ไม่พบข้อมูล
          </div>
        ) : (
          rows.map((r, i) => (
            <div key={r.key} className="group">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-[#32363A]" title={r.label}>
                  <span className="inline-block w-5 text-[#6A6D70] tabular-nums">{i + 1}.</span>
                  <span className={mono ? 'font-mono' : ''}>{r.label}</span>
                  {r.tag && <span className="ml-1.5 text-[#6A6D70] font-mono">{r.tag}</span>}
                </span>
                <span className="shrink-0 font-semibold text-[#32363A] tabular-nums">฿{fmt(r.amount, 2)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full overflow-hidden" style={{ background: TRACK }}>
                <div
                  className="h-full rounded-full transition-colors group-hover:brightness-90"
                  style={{ width: `${(r.amount / max) * 100}%`, background: BAR }}
                />
              </div>
              <p className="mt-0.5 text-[11px] text-[#6A6D70] tabular-nums">
                {fmt(r.orders)} คำสั่งซื้อ · {fmt(r.quantity)} ชิ้น
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
