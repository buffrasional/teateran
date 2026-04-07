'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Users, Plus, Pencil, Trash2, Eye, EyeOff, ShieldCheck,
  Power, PowerOff, Search, Activity, Clock, User, ChevronDown, ChevronUp, AlertTriangle, Check,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Usher {
  id: string
  username: string
  name: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: { activityLogs: number }
}

interface ActivityLog {
  id: string
  adminId: string
  adminName: string | null
  action: string
  details: string | null
  ipAddress: string | null
  createdAt: string
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Login',
  CHECK_IN: 'Scan Tiket',
  ACCOUNT_CREATED: 'Akun Dibuat',
  ACCOUNT_UPDATED: 'Akun Diubah',
  LOGOUT: 'Logout',
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-blue-100 text-blue-700',
  CHECK_IN: 'bg-green-100 text-green-700',
  ACCOUNT_CREATED: 'bg-purple-100 text-purple-700',
  ACCOUNT_UPDATED: 'bg-amber-100 text-amber-700',
  LOGOUT: 'bg-gray-100 text-gray-700',
}

export default function UsherManagementPage() {
  const { toast } = useToast()
  const [ushers, setUshers] = useState<Usher[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showLogsDialog, setShowLogsDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Form state
  const [formUsername, setFormUsername] = useState('')
  const [formName, setFormName] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [showFormPassword, setShowFormPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Edit state
  const [editingUsher, setEditingUsher] = useState<Usher | null>(null)
  const [editName, setEditName] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [editIsActive, setEditIsActive] = useState(true)

  // Logs state
  const [logsUsher, setLogsUsher] = useState<Usher | null>(null)
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  // Delete state
  const [deletingUsher, setDeletingUsher] = useState<Usher | null>(null)

  // Expanded usher for quick view
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [quickLogs, setQuickLogs] = useState<ActivityLog[]>([])

  const fetchUshers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ushers')
      if (res.ok) {
        const data = await res.json()
        setUshers(data.ushers || [])
      }
    } catch (err) {
      console.error('Failed to fetch ushers:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUshers()
  }, [fetchUshers])

  const fetchLogs = async (adminId: string) => {
    setLogsLoading(true)
    try {
      const res = await fetch(`/api/admin/activity-logs?adminId=${adminId}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch {}
    setLogsLoading(false)
  }

  const fetchQuickLogs = async (adminId: string) => {
    try {
      const res = await fetch(`/api/admin/activity-logs?adminId=${adminId}&limit=5`)
      if (res.ok) {
        const data = await res.json()
        setQuickLogs(data.logs || [])
      }
    } catch {}
  }

  // Create usher
  const handleCreate = async () => {
    if (!formUsername.trim() || !formPassword.trim()) {
      toast({ title: 'Error', description: 'Username dan password harus diisi', variant: 'destructive' })
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/ushers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formUsername.trim(),
          password: formPassword,
          name: formName.trim() || formUsername.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast({ title: 'Gagal', description: data.error || 'Gagal membuat usher', variant: 'destructive' })
        return
      }
      toast({ title: 'Berhasil', description: `Usher "${formUsername}" berhasil dibuat` })
      setShowCreateDialog(false)
      setFormUsername('')
      setFormName('')
      setFormPassword('')
      fetchUshers()
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan koneksi', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update usher
  const handleUpdate = async () => {
    if (!editingUsher) return
    setIsSubmitting(true)
    try {
      const body: any = {}
      if (editName !== editingUsher.name) body.name = editName
      if (editPassword) body.password = editPassword
      if (editIsActive !== editingUsher.isActive) body.isActive = editIsActive

      if (Object.keys(body).length === 0) {
        toast({ title: 'Info', description: 'Tidak ada perubahan' })
        setShowEditDialog(false)
        return
      }

      const res = await fetch(`/api/admin/ushers/${editingUsher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        toast({ title: 'Gagal', description: data.error || 'Gagal mengupdate usher', variant: 'destructive' })
        return
      }
      toast({ title: 'Berhasil', description: `Usher "${editingUsher.username}" berhasil diupdate` })
      setShowEditDialog(false)
      setEditPassword('')
      fetchUshers()
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan koneksi', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete usher
  const handleDelete = async () => {
    if (!deletingUsher) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/admin/ushers/${deletingUsher.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        toast({ title: 'Gagal', description: data.error || 'Gagal menghapus usher', variant: 'destructive' })
        return
      }
      toast({ title: 'Berhasil', description: `Usher "${deletingUsher.username}" berhasil dihapus` })
      setShowDeleteDialog(false)
      fetchUshers()
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan koneksi', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Toggle active status
  const handleToggleActive = async (usher: Usher) => {
    try {
      const res = await fetch(`/api/admin/ushers/${usher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !usher.isActive }),
      })
      if (res.ok) {
        toast({
          title: 'Berhasil',
          description: `Usher "${usher.username}" ${usher.isActive ? 'dinonaktifkan' : 'diaktifkan'}`,
        })
        fetchUshers()
      }
    } catch {}
  }

  // Open edit dialog
  const openEdit = (usher: Usher) => {
    setEditingUsher(usher)
    setEditName(usher.name || '')
    setEditPassword('')
    setEditIsActive(usher.isActive)
    setShowEditDialog(true)
  }

  // Open logs dialog
  const openLogs = (usher: Usher) => {
    setLogsUsher(usher)
    setLogs([])
    setShowLogsDialog(true)
    fetchLogs(usher.id)
  }

  // Toggle expand
  const toggleExpand = (usher: Usher) => {
    if (expandedId === usher.id) {
      setExpandedId(null)
      setQuickLogs([])
    } else {
      setExpandedId(usher.id)
      fetchQuickLogs(usher.id)
    }
  }

  // Filter ushers by search
  const filteredUshers = ushers.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-charcoal flex items-center gap-2">
            <Users className="w-6 h-6 text-gold" />
            Manajemen Usher
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola akun usher, pantau aktivitas, dan kontrol akses
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-charcoal hover:bg-charcoal/90 text-gold font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Usher
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cari usher..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-charcoal">{ushers.length}</p>
            <p className="text-xs text-muted-foreground">Total Usher</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{ushers.filter(u => u.isActive).length}</p>
            <p className="text-xs text-muted-foreground">Aktif</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{ushers.filter(u => !u.isActive).length}</p>
            <p className="text-xs text-muted-foreground">Nonaktif</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{ushers.reduce((s, u) => s + (u._count?.activityLogs || 0), 0)}</p>
            <p className="text-xs text-muted-foreground">Total Aktivitas</p>
          </CardContent>
        </Card>
      </div>

      {/* Usher List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : filteredUshers.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'Tidak ada usher yang cocok' : 'Belum ada akun usher'}
            </p>
            {!searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Tambah Usher Pertama
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredUshers.map(usher => (
            <Card key={usher.id} className="border-border/50 overflow-hidden">
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleExpand(usher)}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  usher.isActive ? 'bg-gold/20' : 'bg-gray-200'
                }`}>
                  <User className={`w-5 h-5 ${usher.isActive ? 'text-gold' : 'text-gray-400'}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-charcoal truncate">{usher.name || usher.username}</p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        usher.isActive
                          ? 'border-green-200 text-green-700 bg-green-50'
                          : 'border-red-200 text-red-700 bg-red-50'
                      }`}
                    >
                      {usher.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    @{usher.username} &middot; Bergabung {formatDate(usher.createdAt)}
                  </p>
                </div>

                {/* Activity count */}
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-sm font-medium text-charcoal">{usher._count?.activityLogs || 0}</p>
                  <p className="text-[10px] text-muted-foreground">aktivitas</p>
                </div>

                {/* Expand toggle */}
                {expandedId === usher.id
                  ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                }
              </div>

              {/* Expanded section */}
              {expandedId === usher.id && (
                <div className="border-t border-border/30 px-4 py-3 bg-muted/10">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); openEdit(usher) }}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); handleToggleActive(usher) }}
                    >
                      {usher.isActive ? (
                        <><PowerOff className="w-3.5 h-3.5 mr-1 text-red-500" /> Nonaktifkan</>
                      ) : (
                        <><Power className="w-3.5 h-3.5 mr-1 text-green-500" /> Aktifkan</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); openLogs(usher) }}
                    >
                      <Activity className="w-3.5 h-3.5 mr-1" />
                      Lihat Log
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => { e.stopPropagation(); setDeletingUsher(usher); setShowDeleteDialog(true) }}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Hapus
                    </Button>
                  </div>

                  {/* Quick logs preview */}
                  {quickLogs.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Aktivitas Terakhir</p>
                      {quickLogs.slice(0, 3).map(log => (
                        <div key={log.id} className="flex items-center gap-2 text-xs">
                          <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground shrink-0">{formatDate(log.createdAt)}</span>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
                            {ACTION_LABELS[log.action] || log.action}
                          </Badge>
                          <span className="text-muted-foreground truncate">{log.details || ''}</span>
                        </div>
                      ))}
                      {usher._count && usher._count.activityLogs > 3 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openLogs(usher) }}
                          className="text-[10px] text-gold hover:underline"
                        >
                          Lihat semua {usher._count.activityLogs} aktivitas...
                        </button>
                      )}
                    </div>
                  )}

                  {quickLogs.length === 0 && !logsLoading && (
                    <p className="text-xs text-muted-foreground mt-2">Belum ada aktivitas</p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Plus className="w-5 h-5 text-gold" />
              Tambah Usher Baru
            </DialogTitle>
            <DialogDescription>
              Buat akun usher baru untuk scan tiket dan mengelola penonton
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Username *</Label>
              <Input
                placeholder="contoh: usher1"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input
                placeholder="contoh: Budi Santoso"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <div className="relative">
                <Input
                  type={showFormPassword ? 'text' : 'password'}
                  placeholder="Minimal 4 karakter"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowFormPassword(!showFormPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Batal</Button>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting || !formUsername.trim() || !formPassword.trim()}
              className="bg-charcoal hover:bg-charcoal/90 text-gold"
            >
              {isSubmitting ? 'Menyimpan...' : 'Buat Usher'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Pencil className="w-5 h-5 text-gold" />
              Edit Usher: {editingUsher?.name || editingUsher?.username}
            </DialogTitle>
            <DialogDescription>
              Ubah informasi akun usher
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Password Baru (kosongkan jika tidak ingin mengubah)</Label>
              <div className="relative">
                <Input
                  type={showEditPassword ? 'text' : 'password'}
                  placeholder="Password baru"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Status Akun</p>
                <p className="text-xs text-muted-foreground">
                  {editIsActive ? 'Usher dapat login dan melakukan tugas' : 'Usher tidak dapat login'}
                </p>
              </div>
              <Button
                variant={editIsActive ? 'default' : 'destructive'}
                size="sm"
                onClick={() => setEditIsActive(!editIsActive)}
              >
                {editIsActive ? (
                  <><Power className="w-4 h-4 mr-1" /> Aktif</>
                ) : (
                  <><PowerOff className="w-4 h-4 mr-1" /> Nonaktif</>
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Batal</Button>
            <Button
              onClick={handleUpdate}
              disabled={isSubmitting}
              className="bg-charcoal hover:bg-charcoal/90 text-gold"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Activity className="w-5 h-5 text-gold" />
              Log Aktivitas: {logsUsher?.name || logsUsher?.username}
            </DialogTitle>
            <DialogDescription>
              Riwayat aktivitas akun usher ini
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {logsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada aktivitas</p>
              </div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="mt-0.5">
                    <Badge variant="outline" className={`text-[9px] ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-charcoal">{log.details || log.action}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {formatDate(log.createdAt)}
                      {log.ipAddress && (
                        <>&middot; IP: {log.ipAddress}</>
                      )}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Hapus Usher
            </DialogTitle>
            <DialogDescription>
              Tindakan ini tidak dapat dibatalkan
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Apakah Anda yakin ingin menghapus akun usher{' '}
              <strong className="text-charcoal">&quot;{deletingUsher?.name || deletingUsher?.username}&quot;</strong>?
              Semua data aktivitas terkait juga akan dihapus.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Batal</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
