import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Transloadit } from 'transloadit'

// Transloadit credentials
const TRANSLOADIT_KEY = process.env.TRANSLOADIT_KEY
const TRANSLOADIT_SECRET = process.env.TRANSLOADIT_SECRET

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
 * Assemble multiple video clips into a single video using Transloadit
 * - Force ré-encodage pour éviter les problèmes de keyframes
 * - Reset des timestamps pour une concaténation propre
 * - Normalise framerate et audio sample rate
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  let campaignId: string | undefined
  
  try {
    const body = await request.json()
    const { clips, campaignId: cId } = body
    campaignId = cId
    
    const clipsToProcess: ClipInput[] = clips

    if (!clipsToProcess || clipsToProcess.length === 0) {
      return NextResponse.json(
        { error: 'Aucun clip fourni' },
        { status: 400 }
      )
    }

    if (!TRANSLOADIT_KEY || !TRANSLOADIT_SECRET) {
      if (campaignId) await updateCampaignStatus(supabase, campaignId, 'failed')
      return NextResponse.json(
        { error: 'TRANSLOADIT_KEY/SECRET non configurés' },
        { status: 500 }
      )
    }

    console.log('[Assemble] Starting assembly of', clipsToProcess.length, 'clips with Transloadit')
    console.log('[Assemble] Clips data:', JSON.stringify(clipsToProcess, null, 2))

    // Trier par clipOrder
    const sortedClips = [...clipsToProcess].sort((a, b) => 
      (a.clipOrder || 0) - (b.clipOrder || 0)
    )

    // Initialiser le client Transloadit
    const transloadit = new Transloadit({
      authKey: TRANSLOADIT_KEY,
      authSecret: TRANSLOADIT_SECRET,
    })

    // Construire les steps Transloadit pour la concaténation
    // Ref: https://transloadit.com/docs/transcoding/video-encoding/concatenate-videos/
    const steps: Record<string, unknown> = {}
    const importStepNames: string[] = []

    // 1. Importer chaque vidéo
    sortedClips.forEach((clip, index) => {
      const stepName = `import_${index + 1}`
      steps[stepName] = {
        robot: '/http/import',
        url: clip.rawUrl
      }
      importStepNames.push(stepName)
    })

    // 2. Concaténer toutes les vidéos
    // Doc: https://transloadit.com/docs/robots/video-concat/
    // "It will pre-transcode the input videos if necessary before concatenation"
    // → Résout automatiquement les problèmes de keyframes et timestamps !
    steps['concatenated'] = {
      robot: '/video/concat',
      use: {
        steps: importStepNames.map((name, index) => ({ 
          name, 
          as: `video_${index + 1}`  // Format requis par la doc
        }))
      },
      result: true,
      preset: 'ipad-high',  // Force ré-encodage H.264 de qualité
      ffmpeg_stack: 'v6.0.0',  // Recommandé par la doc
    }

    // 3. Générer une thumbnail
    steps['thumbnail'] = {
      robot: '/video/thumbs',
      use: 'concatenated',
      result: true,
      count: 1,
      offsets: [0],
      format: 'jpg',
      width: 720,
      height: 1280,
    }

    console.log('[Assemble] Transloadit steps:', Object.keys(steps))
    console.log('[Assemble] Import steps:', importStepNames)

    // Créer et attendre l'assemblage
    const result = await transloadit.createAssembly({
      params: { steps } as any,
      waitForCompletion: true,
    })

    console.log('[Assemble] Assembly result:', result.ok, result.assembly_id)

    if (result.ok !== 'ASSEMBLY_COMPLETED') {
      console.error('[Assemble] Assembly failed:', result.error, result.message)
      throw new Error(result.message || 'Assembly failed')
    }

    // Récupérer les URLs de sortie
    const videoUrl = result.results?.concatenated?.[0]?.ssl_url
    const thumbnailUrl = result.results?.thumbnail?.[0]?.ssl_url

    if (!videoUrl) {
      console.error('[Assemble] No video URL in result:', result.results)
      throw new Error('No output video URL')
    }

    console.log('[Assemble] ✓ Video:', videoUrl.slice(0, 60))
    console.log('[Assemble] ✓ Thumbnail:', thumbnailUrl?.slice(0, 60) || 'none')

    // Calculer la durée totale
    const totalDuration = sortedClips.reduce((sum, c) => sum + (c.duration || 0), 0)

    // Sauvegarder en base de données si on a un campaignId
    if (campaignId) {
      // 1. Créer une entrée dans campaign_assemblies (historique)
      const clipAdjustments = sortedClips.map((c, i) => ({
        clipOrder: c.clipOrder || i + 1,
        duration: c.duration,
      }))

      const { data: assembly, error: assemblyError } = await (supabase
        .from('campaign_assemblies') as any)
        .insert({
          campaign_id: campaignId,
          final_video_url: videoUrl,
          thumbnail_url: thumbnailUrl || null,
          duration_seconds: totalDuration,
          clip_adjustments: clipAdjustments
        })
        .select()
        .single()

      if (assemblyError) {
        console.error('[Assemble] Error saving assembly:', assemblyError)
        // Fallback: mettre à jour la campagne directement si la table n'existe pas encore
        if (assemblyError.code === '42P01') {
          console.log('[Assemble] campaign_assemblies table not found, updating campaign directly')
          await (supabase
            .from('campaigns') as any)
            .update({ 
              final_video_url: videoUrl,
              status: 'completed'
            })
            .eq('id', campaignId)
        }
      } else {
        console.log('[Assemble] Assembly saved with version:', assembly?.version || 'unknown')
      }

      // 2. Mettre à jour la campagne avec le dernier assemblage
      await (supabase
        .from('campaigns') as any)
        .update({ 
          final_video_url: videoUrl,
          status: 'completed'
        })
        .eq('id', campaignId)
      
      console.log('[Assemble] Campaign updated with final video')
    }

    return NextResponse.json({
      videoUrl,
      thumbnailUrl: thumbnailUrl || null,
      duration: totalDuration,
      clipCount: sortedClips.length,
      method: 'transloadit-concat',
      assemblyId: result.assembly_id
    })

  } catch (error) {
    console.error('[Assemble] Error:', error)
    
    if (campaignId) {
      await updateCampaignStatus(supabase, campaignId, 'failed')
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur assemblage vidéo' },
      { status: 500 }
    )
  }
}
// Force redeploy Mon Dec  1 20:47:28 CET 2025
