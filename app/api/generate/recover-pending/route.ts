import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Fal.ai API pour vérifier le statut et récupérer le résultat
const FAL_KEY = process.env.FAL_KEY

interface FalStatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  response_url?: string
}

interface RecoveredGeneration {
  logId: string
  clipId: string | null
  generationType: string
  status: 'recovered' | 'still_pending' | 'failed'
  videoUrl?: string
}

/**
 * POST /api/generate/recover-pending
 * 
 * Récupère les générations "orphelines" (vidéos générées mais jamais reçues car l'utilisateur a quitté la page)
 * 
 * Body: { campaignId?: string } - Si fourni, ne récupère que les générations de cette campagne
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { campaignId, clipId } = body as { campaignId?: string; clipId?: string }

    // Chercher les generation_logs en pending avec un fal_request_id
    let query = (supabase
      .from('generation_logs') as any)
      .select('id, fal_request_id, generation_type, clip_id, campaign_id, model_path, started_at, estimated_cost_cents')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .not('fal_request_id', 'is', null)
      // Ne récupérer que les générations des dernières 30 minutes (les plus vieilles ont probablement échoué)
      .gte('started_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())

    // Filtrer par campaign_id OU clip_id si fourni
    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }
    if (clipId) {
      query = query.eq('clip_id', clipId)
    }

    const { data: pendingLogs, error: logsError } = await query

    if (logsError) {
      console.error('[RecoverPending] Error fetching logs:', logsError)
      return NextResponse.json({ error: 'Erreur lors de la recherche' }, { status: 500 })
    }

    if (!pendingLogs || pendingLogs.length === 0) {
      return NextResponse.json({ recovered: [], message: 'Aucune génération en attente' })
    }

    console.log(`[RecoverPending] Found ${pendingLogs.length} pending generations for user ${user.id}`)

    const recovered: RecoveredGeneration[] = []

    // Pour chaque génération pending, vérifier le statut auprès de Fal.ai
    for (const log of pendingLogs) {
      try {
        // Construire l'URL de statut à partir du request_id
        // Format: https://queue.fal.run/{model}/requests/{request_id}/status
        const statusUrl = `https://queue.fal.run/${log.model_path}/requests/${log.fal_request_id}/status`
        
        const statusResponse = await fetch(statusUrl, {
          headers: { 'Authorization': `Key ${FAL_KEY}` },
        })

        if (!statusResponse.ok) {
          console.warn(`[RecoverPending] Status check failed for ${log.id}:`, statusResponse.status)
          recovered.push({
            logId: log.id,
            clipId: log.clip_id,
            generationType: log.generation_type,
            status: 'failed',
          })
          continue
        }

        const status: FalStatusResponse = await statusResponse.json()
        console.log(`[RecoverPending] Log ${log.id} status:`, status.status)

        if (status.status === 'COMPLETED' && status.response_url) {
          // Récupérer le résultat
          const resultResponse = await fetch(status.response_url, {
            headers: { 'Authorization': `Key ${FAL_KEY}` },
          })

          if (!resultResponse.ok) {
            console.warn(`[RecoverPending] Result fetch failed for ${log.id}`)
            recovered.push({
              logId: log.id,
              clipId: log.clip_id,
              generationType: log.generation_type,
              status: 'failed',
            })
            continue
          }

          const result = await resultResponse.json()
          const videoUrl = result.video?.url

          if (videoUrl) {
            console.log(`[RecoverPending] ✓ Recovered video for log ${log.id}:`, videoUrl.slice(0, 80))

            // Mettre à jour le generation_log
            await (supabase.from('generation_logs') as any)
              .update({
                status: 'completed',
                output_url: videoUrl,
                completed_at: new Date().toISOString(),
              })
              .eq('id', log.id)

            // Si on a un clip_id, mettre à jour le clip aussi
            if (log.clip_id) {
              const { data: clip } = await (supabase
                .from('campaign_clips') as any)
                .select('video')
                .eq('id', log.clip_id)
                .single()

              if (clip) {
                await (supabase.from('campaign_clips') as any)
                  .update({
                    video: {
                      ...clip.video,
                      raw_url: videoUrl,
                    },
                    status: 'generating_voice', // Prêt pour la prochaine étape
                  })
                  .eq('id', log.clip_id)
              }
            }

            recovered.push({
              logId: log.id,
              clipId: log.clip_id,
              generationType: log.generation_type,
              status: 'recovered',
              videoUrl,
            })
          }
        } else if (status.status === 'FAILED') {
          // Marquer comme échoué
          await (supabase.from('generation_logs') as any)
            .update({
              status: 'failed',
              error_message: 'Generation failed on Fal.ai',
              completed_at: new Date().toISOString(),
            })
            .eq('id', log.id)

          recovered.push({
            logId: log.id,
            clipId: log.clip_id,
            generationType: log.generation_type,
            status: 'failed',
          })
        } else {
          // Toujours en cours
          recovered.push({
            logId: log.id,
            clipId: log.clip_id,
            generationType: log.generation_type,
            status: 'still_pending',
          })
        }
      } catch (err) {
        console.error(`[RecoverPending] Error processing log ${log.id}:`, err)
        recovered.push({
          logId: log.id,
          clipId: log.clip_id,
          generationType: log.generation_type,
          status: 'failed',
        })
      }
    }

    const recoveredCount = recovered.filter(r => r.status === 'recovered').length
    const stillPendingCount = recovered.filter(r => r.status === 'still_pending').length
    const failedCount = recovered.filter(r => r.status === 'failed').length

    console.log(`[RecoverPending] Results: ${recoveredCount} recovered, ${stillPendingCount} still pending, ${failedCount} failed`)

    return NextResponse.json({
      recovered,
      summary: {
        total: recovered.length,
        recovered: recoveredCount,
        stillPending: stillPendingCount,
        failed: failedCount,
      },
    })
  } catch (error) {
    console.error('[RecoverPending] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}
