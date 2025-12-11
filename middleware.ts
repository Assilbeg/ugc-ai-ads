import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { defaultLocale, locales } from '@/i18n/config'
import { updateSession } from '@/lib/supabase/middleware'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const pathLocale = pathname.split('/').filter(Boolean)[0] || null

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/e4231377-2382-45db-b33c-82d9e810facf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'H2',
      location: 'middleware.ts:12',
      message: 'middleware entry',
      data: { pathname, pathLocale },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const intlResponse = intlMiddleware(request)
  const redirectLocation = intlResponse.headers.get('location')

  if (redirectLocation) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4231377-2382-45db-b33c-82d9e810facf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H2',
        location: 'middleware.ts:26',
        message: 'intl redirect',
        data: { pathname, redirectLocation },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }

  // If next-intl is redirecting (e.g., inject default locale), return directly
  if (redirectLocation) {
    return intlResponse
  }

  return await updateSession(request, intlResponse)
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
