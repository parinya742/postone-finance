'use client'

import api from '@/lib/api'
import EdiTablePage, { EdiColumn, formatDate, formatDateTime } from '@/components/pc-tracking/EdiTablePage'
import { buildVrmBatchFile } from '@/components/pc-tracking/vrmWorkbook'
import { VrmBatch } from '@/lib/types'
import { useState } from 'react'
import { Download, Loader2, RotateCcw } from 'lucide-react'

/**
 * S3 copy → 10-minute pre-signed link from the backend (original file, byte-for-byte).
 * No S3 copy → rebuild the .xlsx from the rows staged at import time (vrm.stg_article_channel_raw).
 */
function BatchDownloadButton({ batch }: { batch: VrmBatch }) {
  const [loading, setLoading] = useState(false)
  const fromS3 = !!batch.s3_key

  const download = async () => {
    setLoading(true)
    try {
      if (fromS3) {
        const { data } = await api.get<{ url: string }>(`/pc-tracking/vrm/batches/${batch.id}/download`)
        window.open(data.url, '_blank', 'noopener')
      } else {
        const { data } = await api.get(`/pc-tracking/vrm/batches/${batch.id}/rows`)
        buildVrmBatchFile(data)
      }
    } catch {
      alert('ไม่สามารถดาวน์โหลดไฟล์ได้')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={download}
      disabled={loading}
      title={fromS3 ? 'ดาวน์โหลดไฟล์ต้นฉบับ (S3)' : 'ไม่มีไฟล์ต้นฉบับ — สร้างไฟล์จากข้อมูลที่นำเข้า'}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-[#D9D9D9] text-xs text-[#32363A] hover:text-[#0070F2] hover:border-[#0070F2] hover:bg-[#EBF5FE] transition-colors disabled:opacity-50 whitespace-nowrap"
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : fromS3 ? <Download className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
      {fromS3 ? 'ไฟล์ต้นฉบับ' : 'สร้างไฟล์ใหม่'}
    </button>
  )
}

const COLUMNS: EdiColumn<VrmBatch>[] = [
  { label: 'Batch', render: (r) => `#${r.id}`, className: 'font-mono text-xs text-[#6A6D70] whitespace-nowrap' },
  { label: 'ดาวน์โหลด', render: (r) => <BatchDownloadButton batch={r} />, className: 'whitespace-nowrap' },
  { label: 'ช่วงข้อมูล', render: (r) => `${formatDate(r.date_from)} – ${formatDate(r.date_to)}`, className: 'text-xs text-[#0070F2] whitespace-nowrap' },
  { label: 'Export จาก VRM', render: (r) => formatDateTime(r.exported_at), className: 'text-xs text-[#32363A] whitespace-nowrap' },
  { label: 'จำนวนแถว', render: (r) => r.row_count?.toLocaleString('th-TH'), className: 'text-xs text-right whitespace-nowrap tabular-nums' },
  {
    // Facts are upserted per day/site/SKU/channel, so a newer batch for the same period takes over its rows.
    label: 'แถวที่ใช้อยู่',
    render: (r) => (
      <span className={r.live_rows > 0 ? 'text-[#256F3A] font-medium' : 'text-[#6A6D70]'}>
        {r.live_rows > 0 ? r.live_rows.toLocaleString('th-TH') : 'ถูกแทนที่'}
      </span>
    ),
    className: 'text-xs text-right whitespace-nowrap tabular-nums',
  },
  {
    label: 'สถานะ',
    render: (r) => (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.status === 'loaded' ? 'bg-[#F1FDF6] text-[#256F3A]' : 'bg-[#FEF7F1] text-[#C44500]'}`}>
        {r.status ?? '—'}
      </span>
    ),
  },
  { label: 'ไฟล์', render: (r) => r.file_name, className: 'font-mono text-xs text-[#6A6D70] whitespace-nowrap' },
  { label: 'Error', render: (r) => r.error_message, className: 'text-xs text-[#C44500] max-w-[260px] truncate' },
  { label: 'Vendor', render: (r) => r.vendor_no, className: 'text-xs whitespace-nowrap' },
  { label: 'ประเภท', render: (r) => `${r.source ?? ''}${r.period_type ? ` (${r.period_type})` : ''}`, className: 'text-xs text-[#6A6D70] whitespace-nowrap' },
  { label: 'นำเข้าเมื่อ', render: (r) => formatDateTime(r.created_at), className: 'text-xs text-[#6A6D70] whitespace-nowrap' },
  { label: 'เสร็จเมื่อ', render: (r) => formatDateTime(r.finished_at), className: 'text-xs text-[#6A6D70] whitespace-nowrap' },
]

export default function VrmBatchesPage() {
  return (
    <EdiTablePage<VrmBatch>
      permission="pc-vrm-batches.view"
      title="ประวัติการนำเข้า VRM"
      subtitle="vrm.import_batch"
      endpoint="/pc-tracking/vrm/batches"
      columns={COLUMNS}
      rowKey={(r) => r.id}
      searchPlaceholder="ชื่อไฟล์, ข้อความ error..."
      dateFilter="ช่วงข้อมูล"
    />
  )
}
