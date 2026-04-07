'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Plus, Edit, Trash2, ShoppingBag, Loader2, Package
} from 'lucide-react'

interface EventOption {
  id: string
  title: string
}

interface MerchandiseItem {
  id: string
  eventId: string
  name: string
  description: string
  price: number
  stock: number
  imageUrl: string | null
  createdAt: string
  updatedAt: string
}

interface MerchandiseFormData {
  eventId: string
  name: string
  description: string
  price: number
  stock: number
  imageUrl: string
}

const emptyForm: MerchandiseFormData = {
  eventId: '',
  name: '',
  description: '',
  price: 0,
  stock: 0,
  imageUrl: '',
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200">
        Habis
      </Badge>
    )
  }
  if (stock <= 10) {
    return (
      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
        {stock} tersisa
      </Badge>
    )
  }
  return (
    <Badge className="bg-green-100 text-green-700 border-green-200">
      {stock} tersedia
    </Badge>
  )
}

export default function MerchandiseAdminPage() {
  const [merchandise, setMerchandise] = useState<MerchandiseItem[]>([])
  const [events, setEvents] = useState<EventOption[]>([])
  const [eventMap, setEventMap] = useState<Record<string, string>>({})
  const [filterEventId, setFilterEventId] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<MerchandiseFormData>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchEvents()
    fetchMerchandise()
  }, [])

  useEffect(() => {
    // Fetch on mount, then re-fetch when filter changes
    // Use a ref to skip the initial double-fetch
    const isInitial = events.length === 0
    if (!isInitial || filterEventId === 'all') {
      fetchMerchandise()
    }
  }, [filterEventId])

  async function fetchEvents() {
    try {
      const res = await fetch('/api/admin/events')
      if (res.ok) {
        const data = await res.json()
        const evts: EventOption[] = (data.events || []).map((e: { id: string; title: string }) => ({
          id: e.id,
          title: e.title,
        }))
        setEvents(evts)
        const map: Record<string, string> = {}
        evts.forEach((e) => { map[e.id] = e.title })
        setEventMap(map)
      }
    } catch (err) {
      console.error('Failed to fetch events:', err)
    }
  }

  async function fetchMerchandise() {
    try {
      setIsLoading(true)
      const params = filterEventId !== 'all' ? `?eventId=${filterEventId}` : ''
      const res = await fetch(`/api/admin/merchandise${params}`)
      if (res.ok) {
        const data = await res.json()
        setMerchandise(data.merchandise || [])
      }
    } catch (err) {
      console.error('Failed to fetch merchandise:', err)
    } finally {
      setIsLoading(false)
    }
  }

  function openCreateDialog() {
    setEditingId(null)
    setFormData(emptyForm)
    setIsDialogOpen(true)
  }

  function openEditDialog(item: MerchandiseItem) {
    setEditingId(item.id)
    setFormData({
      eventId: item.eventId,
      name: item.name,
      description: item.description,
      price: item.price,
      stock: item.stock,
      imageUrl: item.imageUrl || '',
    })
    setIsDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.eventId || !formData.name || formData.price < 0 || formData.stock < 0) return

    setIsSaving(true)
    try {
      const url = editingId ? `/api/admin/merchandise/${editingId}` : '/api/admin/merchandise'
      const method = editingId ? 'PUT' : 'POST'
      const payload = {
        ...formData,
        price: Number(formData.price),
        stock: Number(formData.stock),
        imageUrl: formData.imageUrl || null,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setIsDialogOpen(false)
        fetchMerchandise()
      } else {
        let msg = 'Gagal menyimpan merchandise'
        try { const data = await res.json(); msg = data.error || msg } catch { msg = 'Server error (' + res.status + ')' }
        alert(msg)
      }
    } catch (err) {
      console.error('Save error:', err)
      alert('Terjadi kesalahan jaringan. Pastikan server aktif.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus merchandise ini?')) return

    try {
      const res = await fetch(`/api/admin/merchandise/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchMerchandise()
      }
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-charcoal">Merchandise</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola merchandise pertunjukan</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-charcoal hover:bg-charcoal/90 text-gold">
          <Plus className="w-4 h-4 mr-2" />
          Tambah Merchandise
        </Button>
      </div>

      {/* Event Filter */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Filter Event:</Label>
        <Select value={filterEventId} onValueChange={setFilterEventId}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Semua Event" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Event</SelectItem>
            {events.map((event) => (
              <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Merchandise Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-gold animate-spin" />
            </div>
          ) : merchandise.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Belum ada merchandise</p>
              <Button onClick={openCreateDialog} variant="outline" size="sm" className="mt-4">
                <Plus className="w-3 h-3 mr-1" />
                Tambah Merchandise
              </Button>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Nama</TableHead>
                    <TableHead className="text-xs">Event</TableHead>
                    <TableHead className="text-xs">Harga</TableHead>
                    <TableHead className="text-xs">Stok</TableHead>
                    <TableHead className="text-xs text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {merchandise.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-10 h-10 rounded-md object-cover border border-border/50"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                              <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-charcoal text-sm">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{item.description}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {eventMap[item.eventId] || 'Event tidak dikenal'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-charcoal">
                        {formatRupiah(item.price)}
                      </TableCell>
                      <TableCell>
                        <StockBadge stock={item.stock} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(item)}
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={() => handleDelete(item.id)}
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">
              {editingId ? 'Edit Merchandise' : 'Tambah Merchandise Baru'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Event Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Event *</Label>
              <Select
                value={formData.eventId}
                onValueChange={(val) => setFormData({ ...formData, eventId: val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nama Merchandise *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: T-Shirt Teateran"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Deskripsi</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Deskripsi singkat merchandise..."
                rows={3}
              />
            </div>

            {/* Price & Stock */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Harga (Rp) *</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Stok *</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">URL Gambar</Label>
              <Input
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="text-sm">Batal</Button>
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={isSaving || !formData.eventId || !formData.name || formData.price < 0 || formData.stock < 0}
              className="bg-charcoal hover:bg-charcoal/90 text-gold text-sm"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingId ? 'Simpan Perubahan' : 'Tambah Merchandise'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
