import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req) {
  const path = req.nextUrl.pathname;
  const token = await getToken({ req });

  // Protected routes
  const protectedRoutes = [
    '/dashboard',
    '/api/purchases',
    '/plans/purchased'
  ];

  // Role-based redirects
  if (path.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Admin-only routes
    if (path.startsWith('/dashboard/admin') && token.role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    // Architect-only routes
    if (path.startsWith('/dashboard/architect') && token.role !== 'designer') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  }

  // API protection
  if (path.startsWith('/api') && !path.startsWith('/api/auth')) {
    if (!token) {
      return NextResponse.json(
        { message: 'Unauthorized' }, 
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}