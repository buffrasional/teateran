'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, MapPin, Users, ChevronRight, ImageOff, Loader2, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EventData {
  id: string
  title: string
  category: string
  showDate: string
  openGate: string | null
  location: string
  posterUrl: string | null
  isPublished: boolean
  seatSummary: {
    total: number
    available: number
    sold: number
  }
}

export default function UsherEventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<EventData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch('/api/events?published=true')
        if (!res.ok) throw new Error('Failed to fetch events')
        const data = await res.json()
        setEvents(data.events || [])
      } catch (err) {
        setError('Gagal memuat daftar event')
      } finally {
        setIsLoading(false)
      }
    }
    fetchEvents()
  }, [])

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-gold animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Memuat daftar event...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-danger text-sm">{error}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.reload()}
          className="mt-3"
        >
          Coba Lagi
        </Button>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-20">
        <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Belum ada event yang dipublikasikan</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-serif text-xl font-bold text-charcoal flex items-center gap-2">
          <Users className="w-5 h-5 text-gold" />
          Database Penonton
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pilih event untuk melihat peta kursi dan data penonton
        </p>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((event) => (
          <Link key={event.id} href={`/admin/usher/events/${event.id}/seats`}>
            <Card className="border-border/50 hover:border-gold/40 hover:shadow-md transition-all duration-200 cursor-pointer group h-full">
              <CardContent className="p-0">
                {/* Poster Thumbnail */}
                <div className="relative aspect-[16/9] bg-charcoal/5 rounded-t-lg overflow-hidden">
                  {event.posterUrl ? (
                    <img
                      src={event.posterUrl}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageOff className="w-8 h-8 text-muted-foreground/20" />
                    </div>
                  )}
                  {/* Category Badge */}
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-charcoal/80 text-white text-[10px] border-0 backdrop-blur-sm">
                      {event.category}
                    </Badge>
                  </div>
                  {/* Sold Count */}
                  <div className="absolute bottom-2 right-2">
                    <Badge className="bg-gold/90 text-charcoal text-[10px] border-0 font-semibold">
                      {event.seatSummary.sold}/{event.seatSummary.total} terjual
                    </Badge>
                  </div>
                </div>

                {/* Event Info */}
                <div className="p-4 space-y-2">
                  <h3 className="font-serif font-semibold text-charcoal text-sm line-clamp-2 group-hover:text-gold-dark transition-colors">
                    {event.title}
                  </h3>

                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs">{formatDate(event.showDate)}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs truncate">{event.location}</span>
                  </div>

                  {/* Seat Summary Bar */}
                  <div className="pt-2">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold rounded-full transition-all"
                        style={{
                          width: event.seatSummary.total > 0
                            ? `${(event.seatSummary.sold / event.seatSummary.total) * 100}%`
                            : '0%'
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {event.seatSummary.available} tersedia
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-gold group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
