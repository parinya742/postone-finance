'use client'

import EdiTablePage, { EdiColumn, EdiExportConfig, formatDate, formatDateTime, formatNumber } from '@/components/pc-tracking/EdiTablePage'
import { PcShopPkOrderMessage } from '@/lib/types'
import { SOURCE_TYPE_FILTER, sourceLabel } from '../source-type'
import { useGroupFilter } from '../group-filter'
import { useUserFilter } from '../user-filter'

const mono = 'font-mono text-xs text-[#32363A] whitespace-nowrap'
const num = 'text-xs text-right whitespace-nowrap'

function extraText(r: PcShopPkOrderMessage): string | null {
  const extra = typeof r.extra === 'string' ? (JSON.parse(r.extra) as Record<string, string>) : r.extra
  return [r.note, extra ? Object.entries(extra).map(([k, v]) => `${k}: ${v}`).join(', ') : null].filter(Boolean).join(' · ') || null
}

const toNum = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? null : Number(v))

const EXPORT: EdiExportConfig<PcShopPkOrderMessage> = {
  filename: 'pc-shop-pk-orders',
  sheetName: 'Orders',
  columns: [
    { label: 'วันที่สั่ง', value: (r) => r.order_date?.slice(0, 10) },
    { label: 'ลำดับ', value: (r) => r.order_seq },
    { label: 'รหัสสินค้า', value: (r) => r.sku },
    { label: 'จำนวน', value: (r) => toNum(r.quantity) },
    { label: 'ราคาขาย', value: (r) => toNum(r.price) },
    { label: 'รวม', value: (r) => toNum(r.line_total) },
    { label: 'สาขา', value: (r) => r.branch_code },
    { label: 'ผู้ส่ง', value: (r) => r.display_name ?? r.user_id },
    { label: 'แชท', value: (r) => r.group_name ?? sourceLabel(r.source_type, r.group_id) },
    { label: 'บรรทัดที่พิมพ์', value: (r) => r.raw_line },
    { label: 'ข้อมูลเพิ่มเติม', value: extraText },
    { label: 'รูปแบบ', value: (r) => r.pattern_name ?? (r.pattern_id ? `ลบแล้ว (#${r.pattern_id})` : null) },
    { label: 'ประมวลผลเมื่อ', value: (r) => formatDateTime(r.parsed_at) },
  ],
}

const COLUMNS: EdiColumn<PcShopPkOrderMessage>[] = [
  { label: 'วันที่สั่ง', render: (r) => formatDate(r.order_date), className: 'text-xs text-[#0070F2] whitespace-nowrap' },
  { label: 'ลำดับ', render: (r) => r.order_seq },
  { label: 'รหัสสินค้า', render: (r) => r.sku, className: mono },
  { label: 'จำนวน', render: (r) => formatNumber(r.quantity), className: num },
  { label: 'ราคาขาย', render: (r) => (r.price === null ? '—' : formatNumber(r.price, 2)), className: num },
  { label: 'รวม', render: (r) => (r.line_total === null ? '—' : formatNumber(r.line_total, 2)), className: `${num} font-medium` },
  { label: 'สาขา', render: (r) => r.branch_code, className: mono },
  { label: 'ผู้ส่ง', render: (r) => r.display_name ?? r.user_id },
  { label: 'แชท', render: (r) => r.group_name ?? sourceLabel(r.source_type, r.group_id), className: 'text-xs text-[#6A6D70] max-w-[180px] truncate' },
  { label: 'บรรทัดที่พิมพ์', render: (r) => r.raw_line, className: mono },
  {
    label: 'ข้อมูลเพิ่มเติม',
    render: extraText,
    className: 'text-xs text-[#6A6D70] min-w-[120px]',
  },
  {
    label: 'รูปแบบ',
    render: (r) => r.pattern_name ?? (r.pattern_id ? <span className="italic">ลบแล้ว (#{r.pattern_id})</span> : null),
    className: 'text-xs text-[#6A6D70] whitespace-nowrap',
  },
  { label: 'ประมวลผลเมื่อ', render: (r) => formatDateTime(r.parsed_at), className: 'text-xs text-[#6A6D70] whitespace-nowrap' },
]

export default function PcShopPkOrderMessagesPage() {
  const groupFilter = useGroupFilter()
  const userFilter = useUserFilter()

  return (
    <EdiTablePage<PcShopPkOrderMessage>
      permission="pc-shop-pk-orders.view"
      title="รายการคำสั่งซื้อ"
      subtitle="PC SHOP PK · line_order_messages · รูปแบบ รหัสสินค้า/จำนวน/ราคาขาย"
      endpoint="/pc-shop-pk/order-messages"
      columns={COLUMNS}
      rowKey={(r) => r.id}
      searchPlaceholder="รหัสสินค้า, ชื่อผู้ส่ง, กลุ่ม..."
      dateFilter="วันที่สั่ง"
      selectFilters={[SOURCE_TYPE_FILTER, groupFilter, userFilter]}
      exportConfig={EXPORT}
    />
  )
}
