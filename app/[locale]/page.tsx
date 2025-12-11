import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const basePath = `/${locale}`

  if (user) {
    redirect(`${basePath}/dashboard`)
  }

  redirect(`${basePath}/login`)
}
