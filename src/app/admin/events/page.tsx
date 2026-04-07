'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatShortDate } from '@/lib/date'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Plus, Edit, Trash2, LayoutGrid, Eye, EyeOff, Loader2, Calendar, X, Banknote, Map, CheckCircle2, Video
} from 'lucide-react'

interface EventData {
  id: string
  title: string
  category: string
  showDate: string
  location: string
  isPublished: boolean
  priceCategories: Array<{ id: string; name: string; price: number; colorCode: string }>
  seatSummary?: { total: number; available: number; sold: number }
  seatMapId: string | null
  showDates?: Array<{ id: string; date: string; openGate: string | null; label: string | null }>
  posterUrl?: string | null
  synopsis?: string
  teaserVideoUrl?: string | null
  adminFee?: number
}

interface SeatMapOption {
  id: string
  name: string
  seatType: string
}

interface EventFormData {
  title: string
  category: string
  showDate: string
  openGate: string
  location: string
  posterUrl: string
  teaserVideoUrl: string
  synopsis: string
  isPublished: boolean
  adminFee: number
  priceCategories: Array<{ id?: string; name: string; price: number; colorCode: string }>
  showDates: Array<{ id?: string; date: string; openGate: string; label: string }>
}

const emptyForm: EventFormData = {
  title: '',
  category: 'Teater',
  showDate: '',
  openGate: '',
  location: '',
  posterUrl: '',
  teaserVideoUrl: '',
  synopsis: '',
  isPublished: false,
  adminFee: 0,
  priceCategories: [
    { name: 'VIP', price: 150000, colorCode: '#C8A951' },
    { name: 'Regular', price: 75000, colorCode: '#8B8680' },
    { name: 'Student', price: 35000, colorCode: '#7BA7A5' },
  ],
  showDates: [{ date: '', openGate: '', label: '' }],
}

