import { db } from './src/lib/db'
import { hashPassword } from './src/lib/auth'

async function reset() {
  console.log("Using APP_SECRET:", process.env.APP_SECRET)
  
  const adminPw = hashPassword('admin123')
  await db.admin.upsert({
    where: { username: 'admin' },
    update: { password: adminPw, role: 'admin' },
    create: { username: 'admin', password: adminPw, name: 'Administrator', role: 'admin' }
  })
  
  const usherPw = hashPassword('usher123')
  await db.admin.upsert({
    where: { username: 'usher1' },
    update: { password: usherPw, role: 'usher' },
    create: { username: 'usher1', password: usherPw, name: 'Usher 1', role: 'usher' }
  })
  
  console.log("Passwords forcibly reset to admin123 and usher123")
}

reset().catch(console.error).finally(async () => await db.$disconnect())
