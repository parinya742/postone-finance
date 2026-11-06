'use client'

import EdiTablePage, { EdiColumn, formatDate, formatDateTime, formatNumber } from '@/components/pc-tracking/EdiTablePage'
import { LineOrderMessage } from '@/lib/types'

const mono = 'font-mono text-xs text-[#32363A] whitespace-nowrap'

const COLUMNS: EdiColumn<LineOrderMessage>[] = [
  { label: 'วันที่สั่ง', render: (r) => formatDate(r.order_date_iso ?? r.order_date), className: 'text-xs text-[#0070F2] whitespace-nowrap' },
  { label: 'ลำดับ', render: (r) => r.order_seq },
  { label: 'รหัสสาขา', render: (r) => r.branch_code, className: mono },
  { label: 'SKU', render: (r) => r.sku, className: mono },
  { label: 'จำนวน', render: (r) => formatNumber(r.quantity), className: 'text-xs text-right whitespace-nowrap' },
  { label: 'ยอดเงิน', render: (r) => formatNumber(r.amount, 2), className: 'text-xs text-right whitespace-nowrap font-medium' },
  { label: 'ผู้ส่ง (PC)', render: (r) => r.display_name ?? r.user_id },
  { label: 'กลุ่ม', render: (r) => r.group_name ?? r.group_id, className: 'text-xs text-[#6A6D70] max-w-[180px] truncate' },
  { label: 'ข้อความต้นฉบับ', render: (r) => r.raw_text, className: 'text-xs text-[#6A6D70] whitespace-pre-line min-w-[160px]' },
  { label: 'ประมวลผลเมื่อ', render: (r) => formatDateTime(r.parsed_at), className: 'text-xs text-[#6A6D70] whitespace-nowrap' },
]

export default function PcOrderMessagesPage() {
  return (
    <EdiTablePage<LineOrderMessage>
      permission="pc-line-orders.view"
      title="รายการคำสั่งซื้อ"
      subtitle="ติดตามงาน PC · line_order_messages · เฉพาะกลุ่มงาน PC"
      endpoint="/pc-tracking/order-messages"
      columns={COLUMNS}
      rowKey={(r) => r.id}
      searchPlaceholder="รหัสสาขา, SKU, ชื่อผู้ส่ง, ข้อความ..."
      dateFilter="วันที่สั่ง"
    />
  )
}
