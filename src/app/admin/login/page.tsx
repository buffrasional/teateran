'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Drama, ShieldCheck, ScanLine, Loader2, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

type Role = 'admin' | 'usher'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role>('admin')

  // Restore role from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('teateran_role')
      if (saved === 'admin' || saved === 'usher') {
        setSelectedRole(saved)
      }
    } catch {
      // ignore
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Clear ALL stale session data first (prevents role-switch flicker)
    try {
      localStorage.removeItem('teateran_role')
      localStorage.removeItem('teateran_admin')
    } catch { /* ignore */ }

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (res.ok && data.admin) {
        // Store fresh session in localStorage (for proxy where cookies may be stripped)
        try {
          localStorage.setItem('teateran_admin', JSON.stringify(data.admin))
        } catch { /* ignore */ }

        // Redirect based on ACTUAL role from server (not UI selector)
        if (data.admin.role === 'usher') {
          router.push('/admin/usher')
        } else {
          router.push('/admin/dashboard')
        }
        return
      }

      setError(data.error || 'Login gagal')
    } catch {
      setError('Terjadi kesalahan koneksi')
    } finally {
      setIsLoading(false)
    }
  }

  const roleCards: { role: Role; label: string; description: string; icon: typeof ShieldCheck }[] = [
    {
      role: 'admin',
      label: 'Login sebagai Admin',
      description: 'Kelola event, merchandise, promo, dan semua data',
      icon: ShieldCheck,
    },
    {
      role: 'usher',
      label: 'Login sebagai Usher',
      description: 'Scan tiket dan lihat database penonton',
      icon: ScanLine,
    },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-white px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-charcoal mb-4">
            <Drama className="w-8 h-8 text-gold" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-charcoal">
            Teateran
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ticketing Management System
          </p>
        </div>

        {/* Role Selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {roleCards.map(({ role, label, description, icon: Icon }) => (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedRole(role)}
              className={cn(
                'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-left',
                selectedRole === role
                  ? 'border-gold bg-gold/5 shadow-md'
                  : 'border-border/50 bg-white hover:border-gold/40 hover:bg-gold/5'
              )}
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
                  selectedRole === role
                    ? 'bg-gold/20'
                    : 'bg-charcoal/5'
                )}
              >
                <Icon
                  className={cn(
                    'w-6 h-6 transition-colors',
                    selectedRole === role
                      ? 'text-gold'
                      : 'text-muted-foreground'
                  )}
                />
              </div>
              <div>
                <p
                  className={cn(
                    'text-sm font-semibold transition-colors',
                    selectedRole === role
                      ? 'text-charcoal'
                      : 'text-muted-foreground'
                  )}
                >
                  {label}
                </p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-tight">
                  {description}
                </p>
              </div>
              {/* Selected indicator */}
              {selectedRole === role && (
                <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-gold" />
              )}
            </button>
          ))}
        </div>

        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="font-serif text-base text-center">
              Masuk ke Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">
                  Username
                </Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  autoComplete="username"
                  required
                  className="bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    autoComplete="current-password"
                    required
                    className="bg-white pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-danger">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || !username || !password}
                className="w-full bg-charcoal hover:bg-charcoal/90 text-gold font-semibold"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  <>
                    <Drama className="w-4 h-4 mr-2" />
                    Masuk sebagai {selectedRole === 'admin' ? 'Admin' : 'Usher'}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          Teateran Ticketing Platform &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
