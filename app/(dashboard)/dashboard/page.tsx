import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Video, ArrowRight } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Fetch user's campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'Brouillon', variant: 'secondary' },
    generating: { label: 'En cours', variant: 'default' },
    completed: { label: 'Terminé', variant: 'outline' },
    failed: { label: 'Échec', variant: 'destructive' },
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Mes campagnes</h1>
          <p className="text-muted-foreground mt-2">
            Crée et gère tes publicités UGC générées par IA
          </p>
        </div>
        <Link href="/new">
          <Button className="h-11 px-5 rounded-xl font-medium group">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle campagne
            <ArrowRight className="w-4 h-4 ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
          </Button>
        </Link>
      </div>

      {/* Campaigns grid */}
      {campaigns && campaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <Link key={campaign.id} href={`/campaign/${campaign.id}`}>
              <Card className="group hover:shadow-lg hover:border-foreground/20 transition-all duration-300 cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg font-medium truncate group-hover:text-foreground transition-colors">
                      {(campaign.brief as { what_selling?: string })?.what_selling || 'Sans titre'}
                    </CardTitle>
                    <Badge variant={statusConfig[campaign.status]?.variant || 'secondary'}>
                      {statusConfig[campaign.status]?.label || campaign.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {new Date(campaign.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Video className="w-4 h-4" />
                      <span>{(campaign.brief as { target_duration?: number })?.target_duration || 30}s</span>
                    </div>
                    <span className="text-border">•</span>
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
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
              <Video className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Aucune campagne</h3>
            <p className="text-muted-foreground text-center mb-8 max-w-sm">
              Commence par créer ta première campagne UGC générée par IA
            </p>
            <Link href="/new">
              <Button className="h-11 px-6 rounded-xl font-medium">
                Créer ma première campagne
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
