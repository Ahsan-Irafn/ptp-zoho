import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/invite',
  '/unsubscribe',
  '/embed',
  '/api/auth/login',
  '/api/webhooks',
  '/api/integrations/elementor',
  '/api/integrations/3cx',
  '/api/cron',
  '/_next',
  '/static',
  '/favicon.ico',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow public routes
  const isPublic = PUBLIC_PATH_PREFIXES.some(prefix => 
    pathname === prefix || pathname.startsWith(prefix + '/')
  );

  if (isPublic) {
    return NextResponse.next();
  }

  // 2. Validate session token presence
  const sessionToken = req.cookies.get('ptp_session_token')?.value;

  if (!sessionToken) {
    // If API request, return 401 Unauthorized
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ 
        error: 'Unauthorized: Valid authentication session required.',
        code: 'UNAUTHENTICATED'
      }, { status: 401 });
    }

    // If browser request, redirect to /login
    const loginUrl = new URL('/login', req.url);
    if (pathname !== '/' && pathname !== '/dashboard') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
