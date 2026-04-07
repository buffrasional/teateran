'use client'

import Link from 'next/link'
import { Calendar, MapPin, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatEventDate, formatEventTime } from '@/lib/date'

interface EventCardProps {
  id: string
  title: string
  category: string
  showDate: string
  location: string
  posterUrl?: string | null
  synopsis: string
  priceCategories: Array<{ name: string; price: number; colorCode: string }>
  seatSummary: { total: number; available: number; sold: number }
  isPublished?: boolean
}

export function EventCard({
  id,
  title,
  category,
  showDate,
  location,
  posterUrl,
  synopsis,
  priceCategories,
  seatSummary,
  isPublished = true,
}: EventCardProps) {
  const dateStr = formatEventDate(showDate)
  const timeStr = formatEventTime(showDate)

  const minPrice = priceCategories.length > 0
    ? Math.min(...priceCategories.map((pc) => pc.price))
    : 0
  const maxPrice = priceCategories.length > 0
    ? Math.max(...priceCategories.map((pc) => pc.price))
    : 0

  const priceRange = minPrice === maxPrice
    ? `Rp ${minPrice.toLocaleString('id-ID')}`
    : `Rp ${minPrice.toLocaleString('id-ID')} - ${maxPrice.toLocaleString('id-ID')}`

  return (
    <Link href={`/events/${id}`}>
      <Card className="group overflow-hidden border-border/50 hover:border-gold/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-white">
        {/* Poster */}
        <div className="relative aspect-[3/4] overflow-hidden bg-warm-white">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-charcoal to-charcoal/80">
              <span className="font-serif text-gold text-3xl">{title.charAt(0)}</span>
            </div>
          )}

          {/* Category Badge */}
          <div className="absolute top-3 left-3">
            <Badge variant="secondary" className="bg-charcoal/80 text-gold text-xs backdrop-blur-sm">
              <Tag className="w-3 h-3 mr-1" />
              {category}
            </Badge>
          </div>

          {/* Available seats indicator */}
          {seatSummary.total > 0 && (
            <div className="absolute top-3 right-3">
              <Badge
                variant="secondary"
                className={`text-xs backdrop-blur-sm ${
                  seatSummary.available === 0
                    ? 'bg-red-500/80 text-white'
                    : seatSummary.available < 10
                    ? 'bg-yellow-500/80 text-white'
                    : 'bg-success/80 text-white'
                }`}
              >
                {seatSummary.available === 0
                  ? 'Habis'
                  : `${seatSummary.available} kursi`}
              </Badge>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Bottom info on poster */}
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="font-serif text-white text-lg font-semibold line-clamp-2 drop-shadow-md">
              {title}
            </h3>
          </div>
        </div>

        <CardContent className="p-4 space-y-3">
          {/* Date & Location */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 text-gold shrink-0" />
              <span className="truncate">{dateStr} • {timeStr}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 text-gold shrink-0" />
              <span className="truncate">{location}</span>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center justify-between">
            <span className="font-serif text-sm font-semibold text-charcoal">{priceRange}</span>
            <span className="text-xs text-muted-foreground">per kursi</span>
          </div>

          {/* Price Categories Pills */}
          <div className="flex flex-wrap gap-1.5">
            {priceCategories.map((pc) => (
              <span
                key={pc.name}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                style={{ backgroundColor: pc.colorCode || '#8B8680' }}
              >
                {pc.name}
              </span>
            ))}
          </div>

          {/* CTA */}
          {!isPublished && (
            <p className="text-xs text-muted-foreground italic">Belum dipublikasi</p>
          )}
          {isPublished && seatSummary.available > 0 && (
            <Button className="w-full bg-charcoal hover:bg-charcoal/90 text-gold text-sm font-medium">
              Beli Tiket
            </Button>
          )}
          {isPublished && seatSummary.available === 0 && (
            <Button disabled className="w-full text-sm">
              Tiket Habis
            </Button>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
