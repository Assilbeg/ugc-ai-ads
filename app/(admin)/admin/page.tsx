import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AdminDashboard() {
  const supabase = await createClient()
  
  // Get counts
  const { count: actorsCount } = await supabase
    .from('actors')
    .select('*', { count: 'exact', head: true })
  
  const { count: presetsCount } = await supabase
    .from('intention_presets')
    .select('*', { count: 'exact', head: true })
  
  const { count: campaignsCount } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })

  const stats = [
    {
      title: 'Acteurs',
      count: actorsCount || 0,
      href: '/admin/actors',
      description: 'Gérer les acteurs IA',
      icon: '🎭',
    },
    {
      title: 'Presets',
      count: presetsCount || 0,
      href: '/admin/presets',
      description: 'Templates d\'intention',
      icon: '🎨',
    },
    {
      title: 'Prompts',
      count: 3,
      href: '/admin/prompts',
      description: 'Prompts système',
      icon: '📝',
    },
    {
      title: 'Campagnes',
      count: campaignsCount || 0,
      href: '/dashboard',
      description: 'Total utilisateurs',
      icon: '📊',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard Admin</h1>
        <p className="text-zinc-400 mt-1">Gérer les acteurs, presets et prompts</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-white">{stat.title}</CardTitle>
                  <span className="text-2xl">{stat.icon}</span>
                </div>
                <CardDescription className="text-zinc-500">
                  {stat.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-white">{stat.count}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Ajouter un acteur</CardTitle>
            <CardDescription>
              Créer un nouvel acteur IA avec SOUL
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link 
              href="/admin/actors?new=true"
              className="inline-flex items-center px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm"
            >
              + Nouvel acteur
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Éditer les prompts</CardTitle>
            <CardDescription>
              Modifier le mega prompt Claude ou NanoBanana
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link 
              href="/admin/prompts"
              className="inline-flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm"
            >
              Éditer prompts
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Gérer les presets</CardTitle>
            <CardDescription>
              Ajouter ou modifier les templates d'intention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link 
              href="/admin/presets"
              className="inline-flex items-center px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg text-sm"
            >
              Gérer presets
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

