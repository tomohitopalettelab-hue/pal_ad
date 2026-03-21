import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { parseSessionValue, isExpired, SESSION_COOKIE_NAME } from './lib/auth-session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = parseSessionValue(cookieValue);

    if (!session || isExpired(session) || session.role !== 'admin') {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
