'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function UsherPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/usher/events')
  }, [router])

  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-6 h-6 border-2 border-gold border-t-transparent rounded-full" />
    </div>
  )
}
