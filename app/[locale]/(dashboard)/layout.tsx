import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { LogoutButton } from '@/components/logout-button'
import { CreditsDisplay } from '@/components/credits-display'
import { isAdmin } from '@/lib/admin'
import { LocaleSwitcher } from '@/components/locale-switcher'

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tNav = await getTranslations('nav')

  if (!user) {
    redirect(`/${params.locale}/login`)
  }

  const userIsAdmin = isAdmin(user.email)
  const basePath = `/${params.locale}`

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href={`${basePath}/dashboard`} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-foreground flex items-center justify-center">
                <span className="text-background font-bold text-sm">U</span>
              </div>
              <span className="font-semibold text-lg text-foreground">
                UGC AI
              </span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link 
                href={`${basePath}/dashboard`} 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {tNav('dashboard')}
              </Link>
              <Link 
                href={`${basePath}/dashboard/billing`} 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {tNav('billing')}
              </Link>
              {userIsAdmin && (
                <Link 
                  href={`${basePath}/admin`} 
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {tNav('admin')}
                </Link>
              )}
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <LocaleSwitcher className="hidden md:block" />
            {/* Credits display - Client Component with auto-refresh */}
            <CreditsDisplay isAdmin={userIsAdmin} />
            
            <Link 
              href={`${basePath}/new`}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {tNav('newCampaign')}
            </Link>
            <span className="text-sm text-muted-foreground hidden md:block">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  )
}
