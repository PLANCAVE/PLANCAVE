// Polyfill for `self` in Node.js environment
if (typeof self === 'undefined' && typeof global !== 'undefined') {
  global.self = global;
}

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher([
  '/protected(.*)', // Example: Protect all `/protected` routes
]);

export default clerkMiddleware((auth, req) => {
  if (!auth.userId && isProtectedRoute(req)) {
    return auth.redirectToSignIn();
  }
});

export const config = {
  matcher: [
    // Exclude `signin` and `signup` routes from middleware protection
    '/((?!_next|static|favicon.ico|signin|signup).*)',
  ],
};