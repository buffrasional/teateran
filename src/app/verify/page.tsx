'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Ticket, Search, Loader2 } from 'lucide-react'

export default function VerifyPage() {
  const router = useRouter()
  const [transactionId, setTransactionId] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const id = transactionId.trim()
    if (!id) return
    setIsLoading(true)
    router.push(`/verify/${id}`)
  }

  return (
    <div className="min-h-screen flex flex-col bg-warm-white">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Icon */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-charcoal mb-4">
              <Ticket className="w-8 h-8 text-gold" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-charcoal">
              Cek <span className="text-gold">Tiket</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Masukkan kode transaksi untuk memverifikasi e-ticket Anda
            </p>
          </div>

          <Card className="border-border/50">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="trxId" className="text-sm font-medium">
                    Kode Transaksi
                  </Label>
                  <div className="relative">
                    <Input
                      id="trxId"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
                      placeholder="Contoh: TRX-XXXXXXXX"
                      className="bg-white font-mono uppercase"
                      maxLength={20}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground/60">
                    Kode transaksi terdapat di email konfirmasi pembelian tiket Anda
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !transactionId.trim()}
                  className="w-full bg-charcoal hover:bg-charcoal/90 text-gold font-semibold"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  Cek Tiket
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
