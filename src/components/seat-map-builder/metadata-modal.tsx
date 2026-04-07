'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { Ticket, Users, MapPin, ChevronRight } from 'lucide-react'

interface MetadataModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: {
    name: string
    creatorName: string
    seatType: 'NUMBERED' | 'GENERAL_ADMISSION'
  }) => void
  defaultCreatorName: string
  editingName?: string
  editingType?: 'NUMBERED' | 'GENERAL_ADMISSION'
}

export function MetadataModal({
  open,
  onOpenChange,
  onSubmit,
  defaultCreatorName,
  editingName,
  editingType,
}: MetadataModalProps) {
  const [name, setName] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [seatType, setSeatType] = useState<'NUMBERED' | 'GENERAL_ADMISSION'>('NUMBERED')
  const [errors, setErrors] = useState<{ name?: string; creatorName?: string }>({})

  // Reset form when dialog opens
  const prevOpenRef = useRef(false)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      // Transition from closed → open: reset form state via a microtask
      // to satisfy react-hooks/set-state-in-effect rule
      queueMicrotask(() => {
        setName(editingName || '')
        setCreatorName(defaultCreatorName || '')
        setSeatType(editingType || 'NUMBERED')
        setErrors({})
      })
    }
    prevOpenRef.current = open
  }, [open, editingName, editingType, defaultCreatorName])

  const validate = () => {
    const newErrors: { name?: string; creatorName?: string } = {}
    if (!name.trim()) {
      newErrors.name = 'Nama seat map wajib diisi'
    }
    if (!creatorName.trim()) {
      newErrors.creatorName = 'Nama pembuat wajib diisi'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      name: name.trim(),
      creatorName: creatorName.trim(),
      seatType,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden border-border/50">
        {/* Header */}
        <div className="bg-gradient-to-br from-charcoal to-charcoal/95 px-6 pt-6 pb-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent" />
          <div className="relative">
            <DialogHeader className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-gold" />
                <DialogTitle className="text-xl font-serif text-warm-white">
                  {editingName ? 'Edit Seat Map' : 'Seat Map Baru'}
                </DialogTitle>
              </div>
              <DialogDescription className="text-warm-white/60 text-sm leading-relaxed">
                {editingName
                  ? 'Ubah metadata seat map yang sudah ada.'
                  : 'Masukkan informasi dasar untuk membuat seat map baru.'}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 bg-warm-white space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <Label
                htmlFor="seatmap-name"
                className="text-sm font-medium text-charcoal flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                Nama Seat Map
              </Label>
              <Input
                id="seatmap-name"
                placeholder="contoh: Teater Utama, Studio Kecil..."
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
                }}
                className={cn(
                  'h-10 bg-white border-border/60 transition-colors',
                  errors.name && 'border-danger focus-visible:ring-danger/20'
                )}
              />
              {errors.name && (
                <p className="text-xs text-danger">{errors.name}</p>
              )}
            </div>

            {/* Creator Name */}
            <div className="space-y-2">
              <Label
                htmlFor="creator-name"
                className="text-sm font-medium text-charcoal flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                Nama Pembuat
              </Label>
              <Input
                id="creator-name"
                placeholder="Nama Anda"
                value={creatorName}
                onChange={(e) => {
                  setCreatorName(e.target.value)
                  if (errors.creatorName)
                    setErrors((prev) => ({ ...prev, creatorName: undefined }))
                }}
                className={cn(
                  'h-10 bg-white border-border/60 transition-colors',
                  errors.creatorName && 'border-danger focus-visible:ring-danger/20'
                )}
              />
              {errors.creatorName && (
                <p className="text-xs text-danger">{errors.creatorName}</p>
              )}
            </div>

            {/* Seat Type */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-charcoal flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-muted-foreground" />
                Tipe Kursi
              </Label>
              <RadioGroup
                value={seatType}
                onValueChange={(v) => setSeatType(v as 'NUMBERED' | 'GENERAL_ADMISSION')}
                className="space-y-2"
              >
                {/* NUMBERED option */}
                <label
                  htmlFor="type-numbered"
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all duration-150',
                    seatType === 'NUMBERED'
                      ? 'border-gold/50 bg-gold/5 shadow-sm'
                      : 'border-border/60 bg-white hover:border-gold/20'
                  )}
                >
                  <RadioGroupItem value="NUMBERED" id="type-numbered" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-charcoal">
                        Kategori Spesifik
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        A1-Z999
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Kursi diberi nomor unik (A1, B2, dst). Cocok untuk teater & konser formal.
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-md bg-charcoal flex items-center justify-center shrink-0">
                    <span className="text-[8px] text-gold font-mono font-bold">A1</span>
                  </div>
                </label>

                {/* GENERAL_ADMISSION option */}
                <label
                  htmlFor="type-ga"
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all duration-150',
                    seatType === 'GENERAL_ADMISSION'
                      ? 'border-gold/50 bg-gold/5 shadow-sm'
                      : 'border-border/60 bg-white hover:border-gold/20'
                  )}
                >
                  <RadioGroupItem value="GENERAL_ADMISSION" id="type-ga" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-charcoal">
                        Grup / Zone
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        Free Seating
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Kursi dikelompokkan per zona. Cocok untuk festival & acara informal.
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-md bg-charcoal flex items-center justify-center shrink-0">
                    <span className="text-[8px] text-gold font-mono font-bold">
                      Z1
                    </span>
                  </div>
                </label>
              </RadioGroup>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 pb-6 pt-0 bg-warm-white">
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-charcoal"
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="bg-charcoal hover:bg-charcoal/90 text-gold font-medium gap-1.5"
              >
                {editingName ? 'Simpan' : 'Buat Seat Map'}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
