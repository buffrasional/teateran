import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { EventCard } from '@/components/event-card'
import { db } from '@/lib/db'
import { formatEventDate } from '@/lib/date'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  // Separate queries — NO include (crashes Next.js 16)
  const events = await db.event.findMany({
    where: { isPublished: true },
    orderBy: { showDate: 'asc' },
  })

  const eventIds = events.map((e) => e.id)
  const priceCategories = await db.priceCategory.findMany({ where: { eventId: { in: eventIds } } })
  const seats = await db.seat.findMany({ where: { eventId: { in: eventIds } }, select: { eventId: true, status: true } })

  const now = new Date()
  const nowShowing = events.filter((e) => new Date(e.showDate) >= now)
  const comingSoon = events.filter((e) => new Date(e.showDate) < now)

  const eventsWithSummary = (evts: typeof nowShowing) =>
    evts.map((event) => {
      const eventSeats = seats.filter((s) => s.eventId === event.id)
      const eventPriceCats = priceCategories.filter((pc) => pc.eventId === event.id)
      return {
        id: event.id,
        title: event.title,
        category: event.category,
        showDate: event.showDate.toISOString(),
        openGate: event.openGate?.toISOString(),
        location: event.location,
        posterUrl: event.posterUrl,
        synopsis: event.synopsis,
        isPublished: event.isPublished,
        priceCategories: eventPriceCats,
        seatSummary: {
          total: eventSeats.length,
          available: eventSeats.filter((s) => s.status === 'AVAILABLE').length,
          sold: eventSeats.filter((s) => s.status === 'SOLD').length,
        },
      }
    })

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-16">
        <div className="relative h-[70vh] min-h-[500px] bg-charcoal overflow-hidden">
          {/* Abstract background */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-charcoal via-charcoal/95 to-charcoal/90" />
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-seat-student/5 rounded-full blur-3xl" />
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center">
            <p className="text-gold/60 text-xs tracking-[0.4em] uppercase mb-4 font-medium">
              Official Ticketing Platform
            </p>
            <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-4">
              TEATERAN
            </h1>
            <div className="zen-divider w-24 mb-6" />
            <p className="text-white/50 text-sm sm:text-base max-w-md leading-relaxed">
              Pengalaman teater terbaik dengan pemesanan tiket yang elegan dan modern
            </p>

            {/* Featured Event */}
            {nowShowing.length > 0 && (
              <div className="mt-10 animate-fade-in">
                <p className="text-gold/60 text-xs tracking-widest uppercase mb-2">Sedang Tayang</p>
                <h2 className="font-serif text-2xl sm:text-3xl text-white font-semibold">
                  {nowShowing[0].title}
                </h2>
                <p className="text-white/40 text-sm mt-1">
                  {formatEventDate(nowShowing[0].showDate)}
                </p>
                <a
                  href={`/events/${nowShowing[0].id}`}
                  className="inline-flex items-center mt-6 px-6 py-3 bg-gold text-charcoal rounded-full text-sm font-semibold hover:bg-gold-light transition-colors"
                >
                  Beli Tiket Sekarang
                </a>
              </div>
            )}
          </div>

          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>
      </section>

      {/* Now Showing */}
      <section id="now-showing" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 abstract-bg">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-gold text-xs tracking-[0.3em] uppercase font-medium mb-2">Currently Playing</p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal">
              SEDANG TAYANG
            </h2>
            <div className="zen-divider w-16 mx-auto mt-4" />
          </div>

          {nowShowing.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-sm">Belum ada pertunjukan yang sedang tayang</p>
              <p className="text-muted-foreground/50 text-xs mt-2">Silakan cek kembali nanti</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {eventsWithSummary(nowShowing).map((event) => (
                <EventCard key={event.id} {...event} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Coming Soon */}
      <section id="coming-soon" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-gold text-xs tracking-[0.3em] uppercase font-medium mb-2">Upcoming</p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal">
              SEGERA HADIR
            </h2>
            <div className="zen-divider w-16 mx-auto mt-4" />
          </div>

          {comingSoon.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-sm">Belum ada pertunjukan yang dijadwalkan</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {eventsWithSummary(comingSoon).map((event) => (
                <EventCard key={event.id} {...event} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}
