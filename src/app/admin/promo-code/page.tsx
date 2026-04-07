'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  Plus, Edit, Trash2, Tag, Loader2, Ticket
} from 'lucide-react'

interface EventOption {
  id: string
  title: string
}

interface PromoCodeItem {
  id: string
  eventId: string | null
  code: string
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
  maxUses: number
  currentUses: number
  validFrom: string
  validUntil: string
  target: string
  isPerItem: boolean
  minTickets: number
  minMerchItems: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface PromoCodeFormData {
  code: string
  eventId: string
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
  maxUses: number
  validFrom: string
  validUntil: string
  target: string
  isPerItem: boolean
  minTickets: number
  minMerchItems: number
  isActive: boolean
}

const TARGET_OPTIONS = [
  { value: 'ALL', label: 'Semua', desc: 'Diskon seluruh keranjang', icon: '🎫' },
  { value: 'TICKET', label: 'Tiket', desc: 'Diskon harga tiket saja', icon: '🎟️' },
  { value: 'MERCH', label: 'Merchandise', desc: 'Diskon harga merch saja', icon: '🛍️' },
  { value: 'BUNDLING', label: 'Bundling', desc: 'Diskon jika tiket + merch', icon: '📦' },
]

const emptyForm: PromoCodeFormData = {
  code: '',
  eventId: '',
  discountType: 'PERCENT',
  discountValue: 0,
  maxUses: 100,
  validFrom: '',
  validUntil: '',
  target: 'ALL',
  isPerItem: false,
  minTickets: 0,
  minMerchItems: 0,
  isActive: true,
}

function formatDiscount(type: 'PERCENT' | 'FIXED', value: number, isPerItem: boolean): string {
  const suffix = type === 'PERCENT' ? '%' : ''
  const prefix = type === 'FIXED' ? 'Rp ' : ''
  return `${prefix}${value.toLocaleString('id-ID')}${suffix}${isPerItem ? '/item' : ''}`
}

function toJakartaDatetimeLocal(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const jakartaStr = d.toLocaleString('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  return jakartaStr.replace(' ', 'T')
}

function formatDateJakarta(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return dateStr }
}

function getTargetBadge(target: string): { label: string; cls: string } {
  switch (target) {
    case 'TICKET': return { label: 'Tiket', cls: 'bg-blue-100 text-blue-700 border-blue-200' }
    case 'MERCH': return { label: 'Merch', cls: 'bg-orange-100 text-orange-700 border-orange-200' }
    case 'BUNDLING': return { label: 'Bundling', cls: 'bg-pink-100 text-pink-700 border-pink-200' }
    default: return { label: 'Semua', cls: 'bg-green-100 text-green-700 border-green-200' }
  }
}

export default function PromoCodesAdminPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([])
  const [events, setEvents] = useState<EventOption[]>([])
  const [eventMap, setEventMap] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<PromoCodeFormData>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchEvents()
    fetchPromoCodes()
  }, [])

  async function fetchEvents() {
    try {
      const res = await fetch('/api/admin/events')
      if (res.ok) {
        const data = await res.json()
        const evts: EventOption[] = (data.events || []).map((e: { id: string; title: string }) => ({
          id: e.id, title: e.title,
        }))
        setEvents(evts)
        const map: Record<string, string> = {}
        evts.forEach((e) => { map[e.id] = e.title })
        setEventMap(map)
      }
    } catch (err) { console.error('Failed to fetch events:', err) }
  }

  async function fetchPromoCodes() {
    try {
      setIsLoading(true)
      const res = await fetch('/api/admin/promo-codes')
      if (res.ok) {
        const data = await res.json()
        setPromoCodes(data.promoCodes || [])
      }
    } catch (err) { console.error('Failed to fetch promo codes:', err) }
    finally { setIsLoading(false) }
  }

  function openCreateDialog() {
    setEditingId(null)
    const now = new Date()
    const nowJakarta = toJakartaDatetimeLocal(now.toISOString())
    setFormData({ ...emptyForm, validFrom: nowJakarta, validUntil: nowJakarta })
    setIsDialogOpen(true)
  }

  function openEditDialog(item: PromoCodeItem) {
    setEditingId(item.id)
    setFormData({
      code: item.code,
      eventId: item.eventId || '',
      discountType: item.discountType,
      discountValue: item.discountValue,
      maxUses: item.maxUses,
      validFrom: toJakartaDatetimeLocal(item.validFrom),
      validUntil: toJakartaDatetimeLocal(item.validUntil),
      target: item.target || 'ALL',
      isPerItem: item.isPerItem || false,
      minTickets: item.minTickets || 0,
      minMerchItems: item.minMerchItems || 0,
      isActive: item.isActive,
    })
    setIsDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.code || formData.discountValue < 0 || !formData.maxUses || !formData.validFrom || !formData.validUntil) return
    setIsSaving(true)
    try {
      const url = editingId ? `/api/admin/promo-codes/${editingId}` : '/api/admin/promo-codes'
      const method = editingId ? 'PUT' : 'POST'
      const payload = {
        ...formData,
        code: formData.code.toUpperCase(),
        eventId: formData.eventId === 'all' ? null : (formData.eventId || null),
        discountValue: Number(formData.discountValue),
        maxUses: Number(formData.maxUses),
        minTickets: Number(formData.minTickets),
        minMerchItems: Number(formData.minMerchItems),
      }
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) {
        setIsDialogOpen(false)
        fetchPromoCodes()
      } else {
        let msg = 'Gagal menyimpan kode promo'
        try { const data = await res.json(); msg = data.error || msg } catch {}
        alert(msg)
      }
    } catch (err) { console.error('Save error:', err); alert('Terjadi kesalahan jaringan') }
    finally { setIsSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus kode promo ini?')) return
    try {
      const res = await fetch(`/api/admin/promo-codes/${id}`, { method: 'DELETE' })
      if (res.ok) fetchPromoCodes()
    } catch (err) { console.error('Delete error:', err) }
  }

  async function handleToggleActive(item: PromoCodeItem) {
    try {
      await fetch(`/api/admin/promo-codes/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive }),
      })
      fetchPromoCodes()
    } catch (err) { console.error('Toggle error:', err) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-charcoal">Kode Promo</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola kode promo, diskon, dan syarat penggunaan</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-charcoal hover:bg-charcoal/90 text-gold">
          <Plus className="w-4 h-4 mr-2" />Buat Kode Promo
        </Button>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-gold animate-spin" /></div>
          ) : promoCodes.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Belum ada kode promo</p>
              <Button onClick={openCreateDialog} variant="outline" size="sm" className="mt-4"><Plus className="w-3 h-3 mr-1" />Buat Kode Promo</Button>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Kode</TableHead>
                    <TableHead className="text-xs">Diskon</TableHead>
                    <TableHead className="text-xs">Target</TableHead>
                    <TableHead className="text-xs">Syarat</TableHead>
                    <TableHead className="text-xs">Event</TableHead>
                    <TableHead className="text-xs">Penggunaan</TableHead>
                    <TableHead className="text-xs">Periode</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promoCodes.map((item) => {
                    const tb = getTargetBadge(item.target)
                    const reqs: string[] = []
                    if (item.minTickets > 0) reqs.push(`Min ${item.minTickets} tiket`)
                    if (item.minMerchItems > 0) reqs.push(`Min ${item.minMerchItems} merch`)
                    if (item.target === 'BUNDLING') reqs.push('Tiket + Merch')
                    if (item.target === 'MERCH') reqs.push('Wajib merch')
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs tracking-wider border-charcoal/30 text-charcoal">{item.code}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-sm text-charcoal">{formatDiscount(item.discountType, item.discountValue, item.isPerItem)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge className={`text-xs border ${tb.cls}`}>{tb.label}</Badge>
                            {item.isPerItem && <span className="text-[10px] text-purple-600 font-medium">Per Item</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {reqs.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              {reqs.map((r, i) => <span key={i} className="text-[10px] text-muted-foreground">{r}</span>)}
                            </div>
                          ) : <span className="text-xs text-muted-foreground">Tanpa syarat</span>}
                        </TableCell>
                        <TableCell>
                          {item.eventId ? (
                            <Badge variant="secondary" className="text-xs">{eventMap[item.eventId] || '?'}</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs bg-gold/10 text-gold">Semua</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            <span className="font-medium text-charcoal">{item.currentUses}</span>
                            <span className="text-muted-foreground"> / {item.maxUses}</span>
                          </span>
                          <div className="w-full bg-muted rounded-full h-1.5 mt-1 max-w-[80px]">
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min((item.currentUses / item.maxUses) * 100, 100)}%`, backgroundColor: item.currentUses >= item.maxUses ? '#C75050' : '#C8A951' }} />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div>{formatDateJakarta(item.validFrom)}</div>
                          <div>s/d {formatDateJakarta(item.validUntil)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch checked={item.isActive} onCheckedChange={() => handleToggleActive(item)} className="data-[state=checked]:bg-green-500" />
                            <span className={`text-xs font-medium ${item.isActive ? 'text-green-600' : 'text-muted-foreground'}`}>{item.isActive ? 'Aktif' : 'Off'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(item)}><Edit className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
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
            <DialogTitle className="font-serif text-lg">{editingId ? 'Edit Kode Promo' : 'Buat Kode Promo Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Code */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Kode Promo *</Label>
              <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="TEATER50" className="font-mono tracking-wider uppercase" />
            </div>

            {/* Event */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Event (opsional)</Label>
              <Select value={formData.eventId || 'all'} onValueChange={(val) => setFormData({ ...formData, eventId: val })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Semua Event" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Event</SelectItem>
                  {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Target */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Target Diskon *</Label>
              <div className="grid grid-cols-2 gap-2">
                {TARGET_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setFormData({ ...formData, target: opt.value })}
                    className={`text-left rounded-lg border-2 p-2.5 transition-all ${formData.target === opt.value ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/30'}`}>
                    <div className="flex items-center gap-1.5"><span className="text-sm">{opt.icon}</span><span className="text-xs font-semibold text-charcoal">{opt.label}</span></div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Per Item Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Diskon Per Item</Label>
                <p className="text-xs text-muted-foreground">Contoh: Presale — diskon per tiket, jadi beli 3 = 3x diskon</p>
              </div>
              <Switch checked={formData.isPerItem} onCheckedChange={(checked) => setFormData({ ...formData, isPerItem: checked })} className="data-[state=checked]:bg-purple-500" />
            </div>

            {/* Discount Type & Value */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipe Diskon *</Label>
                <Select value={formData.discountType} onValueChange={(val) => setFormData({ ...formData, discountType: val as 'PERCENT' | 'FIXED' })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Persentase (%)</SelectItem>
                    <SelectItem value="FIXED">Nominal Tetap (Rp)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nilai Diskon *</Label>
                <Input type="number" min={0} value={formData.discountValue} onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })} placeholder={formData.discountType === 'PERCENT' ? '50' : '25000'} />
              </div>
            </div>

            {/* Min Requirements */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Min. Tiket (0 = bebas)</Label>
                <Input type="number" min={0} value={formData.minTickets} onChange={(e) => setFormData({ ...formData, minTickets: Number(e.target.value) })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Min. Merch (0 = bebas)</Label>
                <Input type="number" min={0} value={formData.minMerchItems} onChange={(e) => setFormData({ ...formData, minMerchItems: Number(e.target.value) })} placeholder="0" />
              </div>
            </div>

            {/* Max Uses */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Maks. Penggunaan *</Label>
              <Input type="number" min={1} value={formData.maxUses} onChange={(e) => setFormData({ ...formData, maxUses: Number(e.target.value) })} placeholder="100" />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Berlaku Mulai *</Label>
                <Input type="datetime-local" value={formData.validFrom} onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Berlaku Sampai *</Label>
                <Input type="datetime-local" value={formData.validUntil} onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">⚠️ Waktu menggunakan zona WIB (Jakarta)</p>

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Status Aktif</Label>
                <p className="text-xs text-muted-foreground">Kode promo aktif jika dicentang</p>
              </div>
              <Switch checked={formData.isActive} onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })} className="data-[state=checked]:bg-green-500" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="text-sm">Batal</Button></DialogClose>
            <Button onClick={handleSave} disabled={isSaving || !formData.code || formData.discountValue < 0 || !formData.maxUses || !formData.validFrom || !formData.validUntil} className="bg-charcoal hover:bg-charcoal/90 text-gold text-sm">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingId ? 'Simpan Perubahan' : 'Buat Kode Promo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
