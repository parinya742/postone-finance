'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

function CallbackHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state') // shop_id

    if (!code || !state) {
      setMessage('ไม่พบ code หรือ state จาก Lazada กรุณาลองใหม่อีกครั้ง')
      setStatus('error')
      return
    }

    api
      .post(`/lazada/shops/${state}/exchange-token`, { code })
      .then((res) => {
        setMessage(`บันทึก Token สำหรับร้าน "${res.data?.shop_name ?? ''}" สำเร็จแล้ว`)
        setStatus('success')
        setTimeout(() => router.push('/admin/lazada/shops'), 2500)
      })
      .catch((err) => {
        const lazadaErr = err?.response?.data?.lazada_error
        const detail = lazadaErr?.message ?? lazadaErr?.code ?? err?.response?.data?.message ?? 'เกิดข้อผิดพลาด'
        setMessage(detail)
        setStatus('error')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-10 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-orange-500 mx-auto mb-4 animate-spin" />
            <p className="text-slate-700 font-medium">กำลังบันทึก Access Token...</p>
            <p className="text-slate-400 text-sm mt-1">กรุณารอสักครู่</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-slate-800 font-semibold text-lg">บันทึก Token สำเร็จ!</p>
            <p className="text-slate-500 text-sm mt-2">{message}</p>
            <p className="text-slate-400 text-xs mt-4">กำลังนำกลับไปหน้าร้านค้า...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-slate-800 font-semibold text-lg">เกิดข้อผิดพลาด</p>
            <p className="text-slate-500 text-sm mt-2 break-all">{message}</p>
            <button
              onClick={() => router.push('/admin/lazada/shops')}
              className="mt-6 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              กลับไปหน้าร้านค้า
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function LazadaCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  )
}
