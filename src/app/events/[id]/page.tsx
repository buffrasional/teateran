'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { SeatMap } from '@/components/seat-map'
import { CheckoutForm } from '@/components/checkout-form'
import { Badge } from '@/components/ui/badge'
import { formatEventDate, formatEventTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Calendar, MapPin, Clock, Tag,
  Crown, User, GraduationCap, Loader2, AlertTriangle, ShieldCheck, Play
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface EventData {
  id: string
  title: string
  category: string
  showDate: string
  openGate: string | null
  location: string
  posterUrl: string | null
  teaserVideoUrl: string | null
  synopsis: string
  isPublished: boolean
  priceCategories: Array<{ id: string; name: string; price: number; colorCode: string }>
  seatSummary: { total: number; available: number; sold: number }
  seatMapLayout?: any
  showDates?: Array<{ id: string; date: string; openGate: string | null; label: string | null }>
}

interface SeatData {
  id: string
  seatCode: string
  status: string
  row: string
  col: number
  priceCategory: { id: string; name: string; price: number; colorCode: string } | null
  lockedUntil: string | null
  eventShowDateId?: string | null
}

const CATEGORY_ICONS: Record<string, typeof Crown> = {
  VIP: Crown,
  Regular: User,
  Student: GraduationCap,
}

/** Convert various video URLs to embeddable iframe URLs. Returns null if unparseable. */
function getEmbedUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null

  const trimmed = url.trim()

  // YouTube: https://www.youtube.com/watch?v=XXXXX
  let match = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (match) return `https://www.youtube.com/embed/${match[1]}`

  // YouTube Shorts: https://www.youtube.com/shorts/XXXXX
  match = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/)
  if (match) return `https://www.youtube.com/embed/${match[1]}`

  // youtu.be: https://youtu.be/XXXXX
  match = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (match) return `https://www.youtube.com/embed/${match[1]}`

  // YouTube embed (already embeddable): https://www.youtube.com/embed/XXXXX
  match = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
  if (match) return trimmed

  // Vimeo: https://vimeo.com/XXXXX
  match = trimmed.match(/vimeo\.com\/(\d+)/)
  if (match) return `https://player.vimeo.com/video/${match[1]}`

  return null
}

