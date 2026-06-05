'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function Redirector() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const params = searchParams.toString()
    router.replace(`/admin/lazada/callback${params ? `?${params}` : ''}`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
    </div>
  )
}

export default function TestRedirectPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>}>
      <Redirector />
    </Suspense>
  )
}
