// Force correct DATABASE_URL before anything loads
if (!process.env.DATABASE_URL?.startsWith('postgresql')) {
  process.env.DATABASE_URL = 'postgresql://postgres.lpdujkpjkcpyiptzyeml:SXcu1zaz1sYqki3R@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
}

export async function register() {
  // Next.js instrumentation hook
}
