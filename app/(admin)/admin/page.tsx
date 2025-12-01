import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Palette, FileText, BarChart3, Plus, Settings, Layers, CreditCard, Activity, Wallet } from 'lucide-react'

// Fetch Fal.ai balance
async function getFalBalance(): Promise<{ balance: number; currency: string } | null> {
  const FAL_KEY = process.env.FAL_KEY
  if (!FAL_KEY) return null
  
  try {
    const response = await fetch('https://rest.fal.ai/billing/balance', {
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
      },
      next: { revalidate: 60 }, // Cache for 60 seconds
    })
    
    if (!response.ok) return null
    
    const data = await response.json()
    return {
      balance: data.balance || 0,
      currency: data.currency || 'USD',
    }
  } catch {
    return null
  }
}

export default async function AdminDashboard() {
  const supabase = await createClient()
  
  // Get Fal.ai balance
  const falBalance = await getFalBalance()
  
  // Get counts
  const { count: actorsCount } = await (supabase
    .from('actors') as any)
    .select('*', { count: 'exact', head: true })
  
  const { count: presetsCount } = await (supabase
    .from('intention_presets') as any)
    .select('*', { count: 'exact', head: true })
  
  const { count: campaignsCount } = await (supabase
    .from('campaigns') as any)
    .select('*', { count: 'exact', head: true })

  const stats = [
    {
      title: 'Acteurs',
      count: actorsCount || 0,
      href: '/admin/actors',
      description: 'Gérer les acteurs IA',
      icon: Users,
    },
    {
      title: 'Presets',
      count: presetsCount || 0,
      href: '/admin/presets',
      description: 'Templates d\'intention',
      icon: Palette,
    },
    {
      title: 'Prompts',
      count: 3,
      href: '/admin/prompts',
      description: 'Prompts système',
      icon: FileText,
    },
    {
      title: 'Campagnes',
      count: campaignsCount || 0,
      href: '/dashboard',
      description: 'Total utilisateurs',
      icon: BarChart3,
    },
    {
      title: 'Billing',
      count: null,
      href: '/admin/billing',
      description: 'Gérer les prix et plans',
      icon: CreditCard,
    },
    {
      title: 'Logs',
      count: null,
      href: '/admin/logs',
      description: 'Logs de génération Fal.ai',
      icon: Activity,
    },
  ]

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard Admin</h1>
        <p className="text-muted-foreground mt-2">Gérer les acteurs, presets et prompts</p>
      </div>

      {/* Fal.ai Balance Card */}
      {falBalance && (
        <Card className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-violet-500" />
                </div>
                <div>
                  <CardTitle className="text-lg font-medium">Solde Fal.ai</CardTitle>
                  <CardDescription>Crédits disponibles pour les générations IA</CardDescription>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-violet-500">
                  ${falBalance.balance.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">{falBalance.currency}</p>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.title} href={stat.href}>
              <Card className="group hover:shadow-lg hover:border-foreground/20 transition-all duration-300 cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">{stat.title}</CardTitle>
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <CardDescription>
                    {stat.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {stat.count !== null ? (
                    <p className="text-4xl font-semibold">{stat.count}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Configurer</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Actions rapides</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="group hover:shadow-md transition-all">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">Ajouter un acteur</CardTitle>
                  <CardDescription className="text-sm">
                    Créer un nouvel acteur IA avec SOUL
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Link href="/admin/actors?new=true">
                <Button className="rounded-xl h-10">
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvel acteur
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-md transition-all">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">Éditer les prompts</CardTitle>
                  <CardDescription className="text-sm">
                    Modifier le mega prompt Claude ou NanoBanana
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Link href="/admin/prompts">
                <Button variant="outline" className="rounded-xl h-10">
                  <FileText className="w-4 h-4 mr-2" />
                  Éditer prompts
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-md transition-all">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">Gérer les presets</CardTitle>
                  <CardDescription className="text-sm">
                    Ajouter ou modifier les templates d'intention
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Link href="/admin/presets">
                <Button variant="outline" className="rounded-xl h-10">
                  <Palette className="w-4 h-4 mr-2" />
                  Gérer presets
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
