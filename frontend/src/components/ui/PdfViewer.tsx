'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, FileWarning, Loader2, X } from 'lucide-react'
import clsx from 'clsx'

/**
 * PDF Viewer (popup mode) following SAP Fiori sap.m.PDFViewer:
 * title bar → document rendered by the browser's PDF engine → footer with Download + Close.
 */

interface PdfViewerNav {
  index: number
  total: number
  onPrev: () => void
  onNext: () => void
}

interface PdfViewerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** URL the browser can render inline (application/pdf, no attachment disposition). */
  src: string | null
  /** Download handler; the button is hidden when omitted (showDownloadButton=false). */
  onDownload?: () => void | Promise<void>
  /** Optional previous/next navigation when the viewer is opened from a list. */
  nav?: PdfViewerNav
}

function BusyIndicator() {
  return (
    <div className="flex items-center gap-1.5" role="progressbar" aria-label="กำลังโหลด">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2.5 h-2.5 rounded-full bg-[#0070F2] animate-pulse"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  )
}

function ErrorState({ onDownload }: { onDownload?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <FileWarning className="w-16 h-16 text-[#6A6D70] opacity-60 mb-4" strokeWidth={1.25} />
      <p className="text-base font-semibold text-[#32363A]">ไม่สามารถแสดงเอกสาร PDF ได้</p>
      <p className="text-sm text-[#6A6D70] mt-1 max-w-sm">
        ไม่พบไฟล์ หรือเบราว์เซอร์ไม่สามารถแสดงไฟล์นี้ได้
        {onDownload ? ' คุณยังสามารถดาวน์โหลดไฟล์เพื่อเปิดดูได้' : ''}
      </p>
      {onDownload && (
        <button
          onClick={onDownload}
          className="mt-4 h-9 px-4 text-sm font-medium text-white bg-[#0070F2] hover:bg-[#0064D9] rounded-md transition-colors"
        >
          ดาวน์โหลด
        </button>
      )}
    </div>
  )
}

/** Keyed by src so loading state resets for every document. */
function PdfFrame({ src, title }: { src: string; title: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="relative h-full">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <BusyIndicator />
        </div>
      )}
      <iframe
        src={`${src}#view=FitH`}
        title={title}
        onLoad={() => setLoaded(true)}
        className={clsx('w-full h-full border-0 bg-white', !loaded && 'opacity-0')}
      />
    </div>
  )
}

const btnStandard =
  'h-9 px-4 text-sm font-medium rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

export default function PdfViewer({ open, onClose, title, subtitle, src, onDownload, nav }: PdfViewerProps) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = onDownload
    ? async () => {
        setDownloading(true)
        try {
          await onDownload()
        } finally {
          setDownloading(false)
        }
      }
    : undefined

  // ← / → move between documents (ignored while typing in an input)
  useEffect(() => {
    if (!open || !nav) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowLeft' && nav.index > 0) nav.onPrev()
      if (e.key === 'ArrowRight' && nav.index < nav.total - 1) nav.onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, nav])

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed z-50 inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                     sm:w-[min(1100px,94vw)] sm:h-[92vh] bg-white sm:rounded-lg shadow-2xl flex flex-col overflow-hidden
                     focus:outline-none"
        >
          {/* Header (title bar) */}
          <div className="flex items-center gap-3 h-12 px-4 border-b border-[#D9D9D9] flex-shrink-0">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold text-[#32363A] truncate leading-tight">
                {title}
              </Dialog.Title>
              {subtitle && <p className="text-xs text-[#6A6D70] truncate leading-tight">{subtitle}</p>}
            </div>

            {nav && nav.total > 1 && (
              <div className="flex items-center gap-1 text-sm text-[#32363A]">
                <button
                  onClick={nav.onPrev}
                  disabled={nav.index <= 0}
                  className="p-1.5 rounded hover:bg-[#EBF5FE] text-[#0070F2] disabled:text-[#C4C4C4] disabled:hover:bg-transparent"
                  title="เอกสารก่อนหน้า (←)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="tabular-nums whitespace-nowrap px-1">
                  {nav.index + 1} / {nav.total}
                </span>
                <button
                  onClick={nav.onNext}
                  disabled={nav.index >= nav.total - 1}
                  className="p-1.5 rounded hover:bg-[#EBF5FE] text-[#0070F2] disabled:text-[#C4C4C4] disabled:hover:bg-transparent"
                  title="เอกสารถัดไป (→)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <Dialog.Close className="p-1.5 rounded text-[#6A6D70] hover:bg-[#F5F5F5] hover:text-[#32363A] sm:hidden" aria-label="ปิด">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 bg-[#F7F7F7]">
            {src ? <PdfFrame key={src} src={src} title={title} /> : <ErrorState onDownload={handleDownload} />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 h-12 px-4 border-t border-[#D9D9D9] bg-white flex-shrink-0">
            {handleDownload && src && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className={clsx(btnStandard, 'inline-flex items-center gap-1.5 text-white bg-[#0070F2] border-[#0070F2] hover:bg-[#0064D9]')}
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                ดาวน์โหลด
              </button>
            )}
            <Dialog.Close className={clsx(btnStandard, 'text-[#0070F2] bg-white border-[#0070F2] hover:bg-[#EBF5FE]')}>
              ปิด
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
