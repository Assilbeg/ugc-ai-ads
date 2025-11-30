'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={handleLogout}
      className="text-muted-foreground hover:text-foreground h-9 px-3 rounded-lg"
    >
      <LogOut className="w-4 h-4 mr-2" />
      <span className="hidden sm:inline">Déconnexion</span>
    </Button>
  )
}
