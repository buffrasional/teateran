'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import {
  Plus, LayoutGrid, Edit, Trash2, Eye, Loader2, MapPin, Users, GripVertical,
} from 'lucide-react'

interface SeatMapData {
  id: string
  name: string
  creatorName: string
  seatType: string
  layoutData: any
  isTemplate: boolean
  createdAt: string
  updatedAt: string
  _count: { events: number }
}

export default function SeatMapsPage() {
  const router = useRouter()
  const [seatMaps, setSeatMaps] = useState<SeatMapData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchSeatMaps()
  }, [])

  async function fetchSeatMaps() {
    try {
      const res = await fetch('/api/admin/seat-maps')
      if (res.ok) {
        const data = await res.json()
        setSeatMaps(data.seatMaps || [])
      }
    } catch (err) {
      console.error('Failed to fetch seat maps:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus seat map ini? Pastikan tidak ada event yang menggunakannya.')) return

    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/seat-maps/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchSeatMaps()
      } else {
        const data = await res.json()
        alert(data.error || 'Gagal menghapus seat map')
      }
    } catch (err) {
      console.error('Delete error:', err)
    } finally {
      setDeletingId(null)
    }
  }

  function getSeatCount(layoutData: any): number {
    if (!layoutData) return 0
    try {
      const data = typeof layoutData === 'string' ? JSON.parse(layoutData) : layoutData
      if (data.type === 'NUMBERED' && data.seats) return data.seats.length
      if (data.type === 'GENERAL_ADMISSION' && data.zones) {
        return data.zones.reduce((sum: number, z: any) => sum + (z.capacity || 0), 0)
      }
      if (Array.isArray(data)) return data.length
    } catch {
      // ignore
    }
    return 0
  }

  function getSectionCount(layoutData: any): number {
    if (!layoutData) return 0
    try {
      const data = typeof layoutData === 'string' ? JSON.parse(layoutData) : layoutData
      if (data.type === 'NUMBERED' && data.sections) return data.sections.length
      if (data.type === 'GENERAL_ADMISSION' && data.zones) return data.zones.length
    } catch {
      // ignore
    }
    return 0
  }

  const statCards = [
    {
      label: 'Total Seat Maps',
      value: seatMaps.length,
      icon: LayoutGrid,
      color: 'text-gold',
      bg: 'bg-gold/10',
    },
    {
      label: 'Numbered Maps',
      value: seatMaps.filter((sm) => sm.seatType === 'NUMBERED').length,
      icon: GripVertical,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'GA Maps',
      value: seatMaps.filter((sm) => sm.seatType === 'GENERAL_ADMISSION').length,
      icon: Users,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'Events Menggunakan',
      value: seatMaps.reduce((sum, sm) => sum + sm._count.events, 0),
      icon: MapPin,
      color: 'text-seat-vip',
      bg: 'bg-seat-vip/10',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-charcoal">Seat Maps</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola tata letak kursi pertunjukan</p>
        </div>
        <Link href="/admin/seat-maps/new/edit">
          <Button className="bg-charcoal hover:bg-charcoal/90 text-gold">
            <Plus className="w-4 h-4 mr-2" />
            Buat Seat Map
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold text-charcoal">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Seat Maps Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-gold animate-spin" />
            </div>
          ) : seatMaps.length === 0 ? (
            <div className="text-center py-12">
              <LayoutGrid className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Belum ada seat map</p>
              <Link href="/admin/seat-maps/new/edit">
                <Button variant="outline" size="sm" className="mt-4">
                  <Plus className="w-3 h-3 mr-1" />
                  Buat Seat Map Pertama
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Nama</TableHead>
                  <TableHead className="text-xs">Tipe</TableHead>
                  <TableHead className="text-xs">Kapasitas</TableHead>
                  <TableHead className="text-xs">Sections/Zones</TableHead>
                  <TableHead className="text-xs">Events</TableHead>
                  <TableHead className="text-xs">Creator</TableHead>
                  <TableHead className="text-xs">Terakhir Diubah</TableHead>
                  <TableHead className="text-xs text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seatMaps.map((sm) => (
                  <TableRow key={sm.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4 text-gold shrink-0" />
                        <div>
                          <p className="font-medium text-charcoal text-sm">{sm.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(sm.createdAt).toLocaleDateString('id-ID')}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          sm.seatType === 'NUMBERED'
                            ? 'bg-blue-500/10 text-blue-600'
                            : 'bg-success/10 text-success'
                        }`}
                      >
                        {sm.seatType === 'NUMBERED' ? 'Kursi Nomor' : 'Bebas Duduk'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {getSeatCount(sm.layoutData)} kursi
                    </TableCell>
                    <TableCell className="text-sm">
                      {getSectionCount(sm.layoutData)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          sm._count.events > 0
                            ? 'bg-gold/10 text-gold-dark'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {sm._count.events}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {sm.creatorName}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(sm.updatedAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {sm.isTemplate ? (
                          <>
                            <Badge variant="secondary" className="text-[10px] bg-gold/10 text-gold-dark mr-1">
                              Template
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              asChild
                              title="Lihat (Template)"
                            >
                              <Link href={`/admin/seat-maps/${sm.id}/edit`}>
                                <Eye className="w-3.5 h-3.5" />
                              </Link>
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                            title="Edit"
                          >
                            <Link href={`/admin/seat-maps/${sm.id}/edit`}>
                              <Edit className="w-3.5 h-3.5" />
                            </Link>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-danger"
                          onClick={() => handleDelete(sm.id)}
                          disabled={deletingId === sm.id || sm.isTemplate}
                          title={sm.isTemplate ? 'Template tidak bisa dihapus' : 'Delete'}
                        >
                          {deletingId === sm.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
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
    </div>
  )
}
