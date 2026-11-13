import { EdiSelectFilter } from '@/components/pc-tracking/EdiTablePage'
import { LineSourceType } from '@/lib/types'

export const SOURCE_TYPE_FILTER: EdiSelectFilter = {
  param: 'source_type',
  placeholder: 'ทุกแชท',
  options: [
    { value: 'group', label: 'กลุ่ม' },
    { value: 'user', label: 'แชทส่วนตัว (1:1)' },
    { value: 'room', label: 'ห้องแชท' },
  ],
}

// Fallback label when the group has no name yet (1:1 chats have no group at all)
export function sourceLabel(type: LineSourceType | null, groupId: string | null): string {
  if (type === 'user') return 'แชทส่วนตัว'
  return groupId ?? '—'
}
