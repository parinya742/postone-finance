'use client'

import EdiTablePage, { BoolBadge, EdiColumn, formatDateTime } from '@/components/pc-tracking/EdiTablePage'
import { LineGroup } from '@/lib/types'

const COLUMNS: EdiColumn<LineGroup>[] = [
  { label: 'ชื่อกลุ่ม', render: (r) => r.group_name, className: 'text-sm text-[#32363A] whitespace-nowrap' },
  { label: 'Group ID', render: (r) => r.group_id, className: 'font-mono text-xs text-[#6A6D70] whitespace-nowrap' },
  { label: 'สถานะ', render: (r) => <BoolBadge value={r.is_active} yes="ใช้งาน" no="ไม่ใช้งาน" /> },
  { label: 'เข้าร่วมเมื่อ', render: (r) => formatDateTime(r.joined_at), className: 'text-xs text-[#6A6D70] whitespace-nowrap' },
  { label: 'ข้อความล่าสุด', render: (r) => formatDateTime(r.last_message_at), className: 'text-xs text-[#6A6D70] whitespace-nowrap' },
]

export default function PcGroupsPage() {
  return (
    <EdiTablePage<LineGroup>
      permission="pc-line-settings.view"
      title="กลุ่ม LINE"
      subtitle="ติดตามงาน PC · line_groups"
      endpoint="/pc-tracking/groups"
      columns={COLUMNS}
      rowKey={(r) => r.id}
      searchPlaceholder="ชื่อกลุ่ม, Group ID..."
    />
  )
}
