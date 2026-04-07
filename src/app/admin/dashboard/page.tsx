'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Plus, Ticket, Users, TrendingUp, ArrowRight } from 'lucide-react'

interface DashboardStats {
  totalEvents: number
  publishedEvents: number
  totalTransactions: number
  totalRevenue: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEvents: 0,
    publishedEvents: 0,
    totalTransactions: 0,
    totalRevenue: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/events')
        if (res.ok) {
          const data = await res.json()
          const events = data.events || []
          setStats({
            totalEvents: events.length,
            publishedEvents: events.filter((e: any) => e.isPublished).length,
            totalTransactions: 0,
            totalRevenue: 0,
          })
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  const statCards = [
    {
      label: 'Total Events',
      value: stats.totalEvents,
      icon: Calendar,
      color: 'text-gold',
      bg: 'bg-gold/10',
    },
    {
      label: 'Published',
      value: stats.publishedEvents,
      icon: TrendingUp,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'Transactions',
      value: stats.totalTransactions,
      icon: Ticket,
      color: 'text-seat-student',
      bg: 'bg-seat-student/10',
    },
    {
      label: 'Revenue',
      value: `Rp ${(stats.totalRevenue || 0).toLocaleString('id-ID')}`,
      icon: Users,
      color: 'text-seat-vip',
      bg: 'bg-seat-vip/10',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-charcoal">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Selamat datang di Admin Panel Teateran</p>
        </div>
        <Link href="/admin/events">
          <Button className="bg-charcoal hover:bg-charcoal/90 text-gold">
            <Plus className="w-4 h-4 mr-2" />
            Buat Event
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-border/50 hover:border-gold/30 transition-colors cursor-pointer group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-base font-semibold text-charcoal">Manage Events</h3>
                <p className="text-xs text-muted-foreground mt-1">Create, edit, and publish events</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-gold transition-colors" />
            </div>
          </CardContent>
          <Link href="/admin/events" className="absolute inset-0" />
        </Card>

        <Card className="border-border/50 hover:border-gold/30 transition-colors cursor-pointer group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-base font-semibold text-charcoal">Seat Map Editor</h3>
                <p className="text-xs text-muted-foreground mt-1">Customize seat layout and pricing</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-gold transition-colors" />
            </div>
          </CardContent>
          <Link href="/admin/seat-maps" className="absolute inset-0" />
        </Card>

        <Card className="border-border/50 hover:border-gold/30 transition-colors cursor-pointer group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-base font-semibold text-charcoal">Email Templates</h3>
                <p className="text-xs text-muted-foreground mt-1">Edit E-Ticket email templates</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-gold transition-colors" />
            </div>
          </CardContent>
          <Link href="/admin/email-template" className="absolute inset-0" />
        </Card>
      </div>
    </div>
  )
}
