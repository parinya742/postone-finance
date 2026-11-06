'use client'

import EdiTablePage, { BoolBadge, EdiColumn, formatDateTime } from '@/components/pc-tracking/EdiTablePage'
import { LineChannel } from '@/lib/types'

// channel_secret / channel_access_token are never sent by the API — only whether they are set.
const COLUMNS: EdiColumn<LineChannel>[] = [
  { label: 'ชื่อ Channel', render: (r) => r.channel_name, className: 'text-sm text-[#32363A] whitespace-nowrap' },
  { label: 'Channel ID', render: (r) => r.channel_id, className: 'font-mono text-xs text-[#6A6D70] whitespace-nowrap' },
  { label: 'Channel Secret', render: (r) => <BoolBadge value={r.has_secret} yes="ตั้งค่าแล้ว" no="ยังไม่ตั้งค่า" /> },
  { label: 'Access Token', render: (r) => <BoolBadge value={r.has_access_token} yes="ตั้งค่าแล้ว" no="ยังไม่ตั้งค่า" /> },
  { label: 'สร้างเมื่อ', render: (r) => formatDateTime(r.created_at), className: 'text-xs text-[#6A6D70] whitespace-nowrap' },
  { label: 'แก้ไขล่าสุด', render: (r) => formatDateTime(r.updated_at), className: 'text-xs text-[#6A6D70] whitespace-nowrap' },
]

export default function PcChannelsPage() {
  return (
    <EdiTablePage<LineChannel>
      permission="pc-line-settings.view"
      title="LINE Channel"
      subtitle="ติดตามงาน PC · line_channels"
      endpoint="/pc-tracking/channels"
      columns={COLUMNS}
      rowKey={(r) => r.id}
      searchPlaceholder="ชื่อ Channel, Channel ID..."
    />
  )
}
