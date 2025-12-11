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

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const intlResponse = intlMiddleware(request)
  const redirectLocation = intlResponse.headers.get('location')

  // If next-intl is redirecting (e.g., inject default locale), return directly
  if (redirectLocation) {
    return intlResponse
  }

  return await updateSession(request, intlResponse)
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
