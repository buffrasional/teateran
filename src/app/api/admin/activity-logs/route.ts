import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET — List activity logs with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get('adminId') || undefined
    const action = searchParams.get('action') || undefined
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)
    const offset = Number(searchParams.get('offset')) || 0

    const where: any = {}
    if (adminId) where.adminId = adminId
    if (action) where.action = action

    const [logs, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        select: {
          id: true,
          adminId: true,
          adminName: true,
          action: true,
          details: true,
          ipAddress: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.activityLog.count({ where }),
    ])

    return NextResponse.json({ logs, total, limit, offset })
  } catch (error) {
    console.error('Error fetching activity logs:', error)
    return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 })
  }
}
