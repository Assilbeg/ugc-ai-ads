import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// fal.ai configuration
const FAL_KEY = process.env.FAL_KEY

// Interface pour fal.ai ffmpeg-api/compose
interface Track {
  id: string
  type: 'video' | 'audio'
  keyframes: { url: string; timestamp: number; duration: number }[]
}

interface ComposeOutput {
  video_url: string
  thumbnail_url?: string
}

/**
 * Input pour chaque clip (simplifié - trim/speed déjà appliqués par Transloadit)
 */
interface ClipInput {
  rawUrl: string          // URL de la vidéo (déjà traitée si trim/speed)
  duration: number        // Durée finale en secondes
  clipOrder?: number      // Ordre du clip dans la campagne
}

/**
 * Helper pour mettre à jour le status de la campagne
 */
async function updateCampaignStatus(supabase: any, campaignId: string, status: string) {
  try {
    await (supabase
      .from('campaigns') as any)
      .update({ status })
      .eq('id', campaignId)
  } catch (err) {
    console.error('[Assemble] Failed to update campaign status:', err)
  }
}

/**
 * Assemble multiple video clips into a single video using fal.ai FFmpeg API
 * Sauvegarde dans campaign_assemblies pour garder l'historique (versioning)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  let campaignId: string | undefined
  
  try {
    const body = await request.json()
    campaignId = body.campaignId
    const { clips, videoUrls } = body as {
      clips?: ClipInput[]
      videoUrls?: string[] // Ancien format (fallback)
      campaignId: string
    }

    // Support ancien format (videoUrls) ou nouveau format (clips)
    const clipsToProcess: ClipInput[] = clips || (videoUrls?.map(url => ({ rawUrl: url, duration: 6 })) ?? [])

    if (clipsToProcess.length === 0) {
      if (campaignId) await updateCampaignStatus(supabase, campaignId, 'failed')
      return NextResponse.json(
        { error: 'clips ou videoUrls est requis' },
        { status: 400 }
      )
    }

    if (!FAL_KEY) {
      if (campaignId) await updateCampaignStatus(supabase, campaignId, 'failed')
      return NextResponse.json(
        { error: 'FAL_KEY non configuré' },
        { status: 500 }
      )
    }

    console.log('[Assemble] Starting assembly of', clipsToProcess.length, 'clips')
    console.log('[Assemble] Clips data:', JSON.stringify(clipsToProcess, null, 2))

    // Les clips arrivent déjà traités (trim/speed appliqués par Transloadit côté client)
    // On les prépare simplement pour FFmpeg concat
    const processedClips = clipsToProcess.map((clip, i) => {
      console.log(`[Assemble] Clip ${i + 1}:`, {
        url: clip.rawUrl?.slice(0, 80),
        duration: clip.duration,
        clipOrder: clip.clipOrder,
      })
      
      return {
        url: clip.rawUrl,
        duration: clip.duration,
        clipOrder: clip.clipOrder ?? i + 1
      }
    })

    // ═══════════════════════════════════════════════════════════════════
    // UTILISER FFMPEG COMPOSE - Concatène les vidéos via keyframes séquentiels
    // ═══════════════════════════════════════════════════════════════════
    
    console.log('[Assemble] ═══════════════════════════════════════')
    console.log('[Assemble] Using FFmpeg compose (sequential keyframes):')
    processedClips.forEach((c, i) => {
      console.log(`[Assemble]   Clip ${i + 1}: ${c.url.slice(0, 80)}... (${c.duration}s)`)
    })
    console.log('[Assemble] ═══════════════════════════════════════')

    // Construire les keyframes séquentiels pour la track vidéo
    let currentTimestamp = 0
    const videoKeyframes: { url: string; timestamp: number; duration: number }[] = []
    
    for (const clip of processedClips) {
      const durationMs = clip.duration * 1000
      videoKeyframes.push({
        url: clip.url,
        timestamp: currentTimestamp,
        duration: durationMs
      })
      currentTimestamp += durationMs
    }
    
    const totalDurationMs = currentTimestamp
    
    console.log('[Assemble] Video keyframes:', videoKeyframes.length, 'total duration:', totalDurationMs / 1000, 's')
    
    // Créer la track vidéo avec tous les keyframes
    const tracks: Track[] = [
      {
        id: 'video-track',
        type: 'video',
        keyframes: videoKeyframes
      }
    ]

    // Appeler fal.ai FFmpeg compose
    console.log('[Assemble] Calling fal.ai FFmpeg compose...')
    
    const response = await fetch('https://fal.run/fal-ai/ffmpeg-api/compose', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tracks })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Assemble] fal.ai error:', errorText)
      throw new Error(`fal.ai error: ${response.status} - ${errorText}`)
    }

    const result: ComposeOutput = await response.json()
    
    if (!result.video_url) {
      throw new Error('No video_url from FFmpeg compose')
    }
    
    console.log('[Assemble] Video assembled:', result.video_url?.slice(0, 50))

    // Préparer les ajustements pour la sauvegarde
    const clipAdjustments = clipsToProcess.map((clip, index) => ({
      clip_order: clip.clipOrder ?? index + 1,
      original_url: clip.rawUrl,
      final_duration: clip.duration
    }))

    // Estimer la durée totale (somme des durées planifiées)
    const estimatedDuration = processedClips.reduce((sum, c) => sum + c.duration, 0)

    // Sauvegarder dans campaign_assemblies (versioning)
    if (campaignId && result.video_url) {
      const supabase = await createClient()
      
      // 1. Créer une nouvelle entrée dans campaign_assemblies
      const { data: assembly, error: assemblyError } = await (supabase
        .from('campaign_assemblies') as any)
        .insert({
          campaign_id: campaignId,
          final_video_url: result.video_url,
          thumbnail_url: result.thumbnail_url || null,
          duration_seconds: estimatedDuration,
          clip_adjustments: clipAdjustments
        })
        .select()
        .single()

      if (assemblyError) {
        console.error('[Assemble] Error saving assembly:', assemblyError)
        // Fallback: mettre à jour la campagne directement si la table n'existe pas encore
        if (assemblyError.code === '42P01') { // Table doesn't exist
          console.log('[Assemble] campaign_assemblies table not found, updating campaign directly')
          await (supabase
            .from('campaigns') as any)
            .update({ 
              final_video_url: result.video_url,
              status: 'completed'
            })
            .eq('id', campaignId)
        }
      } else {
        console.log('[Assemble] Assembly saved with version:', assembly?.version || 'unknown')
      }

      // 2. Mettre à jour la campagne avec le dernier assemblage (pour compatibilité)
      await (supabase
        .from('campaigns') as any)
        .update({ 
          final_video_url: result.video_url,
          status: 'completed'
        })
        .eq('id', campaignId)
      
      console.log('[Assemble] Campaign updated with final video')
    }

    return NextResponse.json({
      videoUrl: result.video_url,
      thumbnailUrl: result.thumbnail_url || null,
      duration: totalDurationMs / 1000,
      clipCount: clipsToProcess.length,
      // Debug: URLs utilisées pour l'assemblage
      debug: {
        method: 'ffmpeg-concat',
        processedClips: processedClips.map((c) => ({
          clipOrder: c.clipOrder,
          urlUsed: c.url.slice(0, 120),
        }))
      }
    })
  } catch (error) {
    console.error('[Assemble] Error:', error)
    
    // Mettre le status en 'failed' en cas d'erreur
    if (campaignId) {
      await updateCampaignStatus(supabase, campaignId, 'failed')
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur assemblage' },
      { status: 500 }
    )
  }
}
