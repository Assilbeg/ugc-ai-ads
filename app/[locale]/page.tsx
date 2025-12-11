import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function LocaleHomePage({
  params,
}: {
  params: { locale: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const basePath = `/${params.locale}`

  if (user) {
    redirect(`${basePath}/dashboard`)
  }

  redirect(`${basePath}/login`)
}
