import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getPresetById } from '@/lib/presets'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AssemblingAnimation } from './assembling-animation'
import { EditableTitle } from './editable-title'
import { FailedCampaignState } from './failed-campaign-state'
import { SubmagicActions } from './submagic-actions'
import { TemplateImage } from './template-image'
import type { SubmagicStatus } from '@/types'
import { getTranslations } from 'next-intl/server'

// Désactiver le cache pour toujours avoir la dernière version de la campagne
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface CampaignPageProps {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ assembling?: string }>
}

export default async function CampaignPage({ params, searchParams }: CampaignPageProps) {
  const { id, locale } = await params
  const { assembling: assemblingParam } = await searchParams
  const supabase = await createClient()
  const tNav = await getTranslations('nav')
  const tStatus = await getTranslations('status')
  const tCampaign = await getTranslations('campaignPage')
  const basePath = `/${locale}`

  // Fetch campaign with clips
  const { data: campaign, error } = await (supabase
    .from('campaigns') as any)
    .select('*')
    .eq('id', id)
    .single()

  if (error || !campaign) {
    notFound()
  }

  const { data: clips } = await (supabase
    .from('campaign_clips') as any)
    .select('*')
    .eq('campaign_id', id)
    .order('order', { ascending: true })

  // Récupérer l'historique des assemblages (si la table existe)
  const { data: assemblies } = await (supabase
    .from('campaign_assemblies') as any)
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Récupérer l'historique des versions de sous-titres
  const { data: submagicVersions } = await (supabase
    .from('submagic_versions') as any)
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Le dernier assemblage (version la plus récente)
  const latestAssembly = assemblies?.[0] as any
  
  // URL de la vidéo originale (sans sous-titres)
  const baseVideoUrl = latestAssembly?.final_video_url || campaign.final_video_url
  const cacheBuster = latestAssembly?.created_at 
    ? new Date(latestAssembly.created_at).getTime() 
    : Date.now()
  const originalVideoUrl = baseVideoUrl 
    ? `${baseVideoUrl}${baseVideoUrl.includes('?') ? '&' : '?'}v=${cacheBuster}`
    : null
  
  // Dernière version de sous-titres (depuis l'historique)
  const latestSubmagicVersion = submagicVersions?.[0] as any
  const hasSubtitles = latestSubmagicVersion?.video_url && campaign.submagic_status !== 'processing'
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RÈGLE CRITIQUE : Afficher la DERNIÈRE version modifiée (avec OU sans sous-titres)
  // On compare les dates du dernier assemblage et des derniers sous-titres
  // La plus récente gagne !
  // ═══════════════════════════════════════════════════════════════════════════
  const latestAssemblyDate = latestAssembly?.created_at ? new Date(latestAssembly.created_at).getTime() : 0
  const latestSubmagicDate = latestSubmagicVersion?.created_at ? new Date(latestSubmagicVersion.created_at).getTime() : 0
  
  // Si sous-titres existent ET sont plus récents que le dernier assemblage → afficher sous-titres
  // Sinon → afficher la vidéo originale (assemblage le plus récent)
  const shouldShowSubtitles = hasSubtitles && latestSubmagicDate > latestAssemblyDate
  const latestVersionVideo = shouldShowSubtitles ? latestSubmagicVersion.video_url : originalVideoUrl

  const preset = campaign.preset_id ? getPresetById(campaign.preset_id) : null
  const brief = campaign.brief as { what_selling?: string; target_duration?: number }
  const product = campaign.product as { has_product?: boolean }
  
  // Calcul de la durée totale (utiliser celle de l'assemblage si disponible)
  const totalDuration = latestAssembly?.duration_seconds 
    ? Math.round(latestAssembly.duration_seconds)
    : clips?.reduce((sum: number, c: any) => {
        const video = c.video as { duration?: number }
        return sum + (video?.duration || 0)
      }, 0) || 0

  // Titre court (max 60 chars)
  const title = brief?.what_selling 
    ? brief.what_selling.length > 60 
      ? brief.what_selling.slice(0, 60) + '...'
      : brief.what_selling
    : tCampaign('defaultTitle')

  const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
    draft: { bg: 'bg-zinc-100', text: 'text-zinc-600', dot: 'bg-zinc-400' },
    generating: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500 animate-pulse' },
    assembling: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500 animate-pulse' },
    completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    failed: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  }

  const statusLabels: Record<string, string> = {
    draft: tStatus('draft'),
    generating: tStatus('generating'),
    assembling: tStatus('assembling'),
    completed: tStatus('completed'),
    failed: tStatus('failed'),
  }

  const status = statusConfig[campaign.status] || statusConfig.draft

  // Si en cours d'assemblage OU si on vient de cliquer sur "Assembler", afficher l'animation
  const showAssemblingAnimation = campaign.status === 'assembling' || assemblingParam === '1'
  
  if (showAssemblingAnimation) {
    return (
      <div className="max-w-6xl mx-auto">
        <Link 
          href={`${basePath}/dashboard`} 
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {tNav('dashboard')}
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
        href={`${basePath}/dashboard`} 
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {tNav('dashboard')}
      </Link>

      {/* Hero section avec vidéo */}
      {campaign.status === 'completed' && latestVersionVideo ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-10">
          {/* Vidéo - 3 colonnes */}
          <div className="lg:col-span-3">
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-800 shadow-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.15),transparent_50%)]" />
              <div className="relative p-3 sm:p-4">
                <video
                  src={latestVersionVideo}
                  controls
                  className="w-full rounded-xl shadow-lg"
                  style={{ maxHeight: '70vh' }}
                />
                {/* Overlay de génération en cours */}
                {campaign.submagic_status === 'processing' && (
                  <div className="absolute inset-3 sm:inset-4 rounded-xl bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-violet-500/30 border-t-violet-500 animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl">🔤</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-semibold text-lg">{tCampaign('subtitlesProcessingTitle')}</p>
                      <p className="text-zinc-400 text-sm mt-1">{tCampaign('subtitlesProcessingEta')}</p>
                    </div>
                    {(campaign as any).submagic_config?.templateName && (
                      <div className="px-3 py-1.5 rounded-full bg-violet-500/20 text-violet-300 text-sm">
                        {tCampaign('templateLabel', { name: (campaign as any).submagic_config.templateName })}
                      </div>
                    )}
                  </div>
                )}
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
                <div className="flex items-center gap-2">
                  {/* Bouton Télécharger (vidéo originale, sans sous-titres) */}
                  {originalVideoUrl && (
                    <a 
                      href={originalVideoUrl} 
                      download={`ugc-campaign-${id.slice(0, 8)}.mp4`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" className="bg-white text-zinc-900 hover:bg-zinc-100 font-medium rounded-lg gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {tCampaign('download')}
                      </Button>
                    </a>
                  )}
                  {/* Bouton Télécharger avec sous-titres (si disponible) */}
                  {hasSubtitles && latestSubmagicVersion && (
                    <a 
                      href={latestSubmagicVersion.video_url} 
                      download={`ugc-subtitles-v${latestSubmagicVersion.version_number}-${id.slice(0, 8)}.mp4`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" className="bg-violet-600 text-white hover:bg-violet-700 font-medium rounded-lg gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {tCampaign('downloadWithSubtitles')}
                      </Button>
                    </a>
                  )}
                </div>
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
            <EditableTitle
              campaignId={id}
              initialTitle={brief?.what_selling || 'Campagne UGC'}
              brief={brief || {}}
              className="text-2xl sm:text-3xl font-bold text-foreground leading-tight"
            />

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {preset && (
                <Badge variant="secondary" className="rounded-lg px-3 py-1">
                  {tCampaign('presetBadgePrefix', { name: preset.name })}
                </Badge>
              )}
              <Badge variant="outline" className="rounded-lg px-3 py-1">
                {tCampaign('targetDuration', { duration: brief?.target_duration || 30 })}
              </Badge>
              <Badge variant="outline" className="rounded-lg px-3 py-1">
                {product?.has_product ? tCampaign('withProduct') : tCampaign('withoutProduct')}
              </Badge>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="bg-muted/50 rounded-xl p-4">
                <div className="text-3xl font-bold text-foreground">{clips?.length || 0}</div>
                <div className="text-sm text-muted-foreground">{tCampaign('clipsGenerated')}</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-4">
                <div className="text-3xl font-bold text-foreground">{totalDuration}s</div>
                <div className="text-sm text-muted-foreground">{tCampaign('finalDuration')}</div>
              </div>
            </div>

            {/* Date */}
            <div className="text-sm text-muted-foreground pt-2">
              {tCampaign('createdAt', {
                date: new Date(campaign.created_at).toLocaleDateString(locale, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                }),
              })}
            </div>

            {/* Actions secondaires : Modifier la vidéo + Modifier les sous-titres */}
            <div className="flex gap-3 pt-2">
              <Link href={`${basePath}/new/${id}`} className="flex-1">
                <Button variant="outline" className="w-full rounded-xl h-11">
                  {tCampaign('editVideo')}
                </Button>
              </Link>
              
              <div className="flex-1">
                <SubmagicActions
                  campaignId={id}
                  campaignTitle={brief?.what_selling || 'Campagne UGC'}
                  submagicStatus={(campaign.submagic_status || 'none') as SubmagicStatus}
                />
              </div>
            </div>
          </div>
        </div>
      ) : campaign.status !== 'failed' ? (
        /* Header simple si pas de vidéo finale et pas en échec */
        <div className="mb-8">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-4 ${status.bg} ${status.text}`}>
            <span className={`w-2 h-2 rounded-full ${status.dot}`} />
            {statusLabels[campaign.status]}
          </div>
          <EditableTitle
            campaignId={id}
            initialTitle={brief?.what_selling || 'Campagne UGC'}
            brief={brief || {}}
            className="text-2xl sm:text-3xl font-bold text-foreground mb-3"
          />
          <div className="flex flex-wrap items-center gap-3">
            {preset && (
              <Badge variant="secondary" className="rounded-lg">{preset.name}</Badge>
            )}
            <span className="text-sm text-muted-foreground">
              {brief?.target_duration || 30}s • {product?.has_product ? tCampaign('withProduct') : tCampaign('withoutProduct')}
            </span>
            {campaign.status === 'draft' && (
              <Link href={`${basePath}/new/${id}`}>
                <Button size="sm">{tCampaign('continueEditing')}</Button>
              </Link>
            )}
          </div>
        </div>
      ) : null}

      {/* Historique des versions (assemblages + sous-titres) - FUSIONNÉS et triés par date */}
      {((assemblies && assemblies.length > 0) || (submagicVersions && submagicVersions.length > 0) || campaign.submagic_status === 'processing') && campaign.status !== 'failed' && (() => {
        // Fusionner assemblages et sous-titres dans une liste unique triée par date
        type VersionItem = 
          | { type: 'assembly'; data: any; created_at: string }
          | { type: 'submagic'; data: any; created_at: string }
        
        const allVersions: VersionItem[] = [
          ...(assemblies || []).map((a: any) => ({ type: 'assembly' as const, data: a, created_at: a.created_at })),
          ...(submagicVersions || []).map((s: any) => ({ type: 'submagic' as const, data: s, created_at: s.created_at }))
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        
        // Trouver l'ID de la version courante (la plus récente globalement)
        const currentVersionId = allVersions[0]?.data?.id
        
        return (
          <div className="mb-8 p-4 rounded-xl bg-muted/30 border border-border">
            <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {tCampaign('versionHistory', { count: allVersions.length + (campaign.submagic_status === 'processing' ? 1 : 0) })}
            </h3>
            <div className="space-y-2">
              {/* Sous-titres en cours de génération - Toujours en premier */}
              {campaign.submagic_status === 'processing' && (() => {
                const processingTemplateName = (campaign as any).submagic_config?.templateName
                return (
                  <div 
                    className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 animate-pulse"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        {tCampaign('subtitlesProcessingShort')}
                      </span>
                      {processingTemplateName && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/50">
                          <TemplateImage templateName={processingTemplateName} />
                          <span className="text-xs font-medium text-amber-800 dark:text-amber-200">{processingTemplateName}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      {tCampaign('etaShort')}
                    </span>
                  </div>
                )
              })()}
              
              {/* Toutes les versions triées par date décroissante */}
              {allVersions.map((item, index) => {
                const isCurrentVersion = item.data.id === currentVersionId
                
                if (item.type === 'submagic') {
                  const version = item.data
                  const config = version.config || {}
                  return (
                    <div 
                      key={`submagic-${version.id}`}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isCurrentVersion 
                          ? 'bg-violet-50 border border-violet-200 dark:bg-violet-950/30 dark:border-violet-800'
                          : 'bg-background border border-border'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${isCurrentVersion ? 'text-violet-700 dark:text-violet-300' : 'text-muted-foreground'}`}>
                          🔤 v{version.version_number}
                        </span>
                        {config.templateName && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800">
                            <TemplateImage templateName={config.templateName} />
                            <span className="text-xs font-medium">{config.templateName}</span>
                          </div>
                        )}
                        {config.hasHook && (
                          <Badge variant="outline" className="text-xs border-violet-300 text-violet-600">
                            Hook
                          </Badge>
                        )}
                        {config.magicZooms && (
                          <Badge variant="outline" className="text-xs border-violet-300 text-violet-600">
                            Zooms
                          </Badge>
                        )}
                        {config.magicBrolls && (
                          <Badge variant="outline" className="text-xs border-violet-300 text-violet-600">
                            B-rolls
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-2">
                          {new Date(version.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {isCurrentVersion && (
                          <Badge className="bg-violet-500 text-white text-xs ml-1">Actuelle</Badge>
                        )}
                      </div>
                      <a 
                        href={version.video_url}
                        download={`ugc-subtitles-v${version.version_number}-${id.slice(0, 8)}.mp4`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button 
                          size="sm" 
                          variant={isCurrentVersion ? 'default' : 'ghost'}
                          className={`h-8 text-xs ${isCurrentVersion ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}
                        >
                          {tCampaign('downloadIcon')}
                        </Button>
                      </a>
                    </div>
                  )
                } else {
                  // Assembly
                  const assembly = item.data
                  return (
                    <div 
                      key={`assembly-${assembly.id}`}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isCurrentVersion ? 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : 'bg-background border border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-medium ${isCurrentVersion ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                          🎬 v{assembly.version || index + 1}
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
                        {isCurrentVersion && (
                          <Badge className="bg-emerald-500 text-white text-xs">{tCampaign('currentVersion')}</Badge>
                        )}
                      </div>
                      <a 
                        href={assembly.final_video_url}
                        download={`ugc-v${assembly.version || index + 1}-${id.slice(0, 8)}.mp4`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant={isCurrentVersion ? 'default' : 'ghost'} className="h-8 text-xs">
                          {tCampaign('downloadIcon')}
                        </Button>
                      </a>
                    </div>
                  )
                }
              })}
            </div>
          </div>
        )
      })()}

      {/* Failed state - campagne en échec */}
      {campaign.status === 'failed' && (
        <FailedCampaignState
          campaignId={id}
          clips={clips || []}
          presetName={preset?.name}
          totalDuration={totalDuration}
          title={brief?.what_selling || 'Campagne UGC'}
          targetDuration={brief?.target_duration || 30}
          hasProduct={product?.has_product || false}
        />
      )}

      {/* Empty state si pas de vidéo et pas en échec */}
      {!latestVersionVideo && campaign.status !== 'failed' && (
        <div className="rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-muted-foreground mb-4">
            {tCampaign('noVideoGenerated')}
          </p>
          <Link href={`${basePath}/new/${id}`}>
            <Button className="rounded-xl">
              {tCampaign('continueGeneration')}
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
