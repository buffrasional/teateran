import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const template = await db.emailTemplate.findFirst({
      where: { isActive: true },
    })

    if (!template) {
      // Return default template if none exists
      const defaultTemplate = {
        name: 'default',
        greeting: 'Dear {customerName},',
        rules: 'Please arrive 30 minutes before show time. No outside food or drinks allowed.',
        notes: 'Present this e-ticket at the entrance.',
        footer: 'Thank you for choosing Teateran.',
        isActive: true,
      }

      // Auto-create the default template
      const created = await db.emailTemplate.create({
        data: defaultTemplate,
      })

      return NextResponse.json({ template: created })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error fetching email template:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email template' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, greeting, rules, notes, footer } = body

    // Find the active template
    const activeTemplate = await db.emailTemplate.findFirst({
      where: { isActive: true },
    })

    if (activeTemplate) {
      // Update existing template
      const updated = await db.emailTemplate.update({
        where: { id: activeTemplate.id },
        data: {
          name: name ?? activeTemplate.name,
          greeting: greeting ?? activeTemplate.greeting,
          rules: rules ?? activeTemplate.rules,
          notes: notes ?? activeTemplate.notes,
          footer: footer ?? activeTemplate.footer,
        },
      })

      return NextResponse.json({ template: updated })
    } else {
      // Create new template
      const created = await db.emailTemplate.create({
        data: {
          name: name || 'default',
          greeting: greeting || 'Dear {customerName},',
          rules: rules || 'Please arrive 30 minutes before show time.',
          notes: notes || 'Present this e-ticket at the entrance.',
          footer: footer || 'Thank you for choosing Teateran.',
          isActive: true,
        },
      })

      return NextResponse.json({ template: created }, { status: 201 })
    }
  } catch (error) {
    console.error('Error updating email template:', error)
    return NextResponse.json(
      { error: 'Failed to update email template' },
      { status: 500 }
    )
  }
}
