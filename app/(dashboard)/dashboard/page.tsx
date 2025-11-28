import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Fetch user's campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  const statusColors: Record<string, string> = {
    draft: 'bg-zinc-600',
    generating: 'bg-amber-600',
    completed: 'bg-green-600',
    failed: 'bg-red-600',
  }

  const statusLabels: Record<string, string> = {
    draft: 'Brouillon',
    generating: 'En cours',
    completed: 'Terminé',
    failed: 'Échec',
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Mes campagnes</h1>
          <p className="text-zinc-400 mt-1">Crée et gère tes publicités UGC générées par IA</p>
        </div>
        <Link href="/new">
          <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500">
            + Nouvelle campagne
          </Button>
        </Link>
      </div>

      {/* Campaigns grid */}
      {campaigns && campaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <Link key={campaign.id} href={`/campaign/${campaign.id}`}>
              <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-white text-lg truncate">
                      {(campaign.brief as { what_selling?: string })?.what_selling || 'Sans titre'}
                    </CardTitle>
                    <Badge className={`${statusColors[campaign.status]} text-white`}>
                      {statusLabels[campaign.status]}
                    </Badge>
                  </div>
                  <CardDescription className="text-zinc-400">
                    {new Date(campaign.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-zinc-500">
                    <span>
                      {(campaign.brief as { target_duration?: number })?.target_duration || 30}s
                    </span>
                    <span>•</span>
                    <span>
                      {(campaign.product as { has_product?: boolean })?.has_product ? 'Avec produit' : 'Sans produit'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        /* Empty state */
        <Card className="bg-zinc-900/50 border-zinc-800 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Aucune campagne</h3>
            <p className="text-zinc-400 text-center mb-6 max-w-sm">
              Commence par créer ta première campagne UGC générée par IA
            </p>
            <Link href="/new">
              <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500">
                Créer ma première campagne
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

