'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, Eye, Mail, Sparkles } from 'lucide-react'

interface EmailTemplateData {
  id: string
  name: string
  greeting: string
  rules: string
  notes: string
  footer: string
  isActive: boolean
}

export default function EmailTemplatePage() {
  const [template, setTemplate] = useState<EmailTemplateData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTemplate() {
      try {
        const res = await fetch('/api/admin/email-template')
        if (res.ok) {
          const data = await res.json()
          setTemplate(data.template || null)
        }
      } catch (err) {
        console.error('Failed to fetch email template:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTemplate()
  }, [])

  async function handleSave() {
    if (!template) return

    setIsSaving(true)
    setSaveMessage(null)

    try {
      const res = await fetch('/api/admin/email-template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          greeting: template.greeting,
          rules: template.rules,
          notes: template.notes,
          footer: template.footer,
        }),
      })

      if (res.ok) {
        setSaveMessage('Template berhasil disimpan!')
        setTimeout(() => setSaveMessage(null), 3000)
      }
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const updateField = (field: keyof EmailTemplateData, value: string) => {
    if (template) {
      setTemplate({ ...template, [field]: value })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-gold animate-spin" />
      </div>
    )
  }

  // Default template if none exists
  const t = template || {
    id: '',
    name: 'default',
    greeting: 'Dear {customerName},',
    rules: 'Silakan datang 30 menit sebelum pertunjukan dimulai. Makanan dan minuman dari luar tidak diperkenankan masuk. Mohon menjaga ketenangan selama pertunjukan berlangsung.',
    notes: 'Perlihatkan e-ticket ini di pintu masuk sebagai bukti pembayaran.',
    footer: 'Terima kasih telah memilih Teateran. Selamat menikmati pertunjukan!',
    isActive: true,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-charcoal">Email Template</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edit template E-Ticket yang dikirim ke pelanggan
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-charcoal hover:bg-charcoal/90 text-gold"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Simpan Template
        </Button>
      </div>

      {/* Save message */}
      {saveMessage && (
        <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg">
          <Sparkles className="w-4 h-4 text-success" />
          <p className="text-sm text-success">{saveMessage}</p>
        </div>
      )}

      {/* Variables hint */}
      <Card className="border-gold/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-xs bg-gold/10 text-gold">
              <Sparkles className="w-3 h-3 mr-1" />
              Variabel
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Gunakan <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{customerName}'}</code> pada greeting untuk menampilkan nama pelanggan secara otomatis.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="edit" className="w-full">
        <TabsList>
          <TabsTrigger value="edit" className="text-sm">
            <Mail className="w-3.5 h-3.5 mr-1" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-sm">
            <Eye className="w-3.5 h-3.5 mr-1" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-4 mt-4">
          {/* Greeting */}
          <Card className="border-border/50">
            <CardContent className="p-5 space-y-3">
              <Label className="text-sm font-medium">Sapaan (Greeting)</Label>
              <Input
                value={t.greeting}
                onChange={(e) => updateField('greeting', e.target.value)}
                placeholder="Dear {customerName},"
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Baris pembuka email. Gunakan {'{customerName}'} untuk nama pelanggan.
              </p>
            </CardContent>
          </Card>

          {/* Rules */}
          <Card className="border-border/50">
            <CardContent className="p-5 space-y-3">
              <Label className="text-sm font-medium">Aturan Event</Label>
              <Textarea
                value={t.rules}
                onChange={(e) => updateField('rules', e.target.value)}
                placeholder="Aturan dan ketentuan pertunjukan..."
                rows={4}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Aturan yang akan ditampilkan di E-Ticket pelanggan.
              </p>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="border-border/50">
            <CardContent className="p-5 space-y-3">
              <Label className="text-sm font-medium">Catatan Tambahan</Label>
              <Textarea
                value={t.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Catatan penting untuk pelanggan..."
                rows={3}
                className="text-sm"
              />
            </CardContent>
          </Card>

          {/* Footer */}
          <Card className="border-border/50">
            <CardContent className="p-5 space-y-3">
              <Label className="text-sm font-medium">Footer</Label>
              <Textarea
                value={t.footer}
                onChange={(e) => updateField('footer', e.target.value)}
                placeholder="Pesan penutup email..."
                rows={2}
                className="text-sm"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <Card className="border-border/50 overflow-hidden">
            <div className="p-4 bg-charcoal">
              <p className="text-gold text-xs tracking-widest uppercase">Preview E-Ticket Email</p>
            </div>
            <div className="p-6 max-w-lg mx-auto">
              {/* Simulated email preview */}
              <div className="bg-white rounded-xl overflow-hidden shadow-lg">
                {/* Header */}
                <div className="bg-gradient-to-r from-charcoal to-charcoal/90 p-6 text-center">
                  <h1 className="text-gold font-serif text-xl">TEATERAN</h1>
                  <p className="text-white/50 text-xs mt-1">E-Ticket Electronic Ticketing</p>
                </div>

                <div className="p-6 space-y-4">
                  {/* Greeting */}
                  <p className="text-sm text-charcoal">
                    {t.greeting.replace('{customerName}', 'Ahmad Rizky')}
                  </p>

                  {/* Event card */}
                  <div className="bg-warm-white rounded-lg p-4 border-l-4 border-gold">
                    <h3 className="font-serif text-lg font-bold text-charcoal">Hamlet - Pertunjukan Spesial</h3>
                    <p className="text-sm text-muted-foreground mt-1">Sabtu, 15 Mei 2026 • 19:00 WIB</p>
                    <p className="text-sm text-muted-foreground">Teateran, Jakarta</p>
                  </div>

                  {/* Seats */}
                  <div className="bg-charcoal rounded-lg p-4 text-center">
                    <p className="text-gold text-xs tracking-widest uppercase mb-2">Your Seats</p>
                    <p className="text-white text-2xl font-mono font-bold tracking-wider">A-3 &nbsp; A-4</p>
                  </div>

                  {/* QR placeholder */}
                  <div className="text-center py-4">
                    <div className="w-40 h-40 mx-auto bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">QR Code</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Scan this QR code at the entrance</p>
                  </div>

                  {/* Amount */}
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-gold text-xl font-bold font-serif">Rp 300.000</p>
                  </div>

                  <Separator />

                  {/* Rules */}
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-charcoal mb-2">Event Rules</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t.rules || 'No rules specified.'}
                    </p>
                  </div>

                  {/* Notes */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-charcoal mb-2">Notes</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t.notes || 'No notes.'}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-warm-white p-4 text-center border-t">
                  <p className="text-xs text-muted-foreground">{t.footer}</p>
                  <p className="text-xs text-muted-foreground/50 mt-1">Transaction ID: TRX-ABC12345</p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
