import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

// GET — Get single usher details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const usher = await db.admin.findFirst({
      where: { id, role: 'usher' },
      select: {
        id: true,
        username: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!usher) {
      return NextResponse.json({ error: 'Usher tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ usher })
  } catch (error) {
    console.error('Error fetching usher:', error)
    return NextResponse.json({ error: 'Failed to fetch usher' }, { status: 500 })
  }
}

// PUT — Update usher (name, password, isActive)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, password, isActive } = body

    const existing = await db.admin.findFirst({
      where: { id, role: 'usher' },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Usher tidak ditemukan' }, { status: 404 })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (isActive !== undefined) updateData.isActive = isActive
    if (password) {
      if (password.length < 4) {
        return NextResponse.json(
          { error: 'Password minimal 4 karakter' },
          { status: 400 }
        )
      }
      updateData.password = hashPassword(password)
    }

    const updated = await db.admin.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Log activity
    const changes: string[] = []
    if (name !== undefined) changes.push(`nama diubah ke "${name}"`)
    if (isActive !== undefined) changes.push(isActive ? 'akun diaktifkan' : 'akun dinonaktifkan')
    if (password) changes.push('password diubah')

    if (changes.length > 0) {
      try {
        await db.activityLog.create({
          data: {
            adminId: existing.id,
            adminName: existing.name || existing.username,
            action: 'ACCOUNT_UPDATED',
            details: `Akun usher "${existing.username}": ${changes.join(', ')}`,
          },
        })
      } catch {}
    }

    return NextResponse.json({ usher: updated })
  } catch (error) {
    console.error('Error updating usher:', error)
    return NextResponse.json({ error: 'Failed to update usher' }, { status: 500 })
  }
}

// DELETE — Delete usher account
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.admin.findFirst({
      where: { id, role: 'usher' },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Usher tidak ditemukan' }, { status: 404 })
    }

    // Delete activity logs first (cascade should handle this, but explicit for clarity)
    await db.activityLog.deleteMany({ where: { adminId: id } })
    await db.admin.delete({ where: { id } })

    // Log this action under a system log or skip
    console.log(`[Admin] Usher "${existing.username}" deleted`)

    return NextResponse.json({ message: 'Usher berhasil dihapus' })
  } catch (error) {
    console.error('Error deleting usher:', error)
    return NextResponse.json({ error: 'Failed to delete usher' }, { status: 500 })
  }
}
