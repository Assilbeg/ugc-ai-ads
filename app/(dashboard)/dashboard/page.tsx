import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Plus, Video, Clock, Calendar, Play, Sparkles, TrendingUp, ArrowUpRight } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Fetch user's campaigns with clips count and actor info
  const { data: campaigns } = await (supabase
    .from('campaigns') as any)
    .select('*, campaign_clips(count), actors(id, name, soul_image_url)')
    .order('created_at', { ascending: false })

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: 'Brouillon', color: 'text-amber-600', bg: 'bg-amber-500/10' },
    generating: { label: 'En cours', color: 'text-blue-600', bg: 'bg-blue-500/10' },
    assembling: { label: 'Assemblage', color: 'text-purple-600', bg: 'bg-purple-500/10' },
    completed: { label: 'Terminé', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    failed: { label: 'Échec', color: 'text-red-600', bg: 'bg-red-500/10' },
  }

  const completedCount = campaigns?.filter((c: any) => c.status === 'completed').length || 0
  const totalCount = campaigns?.length || 0

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-8 md:p-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-violet-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-3xl" />
        
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-violet-400" />
              <span className="text-sm font-medium text-violet-300">Propulsé par l'IA</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Mes campagnes
            </h1>
            <p className="text-zinc-400 max-w-md">
              Crée et gère tes publicités UGC générées par IA. Chaque campagne peut contenir plusieurs clips optimisés pour les réseaux sociaux.
            </p>
          </div>
          
          <Link href="/new">
            <Button size="lg" className="h-12 px-6 rounded-xl font-semibold bg-white text-zinc-900 hover:bg-zinc-100 shadow-lg shadow-white/20 group">
              <Plus className="w-5 h-5 mr-2" />
              Nouvelle campagne
              <ArrowUpRight className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Button>
          </Link>
        </div>

        {/* Stats */}
        {totalCount > 0 && (
          <div className="relative flex items-center gap-8 mt-8 pt-6 border-t border-white/10">
            <div>
              <div className="text-3xl font-bold text-white">{totalCount}</div>
              <div className="text-sm text-zinc-400">Campagnes</div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <div className="text-3xl font-bold text-emerald-400">{completedCount}</div>
              <div className="text-sm text-zinc-400">Terminées</div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-violet-400" />
              <div>
                <div className="text-lg font-semibold text-white">
                  {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
                </div>
                <div className="text-sm text-zinc-400">Taux de complétion</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Campaigns grid - Format 9:16 */}
      {campaigns && campaigns.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {campaigns.map((campaign: any) => {
            const status = statusConfig[campaign.status] || statusConfig.draft
            const intention = (campaign.brief as { what_selling?: string })?.what_selling || 'Sans titre'
            const duration = (campaign.brief as { target_duration?: number })?.target_duration || 30
            const clipsCount = campaign.campaign_clips?.[0]?.count || 0
            const actor = campaign.actors as { id: string; name: string; soul_image_url: string } | null
            
            return (
              <Link key={campaign.id} href={`/campaign/${campaign.id}`}>
                <div className="group relative bg-card rounded-xl border overflow-hidden hover:shadow-xl hover:shadow-black/5 hover:border-foreground/20 transition-all duration-300 cursor-pointer">
                  {/* Video area - Format 9:16 */}
                  <div className="relative aspect-[9/16] bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 overflow-hidden">
                    {campaign.final_video_url ? (
                      <video 
                        src={campaign.final_video_url} 
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                    ) : actor?.soul_image_url ? (
                      <img 
                        src={actor.soul_image_url} 
                        alt={actor.name}
                        className="w-full h-full object-cover opacity-50"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-2xl bg-white/10 dark:bg-black/20 backdrop-blur flex items-center justify-center">
                          <Video className="w-6 h-6 text-zinc-400" />
                        </div>
                      </div>
                    )}
                    
                    {/* Play overlay on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 shadow-lg">
                        <Play className="w-5 h-5 text-zinc-900 ml-0.5" />
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${status.bg} ${status.color} backdrop-blur-sm`}>
                      {status.label}
                    </div>

                    {/* Duration badge */}
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {duration}s
                    </div>

                    {/* Actor badge */}
                    {actor && (
                      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm">
                        <img 
                          src={actor.soul_image_url} 
                          alt={actor.name}
                          className="w-5 h-5 rounded-full object-cover ring-1 ring-white/30"
                        />
                        <span className="text-white text-[11px] font-medium truncate">{actor.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-3">
                    {/* Intention */}
                    <h3 className="font-medium text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-tight">
                      {intention}
                    </h3>
                    
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-2">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {new Date(campaign.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      {clipsCount > 0 && (
                        <>
                          <span className="text-border">•</span>
                          <span>{clipsCount} clip{clipsCount > 1 ? 's' : ''}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        /* Empty state */
        <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-blue-500/5" />
          <div className="relative flex flex-col items-center justify-center py-20 px-8">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center mb-6">
              <Video className="w-10 h-10 text-violet-500" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Aucune campagne</h3>
            <p className="text-muted-foreground text-center mb-8 max-w-md">
              Commence par créer ta première campagne UGC. Nos acteurs virtuels donneront vie à tes publicités en quelques clics.
            </p>
            <Link href="/new">
              <Button size="lg" className="h-12 px-8 rounded-xl font-semibold shadow-lg shadow-primary/20">
                <Sparkles className="w-5 h-5 mr-2" />
                Créer ma première campagne
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
