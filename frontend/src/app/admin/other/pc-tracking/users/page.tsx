'use client'

import EdiTablePage, { BoolBadge, EdiColumn, formatDateTime } from '@/components/pc-tracking/EdiTablePage'
import { LineUser } from '@/lib/types'

const COLUMNS: EdiColumn<LineUser>[] = [
  {
    label: 'ผู้ใช้',
    render: (r) => (
      <div className="flex items-center gap-2">
        {r.picture_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.picture_url} alt="" className="w-7 h-7 rounded-full object-cover bg-[#F0F0F0]" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-[#F0F0F0]" />
        )}
        <span className="text-sm text-[#32363A]">{r.display_name ?? '—'}</span>
      </div>
    ),
    className: 'whitespace-nowrap',
  },
  { label: 'User ID', render: (r) => r.user_id, className: 'font-mono text-xs text-[#6A6D70] whitespace-nowrap' },
  { label: 'ใช้งานบอทได้', render: (r) => <BoolBadge value={r.can_use_bot} yes="ได้" no="ไม่ได้" /> },
  { label: 'ซิงค์ล่าสุด', render: (r) => formatDateTime(r.last_synced_at), className: 'text-xs text-[#6A6D70] whitespace-nowrap' },
]

export default function PcUsersPage() {
  return (
    <EdiTablePage<LineUser>
      permission="pc-line-settings.view"
      title="ผู้ใช้ LINE"
      subtitle="ติดตามงาน PC · line_users"
      endpoint="/pc-tracking/users"
      columns={COLUMNS}
      rowKey={(r) => r.id}
      searchPlaceholder="ชื่อ, User ID..."
    />
  )
}
