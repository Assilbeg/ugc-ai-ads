// Force dynamic rendering to avoid prerendering issues with Supabase client
export const dynamic = 'force-dynamic'

import { LocaleSwitcher } from '@/components/locale-switcher'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <div className="absolute top-4 right-4 z-10">
        <LocaleSwitcher />
      </div>
      {children}
    </div>
  )
}

