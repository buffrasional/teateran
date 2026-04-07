import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/admin/auth/seed - Create admin account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, name, role } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password harus diisi' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password minimal 6 karakter' },
        { status: 400 }
      )
    }

    const existing = await db.admin.findFirst({
      where: { username },
      select: { id: true },
    })

    const hashedPassword = hashPassword(password)

    if (existing) {
      // Reset password for existing account
      await db.admin.update({
        where: { id: existing.id },
        data: { password: hashedPassword, name: name || username, role: role || 'admin' },
      })
      return NextResponse.json({
        message: 'Password berhasil direset',
        admin: { id: existing.id, username, name: name || username, role: role || 'admin' },
      })
    }

    const admin = await db.admin.create({
      data: {
        username,
        password: hashedPassword,
        name: name || username,
        role: role || 'admin',
      },
    })

    return NextResponse.json({
      message: 'Admin berhasil dibuat',
      admin: { id: admin.id, username: admin.username, name: admin.name, role: admin.role },
    }, { status: 201 })
  } catch (error) {
    console.error('Seed admin error:', error)
    return NextResponse.json(
      { error: 'Gagal membuat admin' },
      { status: 500 }
    )
  }
}

// GET - list admins
export async function GET() {
  try {
    const admins = await db.admin.findMany({
      select: { id: true, username: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ admins })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
