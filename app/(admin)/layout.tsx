import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { LogoutButton } from '@/components/logout-button'
import { Shield } from 'lucide-react'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (!isAdmin(user.email)) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-foreground flex items-center justify-center">
                <Shield className="w-5 h-5 text-background" />
              </div>
              <span className="font-semibold text-lg">
                Admin
              </span>
            </Link>
            
            {/* Admin Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <Link 
                href="/admin/actors" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Acteurs
              </Link>
              <Link 
                href="/admin/presets" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Presets
              </Link>
              <Link 
                href="/admin/prompts" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Prompts
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Retour à l'app
            </Link>
            <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
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
