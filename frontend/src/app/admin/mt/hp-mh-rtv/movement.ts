// SAP movement types on HP-MH RTV return slips. 162 / 123 reverse a 161 / 122 return and count negative in net totals.

export const MOVEMENT_LABELS: Record<string, string> = {
  '161': '161 · คืนสินค้า',
  '162': '162 · ยกเลิกการคืน',
  '122': '122 · คืนสินค้า (Return Delivery)',
  '123': '123 · ยกเลิกการคืน (122)',
}

export const MOVEMENT_COLORS: Record<string, string> = {
  '161': 'bg-[#EBF5FE] text-[#0070F2] border-[#0070F2]/40',
  '162': 'bg-[#FEF7F1] text-[#E9730C] border-[#E9730C]/40',
  '122': 'bg-[#EBF5FE] text-[#0070F2] border-[#0070F2]/40',
  '123': 'bg-[#FEF7F1] text-[#E9730C] border-[#E9730C]/40',
}

export const REVERSAL_MVTS = ['162', '123']