export default function AdminEventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<EventData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<EventFormData>(emptyForm)

  // Generate seats dialog state
  const [isGenDialogOpen, setIsGenDialogOpen] = useState(false)
  const [genEventId, setGenEventId] = useState<string | null>(null)
  const [genEventTitle, setGenEventTitle] = useState('')
  const [seatMaps, setSeatMaps] = useState<SeatMapOption[]>([])
  const [selectedSeatMapId, setSelectedSeatMapId] = useState('')
  const [isLoadingMaps, setIsLoadingMaps] = useState(false)
  const [isGeneratingSeats, setIsGeneratingSeats] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    try {
      const res = await fetch('/api/admin/events')
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
      }
    } catch (err) {
      console.error('Failed to fetch events:', err)
    } finally {
      setIsLoading(false)
    }
  }

  function openCreateDialog() {
    setEditingId(null)
    setFormData(emptyForm)
    setIsDialogOpen(true)
  }

  function openEditDialog(event: EventData) {
    setEditingId(event.id)
    setFormData({
      title: event.title,
      category: event.category,
      showDate: new Date(event.showDate).toISOString().slice(0, 16),
      openGate: event.showDates?.[0]?.openGate ? new Date(event.showDates[0].openGate).toISOString().slice(0, 16) : '',
      location: event.location,
      posterUrl: event.posterUrl || '',
      teaserVideoUrl: event.teaserVideoUrl || '',
      synopsis: event.synopsis || '',
      isPublished: event.isPublished,
      adminFee: event.adminFee || 0,
      priceCategories: event.priceCategories.map((pc) => ({
        id: pc.id,
        name: pc.name,
        price: pc.price,
        colorCode: pc.colorCode,
      })),
      showDates: (event.showDates && event.showDates.length > 0)
        ? event.showDates.map((sd) => ({
            id: sd.id,
            date: new Date(sd.date).toISOString().slice(0, 16),
            openGate: sd.openGate ? new Date(sd.openGate).toISOString().slice(0, 16) : '',
            label: sd.label || '',
          }))
        : [{ date: new Date(event.showDate).toISOString().slice(0, 16), openGate: '', label: '' }],
    })
    setIsDialogOpen(true)
  }

  function updatePriceCategory(index: number, field: string, value: string | number) {
    setFormData((prev) => {
      const updated = [...prev.priceCategories]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, priceCategories: updated }
    })
  }

  function addPriceCategory() {
    setFormData((prev) => ({
      ...prev,
      priceCategories: [...prev.priceCategories, { name: '', price: 0, colorCode: '#8B8680' }],
    }))
  }

  function removePriceCategory(index: number) {
    setFormData((prev) => ({
      ...prev,
      priceCategories: prev.priceCategories.filter((_, i) => i !== index),
    }))
  }

    function addShowDate() {
      setFormData((prev) => ({
        ...prev,
        showDates: [...prev.showDates, { date: '', openGate: '', label: `Hari ${prev.showDates.length + 1}` }],
      }))
    }

    function removeShowDate(index: number) {
      setFormData((prev) => ({
        ...prev,
        showDates: prev.showDates.filter((_, i) => i !== index),
      }))
    }

    function updateShowDate(index: number, field: string, value: string) {
      setFormData((prev) => {
        const updated = [...prev.showDates]
        updated[index] = { ...updated[index], [field]: value }
        return { ...prev, showDates: updated }
      })
    }

  async function handleSave() {
    setIsSaving(true)
    try {
      const url = editingId ? `/api/admin/events/${editingId}` : '/api/admin/events'
      const method = editingId ? 'PUT' : 'POST'

      const payload = {
        ...formData,
        // Use first showDate entry as the primary showDate (backward compat)
        showDate: formData.showDates[0]?.date
          ? new Date(formData.showDates[0].date).toISOString()
          : new Date().toISOString(),
        openGate: formData.showDates[0]?.openGate
          ? new Date(formData.showDates[0].openGate).toISOString()
          : null,
        showDates: formData.showDates.filter((sd) => sd.date),
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setIsDialogOpen(false)
        fetchEvents()
      } else {
        const data = await res.json()
        alert(data.error || 'Gagal menyimpan event')
      }
    } catch (err) {
      console.error('Save error:', err)
      alert('Terjadi kesalahan')
    } finally {
      setIsSaving(false)
    }
  }

  const [isSaving, setIsSaving] = useState(false)

  async function handleDelete(id: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus event ini? Semua data terkait akan dihapus.')) return

    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchEvents()
      }
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  async function handleTogglePublish(event: EventData) {
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...event, isPublished: !event.isPublished }),
      })
      if (res.ok) fetchEvents()
    } catch (err) {
      console.error('Toggle publish error:', err)
    }
  }

  // ─── Generate Seats from Seat Map ────────────────────────────────────

  function openGenerateDialog(eventId: string, eventTitle: string, currentSeatMapId: string | null) {
    setGenEventId(eventId)
    setGenEventTitle(eventTitle)
    setSelectedSeatMapId(currentSeatMapId || '')
    setIsGenDialogOpen(true)

    // Fetch available seat maps
    setIsLoadingMaps(true)
    fetch('/api/admin/seat-maps')
      .then((res) => res.ok ? res.json() : { seatMaps: [] })
      .then((data) => setSeatMaps(data.seatMaps || []))
      .catch(() => setSeatMaps([]))
      .finally(() => setIsLoadingMaps(false))
  }

  async function handleGenerateSeats() {
    if (!genEventId || !selectedSeatMapId) return

    // If event already has seats, confirm deletion first
    const currentSeats = genEvent?.seatSummary?.total || 0
    if (currentSeats > 0) {
      const confirmed = confirm(
        `Event ini sudah punya ${currentSeats} kursi.\n\nKursi lama akan dihapus dan diganti dengan yang baru dari seat map yang dipilih.\nLanjutkan?`
      )
      if (!confirmed) return
    }

    setIsGeneratingSeats(true)
    try {
      // Delete existing seats first if any
      if (currentSeats > 0) {
        const delRes = await fetch(`/api/admin/events/${genEventId}/seats`, { method: 'DELETE' })
        if (!delRes.ok) {
          const delData = await delRes.json()
          alert(delData.error || 'Gagal menghapus kursi lama')
          setIsGeneratingSeats(false)
          return
        }
      }

      const res = await fetch(`/api/admin/events/${genEventId}/generate-seats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatMapId: selectedSeatMapId }),
      })

      if (res.ok) {
        const data = await res.json()
        alert(`${data.message}`)
        setIsGenDialogOpen(false)
        fetchEvents()
      } else {
        const data = await res.json()
        alert(data.error || 'Gagal generate kursi')
      }
    } catch (err) {
      console.error('Generate seats error:', err)
      alert('Terjadi kesalahan')
    } finally {
      setIsGeneratingSeats(false)
    }
  }

  // ─── Get selected seat map info ──────────────────────────────────────

  const selectedMap = seatMaps.find((m) => m.id === selectedSeatMapId)
  const genEvent = events.find((e) => e.id === genEventId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-charcoal">Events</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola pertunjukan teater</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-charcoal hover:bg-charcoal/90 text-gold">
          <Plus className="w-4 h-4 mr-2" />
          Buat Event
        </Button>
      </div>

      {/* Events Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-gold animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">Belum ada event</p>
              <Button onClick={openCreateDialog} variant="outline" size="sm" className="mt-4">
                <Plus className="w-3 h-3 mr-1" />
                Buat Event Pertama
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Judul</TableHead>
                  <TableHead className="text-xs">Seat Map</TableHead>
                  <TableHead className="text-xs">Tanggal</TableHead>
                  <TableHead className="text-xs">Kursi</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <Link href={`/events/${event.id}`} className="font-medium text-charcoal hover:text-gold transition-colors">
                        {event.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{event.location}</p>
                    </TableCell>
                    <TableCell>
                      {event.seatSummary && event.seatSummary.total > 0 ? (
                        <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {event.seatSummary.total} kursi
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Belum generate
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {event.showDates && event.showDates.length > 1 ? (
                        <div className="flex flex-col gap-0.5">
                          <span>{formatShortDate(event.showDate)}</span>
                          <Badge variant="secondary" className="text-[9px] bg-gold/10 text-gold-dark w-fit">Multi-hari</Badge>
                        </div>
                      ) : (
                        formatShortDate(event.showDate)
                      )}
                    </TableCell>
                    <TableCell>
                      {event.seatSummary && event.seatSummary.total > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {event.seatSummary.available}/{event.seatSummary.total}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${event.isPublished ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}
                      >
                        {event.isPublished ? 'Published' : 'Draft'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          asChild
                          title="Seat Editor"
                        >
                          <Link href={`/admin/events/${event.id}/seats`}>
                            <LayoutGrid className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'h-8 w-8',
                            event.seatSummary && event.seatSummary.total > 0
                              ? 'text-amber-500 hover:text-amber-600'
                              : 'text-gold'
                          )}
                          onClick={() => openGenerateDialog(event.id, event.title, event.seatMapId)}
                          title={
                            event.seatSummary && event.seatSummary.total > 0
                              ? 'Regenerate Kursi (hapus & ganti)'
                              : 'Generate Kursi dari Seat Map'
                          }
                        >
                          <Map className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleTogglePublish(event)}
                          title={event.isPublished ? 'Unpublish' : 'Publish'}
                        >
                          {event.isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(event)}
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-danger"
                          onClick={() => handleDelete(event.id)}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Event Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">
              {editingId ? 'Edit Event' : 'Buat Event Baru'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Judul Event *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Contoh: Hamlet - Pertunjukan Spesial"
              />
            </div>

            {/* Category & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Kategori</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Teater"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Lokasi *</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Teateran, Jakarta"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Jadwal Pertunjukan *</Label>
                <Button variant="outline" size="sm" onClick={addShowDate} className="text-xs h-7">
                  <Plus className="w-3 h-3 mr-1" />
                  Tambah Hari
                </Button>
              </div>
              {formData.showDates.map((sd, idx) => (
                <div key={idx} className="relative rounded-lg border border-border/60 p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {formData.showDates.length > 1 ? `Hari ${idx + 1}` : 'Tanggal & Waktu'}
                    </span>
                    {idx > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => removeShowDate(idx)} className="h-6 w-6 p-0 text-danger hover:text-danger hover:bg-danger/10">
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Label</Label>
                      <Input
                        value={sd.label}
                        onChange={(e) => updateShowDate(idx, 'label', e.target.value)}
                        placeholder="contoh: Premiere, Gala..."
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Buka Pintu</Label>
                      <Input
                        type="datetime-local"
                        value={sd.openGate}
                        onChange={(e) => updateShowDate(idx, 'openGate', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tanggal & Waktu Tayang *</Label>
                    <Input
                      type="datetime-local"
                      value={sd.date}
                      onChange={(e) => updateShowDate(idx, 'date', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Poster URL */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">URL Poster (opsional)</Label>
              <Input
                value={formData.posterUrl}
                onChange={(e) => setFormData({ ...formData, posterUrl: e.target.value })}
                placeholder="https://example.com/poster.jpg"
              />
            </div>

            {/* Teaser Video URL */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Video className="w-4 h-4 text-gold" />
                URL Video Teaser (opsional)
              </Label>
              <Input
                value={formData.teaserVideoUrl}
                onChange={(e) => setFormData({ ...formData, teaserVideoUrl: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <p className="text-xs text-muted-foreground">Mendukung YouTube dan Vimeo. Video akan ditampilkan di halaman publik event.</p>
            </div>

            {/* Synopsis */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Sinopsis</Label>
              <Textarea
                value={formData.synopsis}
                onChange={(e) => setFormData({ ...formData, synopsis: e.target.value })}
                placeholder="Deskripsi singkat pertunjukan..."
                rows={4}
              />
            </div>

            {/* Admin Fee */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Banknote className="w-4 h-4 text-gold" />
                Biaya Admin per Tiket (Rp)
              </Label>
              <Input
                type="number"
                value={formData.adminFee}
                onChange={(e) => setFormData({ ...formData, adminFee: Number(e.target.value) || 0 })}
                placeholder="0"
                className="bg-white"
              />
              <p className="text-xs text-muted-foreground">Biaya tambahan per tiket. Set 0 jika tidak ada biaya admin.</p>
            </div>

            <Separator />

            {/* Price Categories */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Kategori Harga</Label>
                <Button variant="outline" size="sm" onClick={addPriceCategory}>
                  <Plus className="w-3 h-3 mr-1" />
                  Tambah
                </Button>
              </div>

              {formData.priceCategories.map((pc, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Nama</Label>
                    <Input
                      value={pc.name}
                      onChange={(e) => updatePriceCategory(index, 'name', e.target.value)}
                      placeholder="VIP"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Harga (Rp)</Label>
                    <Input
                      type="number"
                      value={pc.price}
                      onChange={(e) => updatePriceCategory(index, 'price', Number(e.target.value))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="w-16">
                    <Label className="text-xs text-muted-foreground">Warna</Label>
                    <Input
                      type="color"
                      value={pc.colorCode}
                      onChange={(e) => updatePriceCategory(index, 'colorCode', e.target.value)}
                      className="h-9 p-1"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-danger"
                    onClick={() => removePriceCategory(index)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="text-sm">Batal</Button>
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={isSaving || !formData.title || !formData.location || !formData.showDates.some(sd => sd.date)}
              className="bg-charcoal hover:bg-charcoal/90 text-gold text-sm"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingId ? 'Simpan Perubahan' : 'Buat Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Seats Dialog */}
      <Dialog open={isGenDialogOpen} onOpenChange={setIsGenDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg flex items-center gap-2">
              <Map className="w-5 h-5 text-gold" />
              Generate Kursi
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Event info */}
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Event</p>
              <p className="text-sm font-medium text-charcoal">{genEventTitle}</p>
              {genEvent?.seatSummary && genEvent.seatSummary.total > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Kursi lama ({genEvent.seatSummary.total} kursi) akan dihapus dan diganti dengan yang baru.
                </p>
              )}
            </div>

            {/* Seat map selector — always show */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Pilih Seat Map *</Label>
              {isLoadingMaps ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-gold" />
                  Memuat seat maps...
                </div>
              ) : seatMaps.length === 0 ? (
                <div className="text-sm text-muted-foreground py-3 text-center bg-muted/30 rounded-lg">
                  Belum ada seat map.{' '}
                  <Link href="/admin/seat-maps/new/edit" className="text-gold underline" onClick={() => setIsGenDialogOpen(false)}>
                    Buat Seat Map dulu
                  </Link>
                </div>
              ) : (
                <Select value={selectedSeatMapId} onValueChange={setSelectedSeatMapId}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Pilih seat map..." />
                  </SelectTrigger>
                  <SelectContent>
                    {seatMaps.map((map) => (
                      <SelectItem key={map.id} value={map.id}>
                        <div className="flex items-center gap-2">
                          <Map className="w-3.5 h-3.5 text-gold" />
                          <span>{map.name}</span>
                          <Badge variant="secondary" className="text-[10px] ml-auto">
                            {map.seatType === 'NUMBERED' ? 'Kursi Nomor' : 'Bebas Duduk'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedMap && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-success" />
                Seat map: <strong>{selectedMap.name}</strong> ({selectedMap.seatType === 'NUMBERED' ? 'Kursi Nomor' : 'General Admission'})
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Kursi akan di-generate sesuai layout seat map yang dipilih. Pastikan kategori harga di event cocok dengan section di seat map.
            </p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="text-sm">Batal</Button>
            </DialogClose>
            <Button
              onClick={handleGenerateSeats}
              disabled={isGeneratingSeats || !selectedSeatMapId}
              className="bg-charcoal hover:bg-charcoal/90 text-gold text-sm"
            >
              {isGeneratingSeats ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  Generate Kursi
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
