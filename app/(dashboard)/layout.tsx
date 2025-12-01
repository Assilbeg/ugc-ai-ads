import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/logout-button'
import { isAdmin } from '@/lib/admin'
import { formatCredits } from '@/lib/credits'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const userIsAdmin = isAdmin(user.email)
  
  // Get user credits (not needed for admin - they have unlimited)
  let userBalance = 0
  if (!userIsAdmin) {
    const { data: userCredits } = await (supabase
      .from('user_credits') as any)
      .select('balance')
      .eq('user_id', user.id)
      .single()
    userBalance = userCredits?.balance || 0
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-foreground flex items-center justify-center">
                <span className="text-background font-bold text-sm">U</span>
              </div>
              <span className="font-semibold text-lg text-foreground">
                UGC AI
              </span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link 
                href="/dashboard" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Campagnes
              </Link>
              <Link 
                href="/dashboard/billing" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Facturation
              </Link>
              {userIsAdmin && (
                <Link 
                  href="/admin" 
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Admin
                </Link>
              )}
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Credits display */}
            <Link 
              href="/dashboard/billing"
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                userIsAdmin 
                  ? 'bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20' 
                  : 'bg-muted/50 hover:bg-muted'
              }`}
            >
              <svg className={`w-4 h-4 ${userIsAdmin ? 'text-violet-500' : 'text-emerald-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={`text-sm font-medium ${userIsAdmin ? 'text-violet-500' : ''}`}>
                {userIsAdmin ? '∞' : formatCredits(userBalance)}
              </span>
            </Link>
            
            <Link 
              href="/new"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nouvelle campagne
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
