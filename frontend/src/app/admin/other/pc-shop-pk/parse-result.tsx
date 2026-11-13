import { formatDate, formatNumber } from '@/components/pc-tracking/EdiTablePage'
import { PcShopPkParseRow } from '@/lib/types'
import { CheckCircle2, AlertTriangle, MinusCircle } from 'lucide-react'

export const FIELD_HELP: { key: string; label: string; hint: string }[] = [
  { key: 'sku', label: 'รหัสสินค้า', hint: 'บังคับ · ตัวอักษร/ตัวเลข/ขีด' },
  { key: 'qty', label: 'จำนวน', hint: 'ไม่ใส่ = 1 (หรือค่าเริ่มต้น)' },
  { key: 'price', label: 'ราคาขาย', hint: 'รองรับ 1,890.50' },
  { key: 'branch', label: 'สาขา', hint: 'เช่น M013' },
  { key: 'date', label: 'วันที่', hint: 'd/m/yy · ไม่ใส่ = วันที่ส่งข้อความ' },
  { key: 'note', label: 'หมายเหตุ', hint: 'ข้อความที่เหลือ (ใส่ไว้ท้ายสุด)' },
]

/** Result of pc_shop_pk.parse_order_text() — one row per line of the sample text. */
export function ParseResultTable({ rows }: { rows: PcShopPkParseRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-[#6A6D70]">ไม่มีบรรทัดให้ตรวจ</p>
  }
  const matched = rows.filter((r) => r.matched).length

  return (
    <div className="space-y-2">
      <p className="text-xs text-[#6A6D70]">
        จับได้ <span className="font-semibold text-[#107E3E]">{matched}</span> จาก {rows.length} บรรทัด
      </p>
      <div className="overflow-x-auto border border-[#EBEBEB] rounded">
        <table className="w-full text-xs">
          <thead className="bg-[#F5F6F7] border-b border-[#EBEBEB] text-[#6A6D70]">
            <tr>
              {['', 'บรรทัด', 'รูปแบบที่จับได้', 'รหัสสินค้า', 'จำนวน', 'ราคา', 'สาขา', 'วันที่', 'หมายเหตุ / อื่นๆ'].map((h) => (
                <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F0]">
            {rows.map((r) => (
              <tr key={r.line_no} className={r.matched ? '' : 'bg-[#FAFAFA]'}>
                <td className="px-3 py-2">
                  {r.matched ? (
                    <CheckCircle2 className="w-4 h-4 text-[#107E3E]" />
                  ) : r.looks_like_order ? (
                    <span title="ดูเหมือนออเดอร์ แต่ไม่ตรงรูปแบบไหน — บอทจะเตือนผู้ส่ง"><AlertTriangle className="w-4 h-4 text-[#E9730C]" /></span>
                  ) : (
                    <span title="ไม่ใช่ออเดอร์ (ข้าม)"><MinusCircle className="w-4 h-4 text-[#B0B3B5]" /></span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-[#32363A] whitespace-pre">{r.raw_line}</td>
                <td className="px-3 py-2 text-[#6A6D70] whitespace-nowrap">{r.pattern_name ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-[#32363A]">{r.sku ?? '—'}</td>
                <td className="px-3 py-2 text-right">{r.quantity !== null ? formatNumber(r.quantity, 2) : '—'}</td>
                <td className="px-3 py-2 text-right">{r.price !== null ? formatNumber(r.price, 2) : '—'}</td>
                <td className="px-3 py-2">{r.branch_code ?? '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.order_date ? formatDate(r.order_date) : '—'}</td>
                <td className="px-3 py-2 text-[#6A6D70]">
                  {[r.note, r.extra ? Object.entries(r.extra).map(([k, v]) => `${k}: ${v}`).join(', ') : null].filter(Boolean).join(' · ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function apiErrorMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
  const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined
  return first ?? data?.message ?? 'เกิดข้อผิดพลาด'
}
