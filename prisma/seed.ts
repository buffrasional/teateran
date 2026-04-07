import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth'

async function seed() {
  console.log('Seeding database...')

  // Create default admin account
  const existingAdmin = await db.admin.findFirst({ where: { username: 'admin' } })
  if (!existingAdmin) {
    const hashedPw = hashPassword('admin123')
    await db.admin.create({
      data: {
        username: 'admin',
        password: hashedPw,
        name: 'Administrator',
        role: 'admin',
      },
    })
    console.log('Default admin created (username: admin, password: admin123)')
  }

  // Create default usher account
  const existingUsher = await db.admin.findFirst({ where: { username: 'usher1' } })
  if (!existingUsher) {
    const hashedPw = hashPassword('usher123')
    await db.admin.create({
      data: {
        username: 'usher1',
        password: hashedPw,
        name: 'Usher 1',
        role: 'usher',
      },
    })
    console.log('Default usher created (username: usher1, password: usher123)')
  }

  // Create a default email template
  const existingTemplate = await db.emailTemplate.findFirst()
  if (!existingTemplate) {
    await db.emailTemplate.create({
      data: {
        name: 'default',
        greeting: 'Dear {customerName},',
        rules: 'Silakan datang 30 menit sebelum pertunjukan dimulai. Makanan dan minuman dari luar tidak diperkenankan masuk. Mohon menjaga ketenangan selama pertunjukan berlangsung. Dilarang merekam atau memotret selama pertunjukan.',
        notes: 'Perlihatkan e-ticket ini di pintu masuk sebagai bukti pembayaran. E-ticket ini hanya berlaku untuk satu kali masuk.',
        footer: 'Terima kasih telah memilih Teateran. Selamat menikmati pertunjukan!',
        isActive: true,
      },
    })
    console.log('Default email template created.')
  }

  // Create a sample event
  const existingEvents = await db.event.count()
  if (existingEvents === 0) {
    const event = await db.event.create({
      data: {
        title: 'Hamlet - Pertunjukan Spesial',
        category: 'Teater',
        showDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        openGate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 - 30 * 60 * 1000),
        location: 'Teateran, Jl. Rendra No. 1, Jakarta Selatan',
        posterUrl: '',
        synopsis: 'Hamlet adalah sebuah tragedi karya William Shakespeare yang menceritakan kisah Pangeran Hamlet dari Kerajaan Denmark yang berusaha membalas kematian ayahnya yang dibunuh oleh pamannya, Claudius.\n\nPertunjukan ini akan menampilkan interpretasi modern dari karya klasik ini, dengan arahan sutradara terkemuka Indonesia dan pemeran utama yang telah berpengalaman di dunia teater selama puluhan tahun.\n\nDurasi pertunjukan: 2 jam 30 menit (dengan jeda 15 menit)',
        isPublished: true,
        priceCategories: {
          create: [
            { name: 'VIP', price: 150000, colorCode: '#C8A951' },
            { name: 'Regular', price: 75000, colorCode: '#8B8680' },
            { name: 'Student', price: 35000, colorCode: '#7BA7A5' },
          ],
        },
      },
      include: { priceCategories: true },
    })

    // Generate seats
    const ROW_CONFIG = [
      { row: 'A', count: 8, category: 'VIP' },
      { row: 'B', count: 8, category: 'VIP' },
      { row: 'C', count: 10, category: 'VIP' },
      { row: 'D', count: 10, category: 'Regular' },
      { row: 'E', count: 10, category: 'Regular' },
      { row: 'F', count: 10, category: 'Regular' },
      { row: 'G', count: 10, category: 'Student' },
      { row: 'H', count: 10, category: 'Student' },
      { row: 'I', count: 12, category: 'Student' },
      { row: 'J', count: 12, category: 'Student' },
    ]

    const priceCategoryMap = new Map<string, string>()
    for (const pc of event.priceCategories) {
      priceCategoryMap.set(pc.name, pc.id)
    }

    const seatData: {
      eventId: string
      seatCode: string
      status: string
      row: string
      col: number
      priceCategoryId: string | null
    }[] = []

    for (const layout of ROW_CONFIG) {
      const priceCategoryId = priceCategoryMap.get(layout.category) || null
      for (let i = 1; i <= layout.count; i++) {
        seatData.push({
          eventId: event.id,
          seatCode: `${layout.row}-${i}`,
          status: 'AVAILABLE',
          row: layout.row,
          col: i,
          priceCategoryId,
        })
      }
    }

    await db.seat.createMany({ data: seatData })
    console.log(`Event "${event.title}" created with ${seatData.length} seats.`)

    // Create a second event (coming soon)
    const event2 = await db.event.create({
      data: {
        title: 'Romeo & Juliet - A Modern Love',
        category: 'Teater',
        showDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        location: 'Teateran, Jl. Rendra No. 1, Jakarta Selatan',
        posterUrl: '',
        synopsis: 'Adaptasi modern dari kisah klasik Romeo dan Juliet karya Shakespeare. Pertunjukan ini mengeksplorasi tema cinta, konflik keluarga, dan pilihan hidup dalam konteks Indonesia kontemporer.\n\nDengan musik orisinal dan tata panggung yang memukau, pertunjukan ini akan membawa penonton dalam perjalanan emosional yang tak terlupakan.',
        isPublished: true,
        priceCategories: {
          create: [
            { name: 'VIP', price: 200000, colorCode: '#C8A951' },
            { name: 'Regular', price: 100000, colorCode: '#8B8680' },
            { name: 'Student', price: 50000, colorCode: '#7BA7A5' },
          ],
        },
      },
    })

    console.log(`Event "${event2.title}" created.`)
  }

  console.log('Seeding complete!')
}

seed()
  .catch((e) => {
    console.error('Seeding error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
