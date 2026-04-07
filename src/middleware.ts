import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /admin routes (except login)
  if (!pathname.startsWith('/admin') || pathname === '/admin/login') {
    return NextResponse.next()
  }

  // Role-based routing (only if cookie exists)
  // Auth check is handled client-side in admin/layout.tsx
  const roleCookie = request.cookies.get('admin_role')?.value

  if (roleCookie === 'usher') {
    const usherAllowedRoutes = ['/admin/usher', '/admin/scanner']
    const isUsherRoute = usherAllowedRoutes.some(r => pathname.startsWith(r))
    if (!isUsherRoute) {
      return NextResponse.redirect(new URL('/admin/usher', request.url))
    }
  }

  // Let request through — layout.tsx handles auth check via API
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
