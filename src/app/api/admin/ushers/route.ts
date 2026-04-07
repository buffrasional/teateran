import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

// GET — List all usher accounts
export async function GET() {
  try {
    const ushers = await db.admin.findMany({
      where: { role: 'usher' },
      select: {
        id: true,
        username: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { activityLogs: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ ushers })
  } catch (error) {
    console.error('Error fetching ushers:', error)
    return NextResponse.json({ error: 'Failed to fetch ushers' }, { status: 500 })
  }
}

// POST — Create new usher account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, name } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password harus diisi' },
        { status: 400 }
      )
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: 'Username minimal 3 karakter' },
        { status: 400 }
      )
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: 'Password minimal 4 karakter' },
        { status: 400 }
      )
    }

    // Check if username already exists
    const existing = await db.admin.findFirst({ where: { username } })
    if (existing) {
      return NextResponse.json(
        { error: 'Username sudah digunakan' },
        { status: 409 }
      )
    }

    const hashedPw = hashPassword(password)
    const usher = await db.admin.create({
      data: {
        username,
        password: hashedPw,
        name: name || username,
        role: 'usher',
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    })

    // Log activity
    try {
      await db.activityLog.create({
        data: {
          adminId: usher.id,
          adminName: usher.name || usher.username,
          action: 'ACCOUNT_CREATED',
          details: `Akun usher "${username}" dibuat`,
        },
      })
    } catch {}

    return NextResponse.json({ usher }, { status: 201 })
  } catch (error) {
    console.error('Error creating usher:', error)
    return NextResponse.json({ error: 'Failed to create usher' }, { status: 500 })
  }
}
