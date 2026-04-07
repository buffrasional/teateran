'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Drama, Calendar, LayoutGrid, Mail, ChevronLeft,
  LogOut, Loader2, ShieldCheck, ShoppingBag, Tag, ScanLine, Users, Gift, Map
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const adminLinks = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: Drama },
  { href: '/admin/events', label: 'Kelola Events', icon: Calendar },
  { href: '/admin/seat-maps', label: 'Seat Maps', icon: Map },
  { href: '/admin/ushers', label: 'Manajemen Usher', icon: Users },
  { href: '/admin/tickets/complimentary', label: 'Tiket Komplimen', icon: Gift },
  { href: '/admin/email-template', label: 'Email Template', icon: Mail },
  { href: '/admin/merchandise', label: 'Merchandise', icon: ShoppingBag },
  { href: '/admin/promo-codes', label: 'Kode Promo', icon: Tag },
  { href: '/admin/scanner', label: 'Scanner Tiket', icon: ScanLine },
]

const usherLinks = [
  { href: '/admin/scanner', label: 'Scanner Tiket', icon: ScanLine },
  { href: '/admin/usher/events', label: 'Database Penonton', icon: Users },
  { href: '/admin/usher/merchandise', label: 'Merchandise Orders', icon: ShoppingBag },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [adminRole, setAdminRole] = useState<string | null>(null)
  const [adminName, setAdminName] = useState<string | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const isRedirecting = useRef(false)
  const authCheckedRef = useRef(false)

  const isLoginPage = pathname === '/admin/login'
  const isUsherMode = adminRole === 'usher'
  const isUsherPath = pathname.startsWith('/admin/usher') || pathname === '/admin/scanner'

  // Don't show loading spinner on login page
  const isLoading = useMemo(() => !isLoginPage && isAuthLoading, [isLoginPage, isAuthLoading])

  const doRedirect = useCallback((path: string) => {
    if (!isRedirecting.current) {
      isRedirecting.current = true
      router.replace(path).finally(() => { isRedirecting.current = false })
    }
  }, [router])

  const checkAuth = useCallback(async (signal: AbortSignal) => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)
      const res = await fetch('/api/admin/auth/login', {
        signal: controller.signal,
        credentials: 'include',
      })
      clearTimeout(timeoutId)

      if (res.ok) {
        const data = await res.json()
        if (data.authenticated) {
          setIsAuthenticated(true)
          setAdminName(data.admin?.name || data.admin?.username || 'Admin')
          setAdminRole(data.admin?.role || 'admin')
          authCheckedRef.current = true
          return data.admin
        }
      }
    } catch {
      // API failed, try localStorage fallback
    }

    // Fallback: check localStorage (for proxy environments)
    try {
      const stored = localStorage.getItem('teateran_admin')
      if (stored) {
        const admin = JSON.parse(stored)
        setIsAuthenticated(true)
        setAdminName(admin?.name || admin?.username || 'Admin')
        setAdminRole(admin?.role || 'admin')
        authCheckedRef.current = true
        return admin
      }
    } catch {
      // ignore
    }

    return null
  }, [])

  // Auth check - runs on mount and when pathname changes, but skips re-check if already authed
  useEffect(() => {
    if (isLoginPage) return

    const abortController = new AbortController()

    async function runCheck() {
      // If already authenticated from a previous check, just validate role guards
      if (authCheckedRef.current && isAuthenticated) {
        const role = adminRole || 'admin'
        if (role === 'usher' && !isUsherPath) {
          doRedirect('/admin/usher')
          return
        }
        if (role === 'admin' && pathname.startsWith('/admin/usher')) {
          doRedirect('/admin')
          return
        }
        setIsAuthLoading(false)
        return
      }

      const admin = await checkAuth(abortController.signal)
      if (abortController.signal.aborted) return

      if (admin) {
        const role = admin?.role || 'admin'
        if (role === 'usher' && !isUsherPath) {
          doRedirect('/admin/usher')
          return
        }
        if (role === 'admin' && pathname.startsWith('/admin/usher')) {
          doRedirect('/admin')
          return
        }
      } else {
        doRedirect('/admin/login')
        return
      }
      setIsAuthLoading(false)
    }

    runCheck()

    return () => {
      abortController.abort()
    }
  }, [isLoginPage, isUsherPath, pathname, isAuthenticated, adminRole, checkAuth, doRedirect])

  // Handle logout
  async function handleLogout() {
    try {
      localStorage.removeItem('teateran_role')
      localStorage.removeItem('teateran_admin')
    } catch {
      // ignore
    }
    try { await fetch('/api/admin/auth/logout', { method: 'POST' }) } catch { /* ignore */ }
    authCheckedRef.current = false
    setIsAuthenticated(false)
    setAdminRole(null)
    setAdminName(null)
    router.replace('/admin/login')
  }

  // Login page - no layout wrapper
  if (isLoginPage) {
    return <>{children}</>
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-gold animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Memverifikasi akses...</p>
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated) {
    return null
  }

  // Determine which sidebar links to show
  const sidebarLinks = isUsherMode ? usherLinks : adminLinks
  const panelLabel = isUsherMode ? 'USHER' : 'ADMIN'
  const PanelIcon = isUsherMode ? ScanLine : ShieldCheck

  return (
    <div className="min-h-screen flex bg-warm-white">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-40 w-64 bg-charcoal text-white flex flex-col transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <Link href="/admin/dashboard" className="flex items-center gap-2">
              <PanelIcon className="w-6 h-6 text-gold" />
              <span className="font-serif text-sm font-semibold">
                {panelLabel} <span className="text-gold">PANEL</span>
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-white/50 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Admin/Usher Name */}
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-xs text-white/30 uppercase tracking-widest">Masuk sebagai</p>
          <p className="text-sm text-white/80 font-medium mt-0.5 truncate">{adminName}</p>
          {isUsherMode && (
            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-gold/20 text-gold font-medium">
              Usher
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {sidebarLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href))
            return (
              <Link
                key={link.href + link.label}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-gold/20 text-gold font-medium'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                )}
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="p-4 border-t border-white/10 space-y-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-white/40 hover:text-red-400 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-white/40 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Kembali ke Situs
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            ☰ Menu
          </Button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{adminName}</span>
            {isUsherMode && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold/10 text-gold-dark font-medium border border-gold/20">
                Usher
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs text-muted-foreground hover:text-danger">
              <LogOut className="w-3.5 h-3.5 mr-1" />
              Keluar
            </Button>
          </div>
        </div>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
