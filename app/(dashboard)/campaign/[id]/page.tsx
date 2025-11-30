import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getPresetById } from '@/lib/presets'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AssemblingAnimation } from './assembling-animation'

interface CampaignPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ assembling?: string }>
}

export default async function CampaignPage({ params, searchParams }: CampaignPageProps) {
  const { id } = await params
  const { assembling: assemblingParam } = await searchParams
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

  // Récupérer l'historique des assemblages (si la table existe)
  const { data: assemblies } = await supabase
    .from('campaign_assemblies')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Le dernier assemblage (version la plus récente)
  const latestAssembly = assemblies?.[0]
  
  // Utiliser l'URL du dernier assemblage si disponible, sinon celle de la campagne
  const finalVideoUrl = latestAssembly?.final_video_url || campaign.final_video_url

  const preset = campaign.preset_id ? getPresetById(campaign.preset_id) : null
  const brief = campaign.brief as { what_selling?: string; target_duration?: number }
  const product = campaign.product as { has_product?: boolean }
  
  // Calcul de la durée totale (utiliser celle de l'assemblage si disponible)
  const totalDuration = latestAssembly?.duration_seconds 
    ? Math.round(latestAssembly.duration_seconds)
    : clips?.reduce((sum, c) => {
        const video = c.video as { duration?: number }
        return sum + (video?.duration || 0)
      }, 0) || 0

  // Titre court (max 60 chars)
  const title = brief?.what_selling 
    ? brief.what_selling.length > 60 
      ? brief.what_selling.slice(0, 60) + '...'
      : brief.what_selling
    : 'Campagne UGC'

  const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
    draft: { bg: 'bg-zinc-100', text: 'text-zinc-600', dot: 'bg-zinc-400' },
    generating: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500 animate-pulse' },
    assembling: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500 animate-pulse' },
    completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    failed: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  }

  const statusLabels: Record<string, string> = {
    draft: 'Brouillon',
    generating: 'En cours',
    assembling: 'Assemblage...',
    completed: 'Terminé',
    failed: 'Échec',
  }

  const status = statusConfig[campaign.status] || statusConfig.draft

  // Si en cours d'assemblage OU si on vient de cliquer sur "Assembler", afficher l'animation
  const showAssemblingAnimation = campaign.status === 'assembling' || assemblingParam === '1'
  
  if (showAssemblingAnimation) {
    return (
      <div className="max-w-6xl mx-auto">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Campagnes
        </Link>
        
        <AssemblingAnimation 
          campaignId={id}
          title={title}
          clipCount={clips?.length || 0}
          presetName={preset?.name}
        />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <Link 
        href="/dashboard" 
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Campagnes
      </Link>

      {/* Hero section avec vidéo */}
      {campaign.status === 'completed' && finalVideoUrl ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-10">
          {/* Vidéo - 3 colonnes */}
          <div className="lg:col-span-3">
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-800 shadow-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.15),transparent_50%)]" />
              <div className="relative p-3 sm:p-4">
                <video
                  src={finalVideoUrl}
                  controls
                  className="w-full rounded-xl shadow-lg"
                  style={{ maxHeight: '70vh' }}
                  poster={(clips?.[0]?.first_frame as { image_url?: string })?.image_url}
                />
              </div>
              {/* Barre d'action en bas */}
              <div className="relative px-4 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-400 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{totalDuration}s</span>
                  <span className="text-zinc-600">•</span>
                  <span>{clips?.length || 0} clips</span>
                </div>
                <a 
                  href={finalVideoUrl} 
                  download={`ugc-campaign-${id.slice(0, 8)}.mp4`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" className="bg-white text-zinc-900 hover:bg-zinc-100 font-medium rounded-lg gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Télécharger
                  </Button>
                </a>
              </div>
            </div>
          </div>

          {/* Infos - 2 colonnes */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status badge */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${status.bg} ${status.text}`}>
              <span className={`w-2 h-2 rounded-full ${status.dot}`} />
              {statusLabels[campaign.status]}
            </div>

            {/* Titre */}
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
              {title}
            </h1>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {preset && (
                <Badge variant="secondary" className="rounded-lg px-3 py-1">
                  🎬 {preset.name}
                </Badge>
              )}
              <Badge variant="outline" className="rounded-lg px-3 py-1">
                ⏱️ {brief?.target_duration || 30}s cible
              </Badge>
              <Badge variant="outline" className="rounded-lg px-3 py-1">
                {product?.has_product ? '📦 Avec produit' : '💬 Sans produit'}
              </Badge>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="bg-muted/50 rounded-xl p-4">
                <div className="text-3xl font-bold text-foreground">{clips?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Clips générés</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-4">
                <div className="text-3xl font-bold text-foreground">{totalDuration}s</div>
                <div className="text-sm text-muted-foreground">Durée finale</div>
              </div>
            </div>

            {/* Date */}
            <div className="text-sm text-muted-foreground pt-2">
              Créé le {new Date(campaign.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>

            {/* Actions secondaires */}
            <div className="flex gap-3 pt-2">
              <Link href={`/new/${id}`} className="flex-1">
                <Button variant="outline" className="w-full rounded-xl h-11">
                  ✏️ Modifier
                </Button>
              </Link>
              <a 
                href={finalVideoUrl} 
                download={`ugc-campaign-${id.slice(0, 8)}.mp4`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button className="w-full rounded-xl h-11 gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Télécharger
                </Button>
              </a>
            </div>
          </div>
        </div>
      ) : (
        /* Header simple si pas de vidéo finale */
        <div className="mb-8">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-4 ${status.bg} ${status.text}`}>
            <span className={`w-2 h-2 rounded-full ${status.dot}`} />
            {statusLabels[campaign.status]}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            {preset && (
              <Badge variant="secondary" className="rounded-lg">{preset.name}</Badge>
            )}
            <span className="text-sm text-muted-foreground">
              {brief?.target_duration || 30}s • {product?.has_product ? 'Avec produit' : 'Sans produit'}
            </span>
            {campaign.status === 'draft' && (
              <Link href={`/new/${id}`}>
                <Button size="sm">Continuer l'édition</Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Historique des versions (si plusieurs assemblages) */}
      {assemblies && assemblies.length > 1 && (
        <div className="mb-8 p-4 rounded-xl bg-muted/30 border border-border">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Historique des versions ({assemblies.length})
          </h3>
          <div className="space-y-2">
            {assemblies.map((assembly, index) => (
              <div 
                key={assembly.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  index === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-background border border-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${index === 0 ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                    v{assembly.version || assemblies.length - index}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(assembly.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  {assembly.duration_seconds && (
                    <span className="text-xs text-muted-foreground">
                      • {Math.round(assembly.duration_seconds)}s
                    </span>
                  )}
                  {index === 0 && (
                    <Badge className="bg-emerald-500 text-white text-xs">Actuelle</Badge>
                  )}
                </div>
                <a 
                  href={assembly.final_video_url}
                  download={`ugc-v${assembly.version || assemblies.length - index}-${id.slice(0, 8)}.mp4`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant={index === 0 ? 'default' : 'ghost'} className="h-8 text-xs">
                    📥 Télécharger
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state si pas de vidéo */}
      {!finalVideoUrl && (
        <div className="rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-muted-foreground mb-4">
            Aucune vidéo n'a encore été générée pour cette campagne.
          </p>
          <Link href={`/new/${id}`}>
            <Button className="rounded-xl">
              🚀 Générer la vidéo
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
