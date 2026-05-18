'use client'

import api from '@/lib/api'
import { LineGroupFile, PaginatedResponse, ImportResult } from '@/lib/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import { Search, Lock, FileArchive, ExternalLink, Upload, X, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'

const EXT_COLORS: Record<string, string> = {
  zip: 'bg-yellow-100 text-yellow-700',
  pdf: 'bg-red-100 text-red-700',
  xlsx: 'bg-green-100 text-green-700',
  xls: 'bg-green-100 text-green-700',
  csv: 'bg-teal-100 text-teal-700',
  png: 'bg-purple-100 text-purple-700',
  jpg: 'bg-purple-100 text-purple-700',
  jpeg: 'bg-purple-100 text-purple-700',
}

const SOURCE_COLORS: Record<string, string> = {
  line_bot:     'bg-green-100 text-green-700',
  excel_upload: 'bg-blue-100 text-blue-700',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

interface PreviewHeader {
  name: string
  originalIndex: number
  isInherited: boolean
  showSuffix: boolean
}

interface PreviewData {
  headers: PreviewHeader[]
  rows: string[][]
  totalRows: number
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const importMutation = useMutation({
    mutationFn: (f: File) => {
      const form = new FormData()
      form.append('file', f)
      return api.post<ImportResult>('/line-files/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data)
    },
    onSuccess: (data) => {
      setResult(data)
      qc.invalidateQueries({ queryKey: ['line-files'] })
    },
  })

  const parsePreview = async (f: File) => {
    setParsing(true)
    setPreview(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
      if (rows.length > 0) {
        // Find header row: first row with many non-empty cells
        const nonEmptyCounts = (rows as unknown[][]).map(r =>
          r.filter(c => String(c).trim() !== '').length
        )
        const maxCount = Math.max(...nonEmptyCounts)
        const threshold = Math.max(3, Math.floor(maxCount * 0.5))
        const hIdx = Math.max(0, nonEmptyCounts.findIndex(c => c >= threshold))

        const allHeaders = (rows[hIdx] as unknown[]).map(String)

        // Skip sub-header / near-empty rows between header and real data
        const afterHeader = (rows as unknown[][]).slice(hIdx + 1)
        const dataStart = afterHeader.findIndex(r =>
          r.filter(c => String(c).trim() !== '').length >= threshold
        )
        let realDataRows = dataStart > 0 ? afterHeader.slice(dataStart) : afterHeader

        // Detect if it is a Thailand Post template in the frontend
        const isThaipost = rows.slice(0, 15).some(row =>
          (row as unknown[]).some(cell => {
            const text = String(cell ?? '').trim()
            return text.includes('รายงานข้อมูลรายละเอียดการรับฝาก') ||
                   text.includes('รหัสที่ทำการ')
          })
        )

        // Filter rows exactly like the backend does to ensure the preview row count and items
        // match the actual imported data.
        if (isThaipost) {
          // Thailand Post filtering: Column A (index 0) must be a positive number, Column F (index 5) must have a barcode
          realDataRows = realDataRows.filter(r => {
            const seqVal = r[0] ? String(r[0]).trim() : ''
            const barcodeVal = r[5] ? String(r[5]).trim() : ''
            
            const isSeqNumeric = /^\d+$/.test(seqVal) && parseInt(seqVal, 10) > 0
            const hasBarcode = barcodeVal !== '' && barcodeVal !== '-'
            
            return isSeqNumeric && hasBarcode
          })
        } else {
          // Generic filtering: Ensure the barcode column is not empty
          const barcodeAliases = ['barcode', 'บาร์โค้ด', 'เลขพัสดุ', 'tracking no', 'barcode no']
          const barcodeColIdx = allHeaders.findIndex(h => {
            const normalized = String(h ?? '').toLowerCase().trim()
            return barcodeAliases.some(alias => normalized === alias)
          })

          if (barcodeColIdx !== -1) {
            realDataRows = realDataRows.filter(r => {
              const barcodeVal = r[barcodeColIdx] ? String(r[barcodeColIdx]).trim() : ''
              return barcodeVal !== '' && barcodeVal !== '-'
            })
          }
        }

        const previewRows = realDataRows.slice(0, 8).map(r => r.map(String))

        const visibleCols = allHeaders
          .map((_, i) => i)
          .filter(i =>
            allHeaders[i].trim() !== '' ||
            previewRows.some(r => (r[i] ?? '').trim() !== '')
          )

        const initialHeaders = visibleCols.map((colIdx) => {
          const originalHeader = allHeaders[colIdx].trim()
          if (originalHeader !== '') {
            return {
              name: originalHeader,
              originalIndex: colIdx,
              isInherited: false,
              showSuffix: false
            }
          }

          // Look left in allHeaders to find the nearest non-empty header
          let inheritedName = ''
          for (let j = colIdx - 1; j >= 0; j--) {
            if (allHeaders[j].trim() !== '') {
              inheritedName = allHeaders[j].trim()
              break
            }
          }

          return {
            name: inheritedName,
            originalIndex: colIdx,
            isInherited: inheritedName !== '',
            showSuffix: false
          }
        })

        // Deduplicate columns with the same name:
        // If a column with an inherited/duplicate name has data, and another column with the same name is completely empty,
        // we hide the empty column to keep the preview clean and prevent repeating column names.
        const headerGroups: Record<string, { colIdx: number; headerIdx: number; isEmpty: boolean }[]> = {}
        
        initialHeaders.forEach((h, headerIdx) => {
          if (!h.name) return
          const colIdx = visibleCols[headerIdx]
          const isEmpty = previewRows.every(r => {
            const val = (r[colIdx] ?? '').trim()
            return val === '' || val === '-'
          })
          
          if (!headerGroups[h.name]) {
            headerGroups[h.name] = []
          }
          headerGroups[h.name].push({ colIdx, headerIdx, isEmpty })
        })

        const indicesToRemove = new Set<number>()
        
        Object.entries(headerGroups).forEach(([name, cols]) => {
          if (cols.length > 1) {
            const hasNonEmpty = cols.some(c => !c.isEmpty)
            const hasEmpty = cols.some(c => c.isEmpty)
            if (hasNonEmpty && hasEmpty) {
              cols.forEach(c => {
                if (c.isEmpty) {
                  indicesToRemove.add(c.headerIdx)
                }
              })
            }
          }
        })

        const filteredVisibleCols = visibleCols.filter((_, idx) => !indicesToRemove.has(idx))
        const filteredHeaders = initialHeaders.filter((_, idx) => !indicesToRemove.has(idx))

        // Check name uniqueness in the final list
        const nameCounts: Record<string, number> = {}
        filteredHeaders.forEach(h => {
          if (h.name) {
            nameCounts[h.name] = (nameCounts[h.name] || 0) + 1
          }
        })

        const finalHeaders = filteredHeaders.map(h => ({
          ...h,
          showSuffix: h.isInherited && (nameCounts[h.name] || 0) > 1
        }))

        setPreview({
          headers: finalHeaders,
          rows: previewRows.map(r => filteredVisibleCols.map(i => r[i] ?? '')),
          totalRows: realDataRows.length,
        })
      }
    } catch {
      // cannot parse — skip preview
    } finally {
      setParsing(false)
    }
  }

  const handleSelect = (f: File) => {
    setFile(f)
    parsePreview(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleSelect(dropped)
  }

  const errorMsg = (importMutation.error as { response?: { data?: { message?: string; detected_headers?: string[] } } } | null)
    ?.response?.data

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className={clsx('bg-white rounded-2xl shadow-2xl w-full transition-all duration-200', preview ? 'max-w-5xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            <h2 className="text-base font-bold text-slate-900">นำเข้าข้อมูล Thailand Post จาก Excel</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!result ? (
            <>
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={clsx(
                  'border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors',
                  preview ? 'px-5 py-3 flex items-center gap-3' : 'p-8',
                  dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                <Upload className={clsx('text-slate-400 shrink-0', preview ? 'w-5 h-5' : 'w-8 h-8 mx-auto mb-2')} />
                {file ? (
                  <div className={clsx('min-w-0', preview ? 'text-left' : '')}>
                    <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{(file.size / 1024).toFixed(0)} KB — คลิกเพื่อเปลี่ยนไฟล์</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-slate-600">วางไฟล์ที่นี่ หรือคลิกเพื่อเลือก</p>
                    <p className="text-xs text-slate-400 mt-1">รองรับ .xlsx, .xls, .csv (สูงสุด 20 MB)</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleSelect(e.target.files[0]) }}
                />
              </div>

              {/* Preview table */}
              {parsing && (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                  <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin inline-block" />
                  กำลังอ่านไฟล์...
                </div>
              )}

              {preview && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-500">
                    Preview — {preview.rows.length} แถวแรกจาก{' '}
                    <span className="text-slate-700 font-semibold">{preview.totalRows.toLocaleString('th-TH')}</span> แถว
                    &nbsp;·&nbsp; {preview.headers.length} คอลัมน์
                  </p>
                  <div className="border border-slate-200 rounded-lg overflow-auto max-h-56 custom-scrollbar">
                    <table className="text-xs min-w-full">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-400 border-b border-slate-200 whitespace-nowrap">#</th>
                          {preview.headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left font-medium border-b border-slate-200 whitespace-nowrap max-w-[180px]">
                              <span className="block truncate max-w-[180px]">
                                {h.name ? (
                                  <span className={clsx(h.isInherited ? 'text-slate-400 font-normal italic' : 'text-slate-600 font-semibold')}>
                                    {h.name}
                                    {h.showSuffix && (
                                      <span className="text-[10px] text-slate-300 font-normal ml-1">
                                        ({h.originalIndex + 1})
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">คอลัมน์ {h.originalIndex + 1}</span>
                                )}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {preview.rows.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-1.5 text-slate-300 font-mono">{i + 1}</td>
                            {preview.headers.map((_, j) => (
                              <td key={j} className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                                <span className="block truncate max-w-[180px]">{row[j] ?? ''}</span>
                              </td>
                            ))}
                          </tr>
                        ))}
                        {/* Spacer row to prevent horizontal scrollbar from overlapping last row data */}
                        <tr className="h-3 pointer-events-none">
                          <td colSpan={preview.headers.length + 1} className="p-0"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Hint — hide when preview loaded */}
              {!preview && !parsing && (
                <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
                  <p className="font-medium text-slate-600">หัวตารางที่รองรับ (row แรก):</p>
                  <p>barcode / บาร์โค้ด, ชื่อผู้รับ, เบอร์ผู้รับ, ชื่อผู้ส่ง, ที่ทำการ, รหัสที่ทำการ</p>
                  <p>บริการ, น้ำหนัก, ค่าบริการ, COD, tr_no / เลขที่ใบนำส่ง, ลำดับ</p>
                  <p className="text-amber-600">* คอลัมน์ barcode จำเป็นต้องมี — ถ้าซ้ำจะอัปเดตข้อมูลเดิม</p>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <p className="font-medium">{errorMsg.message}</p>
                  {errorMsg.detected_headers && (
                    <p className="mt-1 text-xs">พบหัวตาราง: {errorMsg.detected_headers.join(', ')}</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <p className="font-semibold">{result.message}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{result.inserted}</p>
                  <p className="text-xs text-green-600 mt-0.5">เพิ่มใหม่</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                  <p className="text-xs text-blue-600 mt-0.5">อัปเดต</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-slate-500">{result.skipped}</p>
                  <p className="text-xs text-slate-400 mt-0.5">ข้าม</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1 mb-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> {result.errors.length} แถวที่มีข้อผิดพลาด
                  </p>
                  <ul className="text-xs text-amber-600 space-y-0.5 max-h-28 overflow-y-auto">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            {result ? 'ปิด' : 'ยกเลิก'}
          </button>
          {!result && (
            <button
              onClick={() => { if (file) importMutation.mutate(file) }}
              disabled={!file || importMutation.isPending || parsing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {importMutation.isPending ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />กำลังนำเข้า...</>
              ) : (
                <><Upload className="w-4 h-4" />นำเข้าข้อมูล{preview && ` (${preview.totalRows.toLocaleString('th-TH')} แถว)`}</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LineFilesPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [extFilter, setExtFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showImport, setShowImport] = useState(false)

  const { data, isLoading } = useQuery<PaginatedResponse<LineGroupFile>>({
    queryKey: ['line-files', search, extFilter, page],
    queryFn: () =>
      api.get('/line-files', { params: { search, extension: extFilter, page, per_page: 20 } }).then((r) => r.data),
    enabled: can('line-files.view'),
  })

  if (!can('line-files.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    )
  }

  const items = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Header Files Import</h1>
          <p className="text-slate-500 text-sm mt-1">ทั้งหมด {data?.total ?? 0} ไฟล์</p>
        </div>
        {can('line-files.create') && (
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            นำเข้า Excel
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="ชื่อไฟล์, Group ID, Message ID..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={extFilter}
          onChange={(e) => { setExtFilter(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">ทุกประเภท</option>
          {['zip', 'pdf', 'xlsx', 'xls', 'csv', 'png', 'jpg'].map((ext) => (
            <option key={ext} value={ext}>.{ext}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-slate-600">ID</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">ชื่อไฟล์</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">ประเภท</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">แหล่งที่มา</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Group ID</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">Extracted</th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">วันที่</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  {[...Array(8)].map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                  <FileArchive className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 text-slate-400 text-xs font-mono">{item.id}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-800 truncate max-w-[220px]">{item.original_file_name ?? '—'}</p>
                    <p className="text-xs text-slate-400 font-mono truncate max-w-[220px]">{item.message_id ?? ''}</p>
                  </td>
                  <td className="px-5 py-4">
                    {item.file_extension ? (
                      <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium uppercase', EXT_COLORS[item.file_extension.toLowerCase()] ?? 'bg-slate-100 text-slate-600')}>
                        .{item.file_extension}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-4">
                    {item.source_type ? (
                      <span className={clsx('px-2 py-0.5 rounded text-[10px] font-medium', SOURCE_COLORS[item.source_type] ?? 'bg-slate-100 text-slate-600')}>
                        {item.source_type === 'excel_upload' ? 'Excel Upload' : item.source_type === 'line_bot' ? 'LINE Bot' : item.source_type}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-4 text-slate-500 font-mono text-xs truncate max-w-[120px]">{item.group_id ?? '—'}</td>
                  <td className="px-5 py-4">
                    {item.extracted_files_count != null ? (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-medium">{item.extracted_files_count} ไฟล์</span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-4 text-slate-400 text-xs">{fmtDate(item.created_at)}</td>
                  <td className="px-5 py-4">
                    {item.file_url && (
                      <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors inline-flex">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data && data.last_page > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <span>หน้า {data.current_page} จาก {data.last_page}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50">ก่อนหน้า</button>
              <button disabled={page === data.last_page} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50">ถัดไป</button>
            </div>
          </div>
        )}
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  )
}
