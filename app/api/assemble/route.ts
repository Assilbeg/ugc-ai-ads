import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// fal.ai configuration
const FAL_KEY = process.env.FAL_KEY

// Interface pour fal.ai ffmpeg-api/run (concat)
interface FFmpegRunInput {
  input_files: { url: string }[]
  arguments: string
}

interface FFmpegRunOutput {
  files: { url: string; content_type: string; file_name: string; file_size: number }[]
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
    // UTILISER FFMPEG CONCAT - Pas de durée fixe = pas de décalage lipsync !
    // On utilise la durée RÉELLE des vidéos, pas la durée planifiée
    // ═══════════════════════════════════════════════════════════════════
    
    console.log('[Assemble] ═══════════════════════════════════════')
    console.log('[Assemble] Using FFmpeg concat (real durations):')
    processedClips.forEach((c, i) => {
      console.log(`[Assemble]   Clip ${i + 1}: ${c.url.slice(0, 80)}...`)
    })
    console.log('[Assemble] ═══════════════════════════════════════')

    // Préparer les fichiers d'entrée pour fal.ai
    const input_files = processedClips.map(c => ({ url: c.url }))
    
    // Construire la commande FFmpeg concat
    // Pour N vidéos: [0:v:0][0:a:0][1:v:0][1:a:0]...[N:v:0][N:a:0]concat=n=N:v=1:a=1[outv][outa]
    const n = processedClips.length
    
    // Construire les streams d'entrée
    let filterInputs = ''
    for (let i = 0; i < n; i++) {
      filterInputs += `[${i}:v:0][${i}:a:0]`
    }
    
    // La commande complète
    const ffmpegArgs = `-filter_complex "${filterInputs}concat=n=${n}:v=1:a=1[outv][outa]" -map "[outv]" -map "[outa]" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k output.mp4`
    
    console.log('[Assemble] FFmpeg command:', ffmpegArgs)
    
    const ffmpegInput: FFmpegRunInput = {
      input_files,
      arguments: ffmpegArgs
    }

    // Appeler fal.ai FFmpeg run (concat = durées réelles)
    const response = await fetch('https://fal.run/fal-ai/ffmpeg-api/run', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ffmpegInput)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Assemble] fal.ai error:', errorText)
      throw new Error(`fal.ai error: ${response.status}`)
    }

    const result: FFmpegRunOutput = await response.json()
    const outputFile = result.files?.[0]
    
    if (!outputFile?.url) {
      throw new Error('No output file from FFmpeg')
    }
    
    console.log('[Assemble] Video assembled:', outputFile.url?.slice(0, 50))

    // Préparer les ajustements pour la sauvegarde
    const clipAdjustments = clipsToProcess.map((clip, index) => ({
      clip_order: clip.clipOrder ?? index + 1,
      original_url: clip.rawUrl,
      final_duration: clip.duration
    }))

    // Estimer la durée totale (somme des durées planifiées)
    const estimatedDuration = processedClips.reduce((sum, c) => sum + c.duration, 0)

    // Sauvegarder dans campaign_assemblies (versioning)
    if (campaignId && outputFile.url) {
      const supabase = await createClient()
      
      // 1. Créer une nouvelle entrée dans campaign_assemblies
      const { data: assembly, error: assemblyError } = await (supabase
        .from('campaign_assemblies') as any)
        .insert({
          campaign_id: campaignId,
          final_video_url: outputFile.url,
          thumbnail_url: null, // FFmpeg run ne retourne pas de thumbnail
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
              final_video_url: outputFile.url,
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
          final_video_url: outputFile.url,
          status: 'completed'
        })
        .eq('id', campaignId)
      
      console.log('[Assemble] Campaign updated with final video')
    }

    return NextResponse.json({
      videoUrl: outputFile.url,
      thumbnailUrl: null,
      duration: estimatedDuration,
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
