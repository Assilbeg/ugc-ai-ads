import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { LogoutButton } from '@/components/logout-button'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check if user is logged in
  if (!user) {
    redirect('/login')
  }

  // Check if user is admin
  if (!isAdmin(user.email)) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Admin Header */}
      <header className="border-b border-red-900/50 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="font-bold text-lg text-red-400">
                Admin
              </span>
            </Link>
            
            {/* Admin Navigation */}
            <nav className="flex items-center gap-4">
              <Link 
                href="/admin/actors" 
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Acteurs
              </Link>
              <Link 
                href="/admin/presets" 
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Presets
              </Link>
              <Link 
                href="/admin/prompts" 
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Prompts
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard" 
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              ← Retour à l'app
            </Link>
            <span className="text-sm text-red-400">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}

