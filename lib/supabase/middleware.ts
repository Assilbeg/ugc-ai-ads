import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, locales } from '@/i18n/config'

export async function updateSession(request: NextRequest, response?: NextResponse) {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean)
  const maybeLocale = segments[0]
  const locale = locales.includes(maybeLocale as any) ? maybeLocale : defaultLocale
  const pathnameWithoutLocale = locales.includes(maybeLocale as any)
    ? `/${segments.slice(1).join('/')}`
    : request.nextUrl.pathname

  let supabaseResponse = response ?? NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes
  const protectedPaths = ['/dashboard', '/new', '/campaign', '/admin']
  const isProtectedPath = protectedPaths.some(path => pathnameWithoutLocale.startsWith(path))

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/login`
    return NextResponse.redirect(url)
  }

  // Redirect logged in users away from auth pages
  const authPaths = ['/login', '/register']
  const isAuthPath = authPaths.some(path => pathnameWithoutLocale.startsWith(path))

  if (isAuthPath && user) {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/dashboard`
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

