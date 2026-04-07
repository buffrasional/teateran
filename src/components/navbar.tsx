'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, Drama } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <Drama className="w-7 h-7 text-gold" />
            <span className="font-serif text-xl font-semibold tracking-wide text-charcoal">
              TEATERAN
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/#now-showing"
              className="text-sm font-medium text-muted-foreground hover:text-charcoal transition-colors"
            >
              Sedang Tayang
            </Link>
            <Link
              href="/#coming-soon"
              className="text-sm font-medium text-muted-foreground hover:text-charcoal transition-colors"
            >
              Segera Hadir
            </Link>
            <Link
              href="/verify"
              className="text-sm font-medium text-muted-foreground hover:text-charcoal transition-colors"
            >
              Cek Tiket
            </Link>
            <Link href="/admin">
              <Button variant="outline" size="sm" className="text-xs font-medium">
                Admin Panel
              </Button>
            </Link>
          </div>

          {/* Mobile Menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 bg-background p-6">
              <SheetTitle className="font-serif text-lg text-charcoal mb-6">
                Menu
              </SheetTitle>
              <div className="flex flex-col gap-4">
                <Link
                  href="/#now-showing"
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium text-muted-foreground hover:text-charcoal py-2 transition-colors"
                >
                  Sedang Tayang
                </Link>
                <Link
                  href="/#coming-soon"
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium text-muted-foreground hover:text-charcoal py-2 transition-colors"
                >
                  Segera Hadir
                </Link>
                <Link
                  href="/verify"
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium text-muted-foreground hover:text-charcoal py-2 transition-colors"
                >
                  Cek Tiket
                </Link>
                <div className="zen-divider my-2" />
                <Link href="/admin" onClick={() => setOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Admin Panel
                  </Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
