'use client'

import { useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { ErpNoAccess } from '@/components/erp'
import { CrcHeader, MtAuditLogTable } from '@/components/crc'

/** One page per HP-MH vendor sub-tab: that vendor's runs plus vendor-less runs (login, ...). */
export default function HpmhAuditLogsPage() {
  const { can } = useAuth()
  const { vendor } = useParams<{ vendor: string }>()
  if (!can('hpmh-audit-logs.view')) return <ErpNoAccess />

  return (
    <div className="space-y-0 text-[#32363A]">
      <CrcHeader
        section={`HP-MH / Vendor ${vendor}`}
        crumb="ประวัติการทำงาน"
        title="ประวัติการทำงาน (Audit Log)"
        right="รวมรายการที่ไม่ระบุ Vendor (เช่น LOGIN)"
      />
      <MtAuditLogTable base="/hpmh" queryKey="hpmh" params={{ vendor_no: vendor }} />
    </div>
  )
}
