import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getPresetById } from '@/lib/presets'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { CampaignClipsView } from '@/components/campaign-clips-view'

interface CampaignPageProps {
  params: Promise<{ id: string }>
}

export default async function CampaignPage({ params }: CampaignPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch campaign with clips
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !campaign) {
    notFound()
  }

  const { data: clips } = await supabase
    .from('campaign_clips')
    .select('*')
    .eq('campaign_id', id)
    .order('order', { ascending: true })

  const preset = campaign.preset_id ? getPresetById(campaign.preset_id) : null
  const brief = campaign.brief as { what_selling?: string; target_duration?: number }
  const product = campaign.product as { has_product?: boolean }

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    generating: 'bg-amber-600 text-white',
    completed: 'bg-green-600 text-white',
    failed: 'bg-destructive text-destructive-foreground',
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
      <div className="flex items-start justify-between">
        <div>
          <Link 
            href="/dashboard" 
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            ← Retour aux campagnes
          </Link>
          <h1 className="text-3xl font-bold text-foreground">
            {brief?.what_selling || 'Campagne sans titre'}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge className={statusColors[campaign.status]}>
              {statusLabels[campaign.status]}
            </Badge>
            {preset && (
              <Badge variant="secondary">{preset.name}</Badge>
            )}
            <span className="text-sm text-muted-foreground">
              {brief?.target_duration || 30}s • {product?.has_product ? 'Avec produit' : 'Sans produit'}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {campaign.status === 'draft' && (
            <Link href={`/new?continue=${id}`}>
              <Button variant="outline">Continuer l'édition</Button>
            </Link>
          )}
          {campaign.status === 'completed' && campaign.final_video_url && (
            <Button className="bg-primary hover:bg-primary/90">
              📥 Télécharger
            </Button>
          )}
        </div>
      </div>

      {/* Campaign info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Créé le</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground">
              {new Date(campaign.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Clips</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground">
              {clips?.length || 0} clips générés
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Durée totale</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground">
              {clips?.reduce((sum, c) => {
                const video = c.video as { duration?: number }
                return sum + (video?.duration || 0)
              }, 0) || 0}s
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Clips */}
      {clips && clips.length > 0 && (
        <CampaignClipsView clips={clips} campaignId={id} />
      )}

      {/* Empty state for clips */}
      {(!clips || clips.length === 0) && (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Aucun clip n'a encore été généré pour cette campagne.
            </p>
            {campaign.status === 'draft' && (
              <Link href={`/new?continue=${id}`}>
                <Button className="mt-4">Générer les clips</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

