'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowLeft, Lock, AlertTriangle, LayoutGrid } from 'lucide-react'
import { TemplateModal } from '@/components/seat-map-builder/template-modal'
import { MetadataModal } from '@/components/seat-map-builder/metadata-modal'
import { CanvasEditor } from '@/components/seat-map-builder/canvas-editor'
import { ErrorBoundary } from '@/components/error-boundary'

type WizardStep = 'template' | 'metadata' | 'editor'
type SeatType = 'NUMBERED' | 'GENERAL_ADMISSION'

export default function SeatMapEditPage() {
  const params = useParams()
  const router = useRouter()
  const seatMapId = params.id as string
  const isNew = seatMapId === 'new'
  const [realSeatMapId, setRealSeatMapId] = useState<string>(isNew ? '' : seatMapId)

  // Wizard state
  const [step, setStep] = useState<WizardStep>(isNew ? 'template' : 'editor')
  const [selectedTemplate, setSelectedTemplate] = useState<{ name: string; layoutData: any } | null>(null)
  const [mapName, setMapName] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [seatType, setSeatType] = useState<SeatType>('NUMBERED')
  const [currentStageType, setCurrentStageType] = useState<string>('PROSCENIUM')

  // Editor state
  const [layoutData, setLayoutData] = useState<any>(null)
  const originalEmbeddedRowsRef = useRef<Record<string, number> | null>(null)

  // Preserve embeddedRows when layoutData is first loaded
  useEffect(() => {
    if (layoutData?.embeddedRows) {
      originalEmbeddedRowsRef.current = layoutData.embeddedRows
    }
  }, [layoutData?.embeddedRows])
  const [isLocked, setIsLocked] = useState(false)
  const [lockedBy, setLockedBy] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(!isNew)
  const [adminId, setAdminId] = useState('')
  const [adminName, setAdminName] = useState('')

  // Load admin info from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('teateran_admin')
      if (stored) {
        const admin = JSON.parse(stored)
        setAdminId(admin.id || admin.username || 'unknown')
        setAdminName(admin.name || admin.username || 'Admin')
        setCreatorName(admin.name || admin.username || 'Admin')
      }
    } catch {
      // ignore
    }
  }, [])

  // Validate and sanitize layoutData from API
  const sanitizeLayoutData = useCallback((raw: any, type: SeatType): any => {
    if (!raw || typeof raw !== 'object') return null
    if (type === 'NUMBERED') {
      return {
        type: 'NUMBERED',
        gridSize: (raw.gridSize && typeof raw.gridSize === 'object')
          ? { rows: Number(raw.gridSize.rows) || 1, cols: Number(raw.gridSize.cols) || 1 }
          : { rows: 8, cols: 10 },
        aisleColumns: Array.isArray(raw.aisleColumns) ? raw.aisleColumns : [],
        rowLabels: Array.isArray(raw.rowLabels) ? raw.rowLabels : [],
        seats: Array.isArray(raw.seats) ? raw.seats : [],
        sections: Array.isArray(raw.sections) ? raw.sections : [],
        // Preserve stage/objects positions (previously stripped, causing reset)
        ...(raw.stagePosition && typeof raw.stagePosition === 'object' && { stagePosition: raw.stagePosition }),
        ...(raw.objects && Array.isArray(raw.objects) && { objects: raw.objects }),
        ...(raw.thrustWidth && { thrustWidth: raw.thrustWidth }),
        ...(raw.thrustDepth && { thrustDepth: raw.thrustDepth }),
        ...(raw.embeddedRows && typeof raw.embeddedRows === 'object' && { embeddedRows: raw.embeddedRows }),
        // CRITICAL: Preserve paint mode data — seatColumns, canvasWidth, canvasHeight
        // Without these, the canvas layout is destroyed on reload (empty areas trimmed, positions lost)
        ...(Array.isArray(raw.seatColumns) && { seatColumns: raw.seatColumns }),
        ...(raw.canvasWidth && { canvasWidth: Number(raw.canvasWidth) }),
        ...(raw.canvasHeight && { canvasHeight: Number(raw.canvasHeight) }),
        ...(raw.stageType && { stageType: raw.stageType }),
      }
    }
    return {
      type: 'GENERAL_ADMISSION',
      gridSize: (raw.gridSize && typeof raw.gridSize === 'object')
        ? { rows: Number(raw.gridSize.rows) || 1, cols: Number(raw.gridSize.cols) || 1 }
        : { rows: 8, cols: 10 },
      zones: Array.isArray(raw.zones) ? raw.zones : [],
      // Preserve stage/objects positions
      ...(raw.stagePosition && typeof raw.stagePosition === 'object' && { stagePosition: raw.stagePosition }),
      ...(raw.objects && Array.isArray(raw.objects) && { objects: raw.objects }),
    }
  }, [])

  // Load existing seat map (for editing)
  useEffect(() => {
    if (isNew) return

    async function loadSeatMap() {
      try {
        const res = await fetch(`/api/admin/seat-maps/${seatMapId}`)
        if (res.ok) {
          const data = await res.json()
          const sm = data.seatMap
          const sanitized = sanitizeLayoutData(sm.layoutData, sm.seatType)
          console.log('[page.tsx] Loaded seat map:', sm.name, 'type:', sm.seatType, 'sanitized:', sanitized ? 'OK' : 'FAILED')
          setMapName(sm.name || '')
          setCreatorName(sm.creatorName || '')
          setSeatType(sm.seatType || 'NUMBERED')
          setCurrentStageType(sm.stageType || 'PROSCENIUM')
          setLayoutData(sanitized)
          setStep('editor')
        } else {
          alert('Seat map tidak ditemukan')
          router.replace('/admin/seat-maps')
        }
      } catch (err) {
        console.error('Failed to load seat map:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadSeatMap()
  }, [seatMapId, isNew, router, sanitizeLayoutData, adminId])

  // Check lock status
  const checkLock = useCallback(async () => {
    if (!realSeatMapId) return
    try {
      const res = await fetch(`/api/admin/seat-maps/${realSeatMapId}/lock`)
      if (res.ok) {
        const data = await res.json()
        if (data.locked && data.lockedBy !== adminId) {
          setIsLocked(true)
          setLockedBy(data.lockedBy)
        } else {
          setIsLocked(false)
          setLockedBy(null)
        }
      }
    } catch {
      // ignore
    }
  }, [realSeatMapId, adminId])

  useEffect(() => {
    if (realSeatMapId && adminId) {
      checkLock()
      const interval = setInterval(checkLock, 30000) // Poll every 30s
      return () => clearInterval(interval)
    }
  }, [realSeatMapId, adminId, checkLock])

  // Acquire lock (for a specific seat map ID)
  async function acquireLockFor(targetId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/admin/seat-maps/${targetId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, adminName }),
      })
      if (res.ok) {
        setIsLocked(false)
        return true
      }
      const data = await res.json()
      setIsLocked(true)
      setLockedBy(data.lockedBy || 'Admin lain')
      return false
    } catch {
      return false
    }
  }

  // Acquire lock using current realSeatMapId
  async function acquireLock(): Promise<boolean> {
    if (!realSeatMapId) return false
    return acquireLockFor(realSeatMapId)
  }

  // Release lock
  async function releaseLock() {
    if (!realSeatMapId) return
    try {
      await fetch(`/api/admin/seat-maps/${realSeatMapId}/lock`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId }),
      })
    } catch {
      // ignore
    }
  }

  // Release lock on unmount
  useEffect(() => {
    return () => {
      if (realSeatMapId && adminId) {
        fetch(`/api/admin/seat-maps/${realSeatMapId}/lock`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminId }),
        }).catch(() => {})
      }
    }
  }, [realSeatMapId, adminId])

  // Create new seat map from template + metadata
  async function createSeatMap(name: string, creator: string, type: SeatType): Promise<string> {
    const templateLayout = selectedTemplate?.layoutData || {}
    const initialLayout = {
      type,
      ...(type === 'NUMBERED'
        ? {
            gridSize: { rows: 8, cols: 10 },
            aisleColumns: [],
            rowLabels: Array.from({ length: 8 }, (_, i) => String.fromCharCode(65 + i)),
            seats: [],
            sections: [],
          }
        : {
            gridSize: { rows: 8, cols: 10 },
            zones: [],
          }),
      ...templateLayout,
    }

    // Ensure the type in layoutData matches the selected seat type
    initialLayout.type = type

    const res = await fetch('/api/admin/seat-maps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        creatorName: creator,
        seatType: type,
        layoutData: initialLayout,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Gagal membuat seat map')
    }

    const data = await res.json()
    return data.seatMap.id
  }

  // Template selection handler
  function handleTemplateSelect(template: { name: string; layoutData: any }) {
    setSelectedTemplate(template)
    setStep('metadata')
  }

  // Metadata submission handler (for NEW seat maps)
  async function handleMetadataSubmit(data: { name: string; creatorName: string; seatType: SeatType }) {
    setMapName(data.name)
    setCreatorName(data.creatorName)
    setSeatType(data.seatType)

    try {
      const newId = await createSeatMap(data.name, data.creatorName, data.seatType)
      // Update the real ID so lock/save operations use the correct ID
      setRealSeatMapId(newId)
      // Replace URL without re-rendering
      window.history.replaceState(null, '', `/admin/seat-maps/${newId}/edit`)
      // Now acquire lock using the REAL new ID (not 'new')
      const locked = await acquireLockFor(newId)
      if (locked) {
        setStep('editor')
        // Fetch the newly created seat map to get its layoutData
        const smRes = await fetch(`/api/admin/seat-maps/${newId}`)
        if (smRes.ok) {
          const smData = await smRes.json()
          setLayoutData(smData.seatMap.layoutData)
        }
      } else {
        alert('Gagal mendapatkan lock. Coba lagi.')
        router.replace('/admin/seat-maps')
      }
    } catch (err: any) {
      alert(err.message || 'Gagal membuat seat map')
    }
  }

  // Save & Exit handler
  async function handleSaveAndExit(finalLayoutData: any, newStageType?: string) {
    setLayoutData(finalLayoutData)
    if (newStageType) setCurrentStageType(newStageType)
    const targetId = realSeatMapId || seatMapId
    if (!targetId || targetId === 'new') {
      alert('Seat map ID tidak valid')
      return
    }

    // Preserve embeddedRows from original data (CanvasEditor strips it)
    const savedData = {
      ...finalLayoutData,
      ...(originalEmbeddedRowsRef.current && { embeddedRows: originalEmbeddedRowsRef.current }),
    }

    try {
      const res = await fetch(`/api/admin/seat-maps/${targetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mapName,
          layoutData: savedData,
          ...(newStageType && { stageType: newStageType }),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Gagal menyimpan')
        return
      }

      await releaseLock()
      router.replace('/admin/seat-maps')
    } catch (err) {
      console.error('Save error:', err)
      alert('Gagal menyimpan')
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-gold animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Memuat seat map...</p>
        </div>
      </div>
    )
  }

  // Lock blocked screen
  if (realSeatMapId && isLocked && step === 'editor') {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.replace('/admin/seat-maps')} className="text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali ke Seat Maps
        </Button>

        <Card className="border-border/50 max-w-lg mx-auto mt-12">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="font-serif text-lg font-bold text-charcoal mb-2">Seat Map Terkunci</h2>
            <p className="text-sm text-muted-foreground mb-1">
              Seat map sedang diedit oleh:
            </p>
            <Badge variant="secondary" className="text-sm bg-gold/10 text-gold-dark">
              {lockedBy}
            </Badge>
            <p className="text-xs text-muted-foreground mt-4">
              Harap tunggu hingga editing selesai, atau hubungi admin tersebut.
              Lock akan otomatis kadaluarsa dalam 2 jam.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button variant="outline" onClick={() => router.replace('/admin/seat-maps')}>
                Kembali
              </Button>
              <Button onClick={checkLock} className="bg-charcoal hover:bg-charcoal/90 text-gold">
                <Loader2 className="w-3.5 h-3.5 mr-2" />
                Cek Ulang
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Step: Template Selection (new seat map only)
  if (step === 'template') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => router.replace('/admin/seat-maps')} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
          </Button>
          <div>
            <h1 className="font-serif text-2xl font-bold text-charcoal">Buat Seat Map Baru</h1>
            <p className="text-sm text-muted-foreground">Langkah 1: Pilih template awal</p>
          </div>
        </div>

        <TemplateModal
          open={true}
          onOpenChange={(open) => {
            if (!open) router.replace('/admin/seat-maps')
          }}
          onSelect={handleTemplateSelect}
        />
      </div>
    )
  }

  // Step: Metadata Form (new seat map only)
  if (step === 'metadata') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setStep('template')} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
          </Button>
          <div>
            <h1 className="font-serif text-2xl font-bold text-charcoal">Buat Seat Map Baru</h1>
            <p className="text-sm text-muted-foreground">Langkah 2: Masukkan metadata</p>
          </div>
        </div>

        {selectedTemplate && (
          <Card className="border-border/50 max-w-sm">
            <CardContent className="p-3 flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-gold" />
              <span className="text-sm text-muted-foreground">
                Template: <strong className="text-charcoal">{selectedTemplate.name}</strong>
              </span>
            </CardContent>
          </Card>
        )}

        <MetadataModal
          open={true}
          onOpenChange={(open) => {
            if (!open) setStep('template')
          }}
          onSubmit={handleMetadataSubmit}
          defaultCreatorName={creatorName}
        />
      </div>
    )
  }

  // Step: Canvas Editor
  if (!realSeatMapId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Seat map ID tidak valid</p>
        <Button variant="outline" onClick={() => router.replace('/admin/seat-maps')} className="mt-4">
          Kembali
        </Button>
      </div>
    )
  }

  // Safety: don't render CanvasEditor until we have layoutData
  if (!layoutData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-gold animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Memuat data seat map...</p>
        </div>
      </div>
    )
  }

  // Extra safety: ensure layoutData has a type before rendering
  if (!layoutData.type || typeof layoutData.type !== 'string') {
    console.error('[page.tsx] Invalid layoutData.type:', layoutData)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-red-500">
          <p className="font-semibold">Data seat map tidak valid</p>
          <p className="text-sm text-muted-foreground mt-1">Layout data tidak memiliki type yang valid.</p>
        </div>
      </div>
    )
  }

  // Final validation: log what we're about to pass to CanvasEditor
  console.log('[page.tsx] Rendering CanvasEditor:', {
    seatMapId: realSeatMapId,
    seatType,
    layoutDataType: layoutData.type,
    hasGridSize: !!layoutData.gridSize,
    seatsCount: Array.isArray(layoutData.seats) ? layoutData.seats.length : 'N/A',
    zonesCount: Array.isArray(layoutData.zones) ? layoutData.zones.length : 'N/A',
  })

  return (
    <ErrorBoundary>
      <CanvasEditor
        key={realSeatMapId}
        seatMapId={realSeatMapId}
        seatType={seatType}
        initialLayoutData={layoutData}
        initialStageType={currentStageType}
        adminId={adminId}
        adminName={adminName}
        onSaveAndExit={handleSaveAndExit}
      />
    </ErrorBoundary>
  )
}
