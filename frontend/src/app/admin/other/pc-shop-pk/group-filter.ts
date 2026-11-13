import api from '@/lib/api'
import { EdiSelectFilter } from '@/components/pc-tracking/EdiTablePage'
import { useQuery } from '@tanstack/react-query'

type GroupOption = { group_id: string; label: string; customer_code: string | null }

/** "กลุ่ม LINE" dropdown for the order / message lists (sends ?group_id=). */
export function useGroupFilter(): EdiSelectFilter {
  const { data } = useQuery<GroupOption[]>({
    queryKey: ['pc-shop-pk-group-options'],
    queryFn: () => api.get('/pc-shop-pk/group-options').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  })

  return {
    param: 'group_id',
    placeholder: 'ทุกกลุ่ม',
    options: (data ?? []).map((g) => ({
      value: g.group_id,
      label: g.customer_code ? `${g.label} (${g.customer_code})` : g.label,
    })),
  }
}
