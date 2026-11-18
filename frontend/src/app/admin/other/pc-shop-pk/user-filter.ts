import api from '@/lib/api'
import { EdiSelectFilter } from '@/components/pc-tracking/EdiTablePage'
import { useQuery } from '@tanstack/react-query'

type UserOption = { user_id: string; label: string }

/** "ผู้ส่ง" dropdown for the order / message lists (sends ?user_id=). */
export function useUserFilter(): EdiSelectFilter {
  const { data } = useQuery<UserOption[]>({
    queryKey: ['pc-shop-pk-user-options'],
    queryFn: () => api.get('/pc-shop-pk/user-options').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  })

  return {
    param: 'user_id',
    placeholder: 'ทุกผู้ส่ง',
    multiple: true,
    options: (data ?? []).map((u) => ({ value: u.user_id, label: u.label })),
  }
}
