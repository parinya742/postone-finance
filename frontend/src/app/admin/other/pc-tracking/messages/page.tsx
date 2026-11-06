'use client'

import EdiTablePage, { EdiColumn, formatDateTime } from '@/components/pc-tracking/EdiTablePage'
import { LineMessage } from '@/lib/types'

const COLUMNS: EdiColumn<LineMessage>[] = [
  { label: 'เวลาส่ง', render: (r) => formatDateTime(r.sent_at), className: 'text-xs text-[#0070F2] whitespace-nowrap' },
  { label: 'ผู้ส่ง', render: (r) => r.display_name ?? r.user_id },
  { label: 'กลุ่ม', render: (r) => r.group_name ?? r.group_id, className: 'text-xs text-[#6A6D70] max-w-[180px] truncate' },
  {
    label: 'ประเภท',
    render: (r) => (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.message_type === 'text' ? 'bg-[#EBF5FE] text-[#0070F2]' : 'bg-[#FEF7F1] text-[#C44500]'}`}>
        {r.message_type ?? '—'}
      </span>
    ),
  },
  {
    label: 'ข้อความ',
    render: (r) => r.message_text ?? (r.message_type === 'image' ? <span className="italic text-[#6A6D70]">[รูปภาพ]</span> : null),
    className: 'text-xs text-[#32363A] whitespace-pre-line min-w-[240px] max-w-[480px]',
  },
  { label: 'Message ID', render: (r) => r.message_id, className: 'font-mono text-xs text-[#6A6D70] whitespace-nowrap' },
  { label: 'รับเมื่อ', render: (r) => formatDateTime(r.received_at), className: 'text-xs text-[#6A6D70] whitespace-nowrap' },
]

export default function PcMessagesPage() {
  return (
    <EdiTablePage<LineMessage>
      permission="pc-line-messages.view"
      title="ข้อความ LINE"
      subtitle="ติดตามงาน PC · line_messages · เฉพาะกลุ่มงาน PC"
      endpoint="/pc-tracking/messages"
      columns={COLUMNS}
      rowKey={(r) => r.id}
      searchPlaceholder="ข้อความ, ชื่อผู้ส่ง, กลุ่ม..."
      dateFilter="วันที่ส่ง"
      selectFilters={[
        { param: 'message_type', placeholder: 'ทุกประเภท', options: [{ value: 'text', label: 'ข้อความ (text)' }, { value: 'image', label: 'รูปภาพ (image)' }] },
      ]}
    />
  )
}
