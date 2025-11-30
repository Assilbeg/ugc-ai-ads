import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// fal.ai configuration
const FAL_KEY = process.env.FAL_KEY

interface Keyframe {
  url: string
  timestamp: number  // Position dans la timeline (en secondes)
  duration: number   // Durée du clip (en secondes)
}

interface Track {
  id: string
  type: 'video' | 'audio'
  keyframes: Keyframe[]
}

interface ComposeInput {
  tracks: Track[]
}

interface ComposeOutput {
  video_url: string
  thumbnail_url: string
}

/**
 * Input pour chaque clip avec ses ajustements
 */
interface ClipInput {
  url: string
  duration: number        // Durée finale en secondes (après ajustements)
  clipOrder?: number      // Ordre du clip dans la campagne
  trimStart?: number      // Début du trim (secondes)
  trimEnd?: number        // Fin du trim (secondes)
  speed?: number          // Vitesse (0.8 à 1.2)
  cloudinaryId?: string   // ID Cloudinary si uploadé
}

/**
 * Assemble multiple video clips into a single video using fal.ai FFmpeg API
 * Sauvegarde dans campaign_assemblies pour garder l'historique (versioning)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clips, campaignId, videoUrls } = body as {
      clips?: ClipInput[]  // Nouveau format avec durées et ajustements
      videoUrls?: string[] // Ancien format (fallback)
      campaignId: string
    }

    // Support ancien format (videoUrls) ou nouveau format (clips avec durées)
    const clipsToProcess: ClipInput[] = clips || (videoUrls?.map(url => ({ url, duration: 6 })) ?? [])

    if (clipsToProcess.length === 0) {
      return NextResponse.json(
        { error: 'clips ou videoUrls est requis' },
        { status: 400 }
      )
    }

    if (!FAL_KEY) {
      return NextResponse.json(
        { error: 'FAL_KEY non configuré' },
        { status: 500 }
      )
    }

    console.log('[Assemble] Starting assembly of', clipsToProcess.length, 'clips')

    // Construire les keyframes avec timestamp cumulatif
    let currentTimestamp = 0
    const keyframes: Keyframe[] = clipsToProcess.map((clip) => {
      const keyframe: Keyframe = {
        url: clip.url,
        timestamp: currentTimestamp,
        duration: clip.duration
      }
      currentTimestamp += clip.duration
      return keyframe
    })

    const totalDuration = currentTimestamp
    console.log('[Assemble] Keyframes:', keyframes.map(k => ({ timestamp: k.timestamp, duration: k.duration })))
    console.log('[Assemble] Total duration:', totalDuration, 'seconds')

    const videoTrack: Track = {
      id: 'video-track',
      type: 'video',
      keyframes
    }

    const input: ComposeInput = {
      tracks: [videoTrack]
    }

    // Appeler fal.ai FFmpeg compose
    const response = await fetch('https://fal.run/fal-ai/ffmpeg-api/compose', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Assemble] fal.ai error:', errorText)
      throw new Error(`fal.ai error: ${response.status}`)
    }

    const result: ComposeOutput = await response.json()
    console.log('[Assemble] Video assembled:', result.video_url?.slice(0, 50))

    // Préparer les ajustements pour la sauvegarde
    const clipAdjustments = clipsToProcess.map((clip, index) => ({
      clip_order: clip.clipOrder ?? index + 1,
      trim_start: clip.trimStart ?? 0,
      trim_end: clip.trimEnd ?? clip.duration,
      speed: clip.speed ?? 1.0,
      cloudinary_id: clip.cloudinaryId ?? null,
      original_url: clip.url,
      final_duration: clip.duration
    }))

    // Sauvegarder dans campaign_assemblies (versioning)
    if (campaignId && result.video_url) {
      const supabase = await createClient()
      
      // 1. Créer une nouvelle entrée dans campaign_assemblies
      const { data: assembly, error: assemblyError } = await supabase
        .from('campaign_assemblies')
        .insert({
          campaign_id: campaignId,
          final_video_url: result.video_url,
          thumbnail_url: result.thumbnail_url || null,
          duration_seconds: totalDuration,
          clip_adjustments: clipAdjustments
        })
        .select()
        .single()

      if (assemblyError) {
        console.error('[Assemble] Error saving assembly:', assemblyError)
        // Fallback: mettre à jour la campagne directement si la table n'existe pas encore
        if (assemblyError.code === '42P01') { // Table doesn't exist
          console.log('[Assemble] campaign_assemblies table not found, updating campaign directly')
          await supabase
            .from('campaigns')
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
      await supabase
        .from('campaigns')
        .update({ 
          final_video_url: result.video_url,
          status: 'completed'
        })
        .eq('id', campaignId)
      
      console.log('[Assemble] Campaign updated with final video')
    }

    return NextResponse.json({
      videoUrl: result.video_url,
      thumbnailUrl: result.thumbnail_url,
      duration: totalDuration,
      clipCount: clipsToProcess.length
    })
  } catch (error) {
    console.error('[Assemble] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur assemblage' },
      { status: 500 }
    )
  }
}