export default function EventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string

  const [event, setEvent] = useState<EventData | null>(null)
  const [allSeats, setAllSeats] = useState<SeatData[]>([])
  const [selectedSeats, setSelectedSeats] = useState<SeatData[]>([])
  const [totalPrice, setTotalPrice] = useState(0)
  const [showCheckout, setShowCheckout] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedShowDateIdx, setSelectedShowDateIdx] = useState(0)

  // Fetch event data (without seats — seats are fetched per show date below)
  useEffect(() => {
    async function fetchEvent() {
      try {
        setIsLoading(true)
        const eventRes = await fetch(`/api/events/${eventId}`)
        if (!eventRes.ok) {
          setError('Event tidak ditemukan')
          setIsLoading(false)
          return
        }
        const eventData = await eventRes.json()
        setEvent(eventData)
      } catch (err) {
        console.error('Fetch error:', err)
        setError('Gagal memuat data')
      } finally {
        setIsLoading(false)
      }
    }
    if (eventId) fetchEvent()
  }, [eventId])

  // Show dates with fallback
  const showDates = useMemo(() =>
    event?.showDates && event.showDates.length > 0
      ? event.showDates
      : [{ id: null, date: event?.showDate, openGate: event?.openGate, label: null }],
    [event]
  )

  const activeShowDate = showDates[selectedShowDateIdx] || showDates[0]

  // Fetch seats filtered by active show date — runs on mount AND when show date changes.
  // This is the ONLY place seats are fetched (no separate initial fetch),
  // preventing race conditions between unfiltered and filtered seat data.
  useEffect(() => {
    if (!eventId || !event) return
    let cancelled = false
    async function fetchSeatsByDate() {
      setAllSeats([]) // Clear immediately so stale data never shows
      try {
        const url = activeShowDate?.id 
          ? `/api/events/${eventId}/seats?showDateId=${activeShowDate.id}`
          : `/api/events/${eventId}/seats`
        const res = await fetch(url)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) setAllSeats(data.seats || [])
      } catch (err) {
        console.error('Fetch seats by date error:', err)
      }
    }
    fetchSeatsByDate()
    return () => { cancelled = true }
  }, [activeShowDate?.id, eventId, event])

  // Seats are already filtered server-side by showDateId — use directly
  const filteredSeats = allSeats

  // Seat summary for the active show date
  const seatSummary = useMemo(() => {
    const total = filteredSeats.length
    const available = filteredSeats.filter(s => s.status === 'AVAILABLE').length
    const sold = filteredSeats.filter(s => s.status === 'SOLD').length
    return { total, available, sold }
  }, [filteredSeats])

  // Reset selection when switching show dates
  useEffect(() => {
    setSelectedSeats([])
    setTotalPrice(0)
    setShowCheckout(false)
  }, [selectedShowDateIdx])

  const handleSelectionChange = useCallback((newSelectedSeats: SeatData[], newTotalPrice: number) => {
    setSelectedSeats(newSelectedSeats)
    setTotalPrice(newTotalPrice)
  }, [])

  const handleProceedToCheckout = () => {
    setShowCheckout(true)
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  const handleBackToSeats = () => {
    setShowCheckout(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-gold animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">{error || 'Event tidak ditemukan'}</p>
            <Button variant="outline" onClick={() => router.push('/')} className="mt-4">
              Kembali ke Beranda
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const dateStr = formatEventDate(event.showDate)
  const timeStr = formatEventTime(event.showDate)
  const activeDateStr = activeShowDate ? formatEventDate(activeShowDate.date) : dateStr
  const activeTimeStr = activeShowDate ? formatEventTime(activeShowDate.date) : timeStr
  const activeGateTimeStr = activeShowDate?.openGate ? formatEventTime(activeShowDate.openGate) : null

  const availablePercent = seatSummary.total > 0
    ? Math.round((seatSummary.available / seatSummary.total) * 100)
    : 0

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 pt-16">
        {/* Event Header */}
        <section className="bg-charcoal text-white py-12 sm:py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Poster */}
              <div className="lg:w-1/3 shrink-0">
                <div className="aspect-[3/4] rounded-xl overflow-hidden shadow-2xl bg-charcoal/50">
                  {event.posterUrl ? (
                    <img src={event.posterUrl} alt={event.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-charcoal to-charcoal/60">
                      <span className="font-serif text-gold text-5xl">{event.title.charAt(0)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="lg:w-2/3">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className="bg-gold/20 text-gold text-xs">
                    <Tag className="w-3 h-3 mr-1" />
                    {event.category}
                  </Badge>
                  {event.isPublished && (
                    <Badge variant="secondary" className="bg-success/20 text-success text-xs">
                      Aktif
                    </Badge>
                  )}
                  {showDates.length > 1 && (
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 text-xs">
                      Multi-Hari
                    </Badge>
                  )}
                </div>

                <h1 className="font-serif text-3xl sm:text-4xl font-bold mb-4">
                  {event.title}
                </h1>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Calendar className="w-4 h-4 text-gold" />
                    <span>{activeDateStr}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Clock className="w-4 h-4 text-gold" />
                    <span>Start: {activeTimeStr}</span>
                    {activeGateTimeStr && <span>• Buka Pintu: {activeGateTimeStr}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <MapPin className="w-4 h-4 text-gold" />
                    <span>{event.location}</span>
                  </div>
                </div>

                {/* Multi-day show dates tabs */}
                {showDates.length > 1 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {showDates.map((sd, idx) => (
                      <button
                        key={sd.id || idx}
                        onClick={() => setSelectedShowDateIdx(idx)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                          idx === selectedShowDateIdx
                            ? 'bg-gold text-charcoal'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                        )}
                      >
                        {sd.label || `Hari ${idx + 1}`}
                      </button>
                    ))}
                  </div>
                )}

                <div className="bg-white/5 rounded-lg p-4 mb-6">
                  <h3 className="font-serif text-sm text-gold mb-2">Sinopsis</h3>
                  <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">
                    {event.synopsis}
                  </p>
                </div>

                {/* Teaser Video */}
                {event.teaserVideoUrl && getEmbedUrl(event.teaserVideoUrl) && (
                  <div className="bg-white/5 rounded-lg p-4 mb-6 border border-gold/10">
                    <h3 className="font-serif text-sm text-gold mb-3 flex items-center gap-2">
                      <Play className="w-4 h-4" />
                      Video Teaser
                    </h3>
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                      <iframe
                        className="absolute inset-0 w-full h-full rounded-lg"
                        src={getEmbedUrl(event.teaserVideoUrl)!}
                        title={`Teaser - ${event.title}`}
                        frameBorder="0"
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}

                <div className="bg-white/5 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/70">Ketersediaan Kursi</span>
                    <span className="text-sm font-semibold text-gold">
                      {seatSummary.available} / {seatSummary.total}
                    </span>
                  </div>
                  <Progress value={availablePercent} className="h-2 bg-white/10" />
                  <div className="flex justify-between mt-2 text-xs text-white/40">
                    <span>{availablePercent}% tersedia</span>
                    <span>{seatSummary.sold} terjual</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-4">
                  {event.priceCategories.map((pc) => {
                    const Icon = CATEGORY_ICONS[pc.name] || User
                    return (
                      <Card key={pc.id} className="bg-white/5 border-white/10 flex-1 min-w-[140px]">
                        <CardContent className="p-3 flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: pc.colorCode + '30' }}
                          >
                            <Icon className="w-4 h-4" style={{ color: pc.colorCode }} />
                          </div>
                          <div>
                            <p className="text-xs text-white/60">{pc.name}</p>
                            <p className="text-sm font-semibold text-white">
                              Rp {pc.price.toLocaleString('id-ID')}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Seat Selection */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 abstract-bg">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-gold text-xs tracking-[0.3em] uppercase font-medium mb-2">Pilih kursi Anda</p>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal">
                PILIH KURSI
              </h2>
              <div className="zen-divider w-16 mx-auto mt-4" />
            </div>

            {!showCheckout ? (
              <SeatMap
                key={activeShowDate?.id || 'default'}
                eventId={eventId}
                showDateId={activeShowDate?.id || null}
                seats={filteredSeats}
                priceCategories={event.priceCategories}
                layoutData={event.seatMapLayout}
                onSelectionChange={handleSelectionChange}
                onProceedToCheckout={handleProceedToCheckout}
              />
            ) : (
              <CheckoutForm
                eventId={eventId}
                showDateId={activeShowDate?.id || null}
                selectedSeats={selectedSeats}
                totalPrice={totalPrice}
                onBack={handleBackToSeats}
              />
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
