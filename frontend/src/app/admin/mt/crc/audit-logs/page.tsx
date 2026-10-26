'use client'

import { useAuth } from '@/context/AuthContext'
import { ErpNoAccess } from '@/components/erp'
import { CrcHeader, MtAuditLogTable } from '@/components/crc'

export default function CrcAuditLogsPage() {
  const { can } = useAuth()
  if (!can('crc-audit-logs.view')) return <ErpNoAccess />

  return (
    <div className="space-y-0 text-[#32363A]">
      <CrcHeader crumb="ประวัติการทำงาน" title="ประวัติการทำงาน (Audit Log)" />
      <MtAuditLogTable base="/crc" queryKey="crc" />
    </div>
  )
}
