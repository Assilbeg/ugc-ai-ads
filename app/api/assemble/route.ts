import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPreviewUrl } from '@/lib/api/cloudinary'
import { v2 as cloudinary } from 'cloudinary'

// fal.ai configuration
const FAL_KEY = process.env.FAL_KEY

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
})

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
 * Input pour chaque clip avec ses ajustements (nouveau format)
 */
interface ClipInputNew {
  rawUrl: string          // URL brute de la vidéo (ou final_url si mixée)
  duration: number        // Durée finale en secondes (après ajustements)
  clipOrder?: number      // Ordre du clip dans la campagne
  trimStart?: number      // Début du trim (secondes)
  trimEnd?: number        // Fin du trim (secondes)
  speed?: number          // Vitesse (0.8 à 1.2)
  cloudinaryId?: string   // ID Cloudinary si déjà uploadé
  originalDuration?: number // Durée originale du clip
  hasMixedAudio?: boolean // Si true, la vidéo contient déjà l'audio mixé
}

/**
 * Ancien format (compatibilité)
 */
interface ClipInputOld {
  url: string
  duration: number
  clipOrder?: number
  trimStart?: number
  trimEnd?: number
  speed?: number
  cloudinaryId?: string
}

type ClipInput = ClipInputNew | ClipInputOld

/**
 * Upload une vidéo vers Cloudinary si nécessaire
 */
async function uploadToCloudinaryIfNeeded(
  rawUrl: string, 
  cloudinaryId?: string
): Promise<string | null> {
  if (cloudinaryId) {
    console.log('[Assemble] Using existing Cloudinary ID:', cloudinaryId)
    return cloudinaryId
  }
  
  // Vérifier les credentials
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.error('[Assemble] CLOUDINARY CREDENTIALS MISSING!', {
      hasCloudName: !!CLOUDINARY_CLOUD_NAME,
      hasApiKey: !!CLOUDINARY_API_KEY,
      hasApiSecret: !!CLOUDINARY_API_SECRET,
    })
    return null
  }
  
  try {
    console.log('[Assemble] Uploading to Cloudinary...', {
      url: rawUrl.slice(0, 60),
      cloudName: CLOUDINARY_CLOUD_NAME,
    })
    const result = await cloudinary.uploader.upload(rawUrl, {
      resource_type: 'video',
      folder: 'ugc-clips',
    })
    console.log('[Assemble] ✓ Uploaded to Cloudinary:', result.public_id)
    return result.public_id
  } catch (err: unknown) {
    const error = err as Error & { http_code?: number; message?: string }
    console.error('[Assemble] ✗ Cloudinary upload FAILED:', {
      message: error.message,
      httpCode: error.http_code,
      url: rawUrl.slice(0, 60),
    })
    return null
  }
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
    let clipsToProcess: ClipInput[] = clips || (videoUrls?.map(url => ({ url, duration: 6 })) ?? [])

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
    console.log('[Assemble] Raw clips data:', JSON.stringify(clipsToProcess, null, 2))

    // Traiter chaque clip : upload Cloudinary si nécessaire + appliquer transformations
    const processedClips: { url: string; duration: number; clipOrder: number }[] = []
    
    for (let i = 0; i < clipsToProcess.length; i++) {
      const clip = clipsToProcess[i]
      // Déterminer l'URL brute (nouveau ou ancien format)
      const rawUrl = 'rawUrl' in clip ? clip.rawUrl : clip.url
      const trimStart = clip.trimStart ?? 0
      const trimEnd = clip.trimEnd ?? ('originalDuration' in clip ? clip.originalDuration : clip.duration) ?? clip.duration
      const speed = clip.speed ?? 1.0
      const originalDuration = 'originalDuration' in clip ? clip.originalDuration : clip.duration
      const hasMixedAudio = 'hasMixedAudio' in clip ? clip.hasMixedAudio : false
      
      console.log(`[Assemble] Clip ${i + 1} analysis:`, {
        rawUrl: rawUrl?.slice(0, 60),
        trimStart,
        trimEnd,
        originalDuration,
        speed,
        finalDuration: clip.duration,
        hasTrimStartChange: trimStart !== 0,
        hasTrimEndChange: trimEnd !== originalDuration,
        hasSpeedChange: speed !== 1.0,
        hasMixedAudio,
      })
      
      // Vérifier si des ajustements sont nécessaires
      const hasTrimAdjustments = trimStart !== 0 || trimEnd !== originalDuration
      const hasSpeedAdjustment = speed !== 1.0
      const hasAdjustments = hasTrimAdjustments || hasSpeedAdjustment
      
      // IMPORTANT: Si la vidéo a de l'audio mixé, on ne peut PAS utiliser e_accelerate
      // car Cloudinary ne synchronise pas l'audio avec le changement de vitesse
      // On applique seulement le trim dans ce cas
      const canApplySpeed = !hasMixedAudio || speed === 1.0
      if (hasMixedAudio && hasSpeedAdjustment) {
        console.warn(`[Assemble] ⚠️ Clip ${i + 1} has mixed audio - speed change (${speed}x) will be IGNORED to preserve audio sync!`)
        console.warn(`[Assemble] ⚠️ Speed changes with mixed audio require FFmpeg processing (not yet implemented)`)
      }
      
      console.log(`[Assemble] Clip ${i + 1} hasAdjustments:`, hasAdjustments, '| canApplySpeed:', canApplySpeed)
      
      let finalUrl = rawUrl
      
      // Appliquer les transformations seulement si nécessaire
      if (hasTrimAdjustments || (hasSpeedAdjustment && canApplySpeed)) {
        console.log(`[Assemble] Clip ${i + 1} - Uploading to Cloudinary...`)
        // Upload vers Cloudinary si pas encore fait
        const cloudinaryId = await uploadToCloudinaryIfNeeded(rawUrl, clip.cloudinaryId)
        
        console.log(`[Assemble] Clip ${i + 1} - Cloudinary ID:`, cloudinaryId)
        
        if (cloudinaryId) {
          // Construire l'URL avec transformations
          const cloudinaryUrl = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload/${cloudinaryId}.mp4`
          console.log(`[Assemble] Clip ${i + 1} - Base Cloudinary URL:`, cloudinaryUrl)
          
          // Appliquer trim toujours, speed seulement si autorisé
          finalUrl = buildPreviewUrl(cloudinaryUrl, {
            trimStart,
            trimEnd,
            speed: canApplySpeed ? speed : 1.0  // Ignorer speed si audio mixé
          })
          console.log(`[Assemble] Clip ${i + 1} - FINAL URL WITH TRANSFORMS:`, finalUrl)
        } else {
          console.error(`[Assemble] Clip ${i + 1} - Cloudinary upload FAILED, using raw video WITHOUT transforms!`)
        }
      } else {
        console.log(`[Assemble] Clip ${i + 1} no adjustments to apply, using raw URL`)
      }
      
      console.log(`[Assemble] Clip ${i + 1} - URL being sent to FAL:`, finalUrl.slice(0, 120))
      
      // Si on a ignoré le speed, recalculer la durée correcte (durée trimmée sans accélération)
      const effectiveDuration = hasMixedAudio && hasSpeedAdjustment 
        ? (trimEnd - trimStart)  // Durée sans speed car speed ignoré
        : clip.duration          // Durée calculée avec speed
      
      processedClips.push({
        url: finalUrl,
        duration: effectiveDuration,
        clipOrder: clip.clipOrder ?? processedClips.length + 1
      })
    }

    // Construire les keyframes avec timestamp cumulatif
    // IMPORTANT: fal.ai attend timestamp et duration en MILLISECONDES, pas en secondes !
    let currentTimestamp = 0
    const keyframes: Keyframe[] = processedClips.map((clip) => {
      const durationMs = clip.duration * 1000  // Convertir secondes → millisecondes
      const keyframe: Keyframe = {
        url: clip.url,
        timestamp: currentTimestamp,
        duration: durationMs
      }
      currentTimestamp += durationMs
      return keyframe
    })

    const totalDurationMs = currentTimestamp
    console.log('[Assemble] ═══════════════════════════════════════')
    console.log('[Assemble] FINAL KEYFRAMES FOR FAL.AI (in milliseconds):')
    keyframes.forEach((k, i) => {
      console.log(`[Assemble]   Clip ${i + 1}: ${k.url.slice(0, 80)}...`)
      console.log(`[Assemble]            timestamp: ${k.timestamp}ms, duration: ${k.duration}ms`)
    })
    console.log('[Assemble] Total duration:', totalDurationMs, 'ms (', totalDurationMs / 1000, 's)')
    console.log('[Assemble] ═══════════════════════════════════════')

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
    const clipAdjustments = clipsToProcess.map((clip, index) => {
      const rawUrl = 'rawUrl' in clip ? clip.rawUrl : clip.url
      return {
        clip_order: clip.clipOrder ?? index + 1,
        trim_start: clip.trimStart ?? 0,
        trim_end: clip.trimEnd ?? clip.duration,
        speed: clip.speed ?? 1.0,
        cloudinary_id: clip.cloudinaryId ?? null,
        original_url: rawUrl,
        final_duration: clip.duration
      }
    })

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
          duration_seconds: totalDurationMs / 1000, // Stocker en secondes
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
      thumbnailUrl: result.thumbnail_url,
      duration: totalDurationMs / 1000, // Convertir ms → secondes pour le client
      clipCount: clipsToProcess.length,
      // Debug: URLs utilisées pour l'assemblage
      debug: {
        cloudinaryConfigured: !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET),
        processedClips: processedClips.map((c) => ({
          clipOrder: c.clipOrder,
          urlUsed: c.url.slice(0, 120),
          isCloudinary: c.url.includes('cloudinary.com'),
          hasTransforms: c.url.includes('so_') || c.url.includes('eo_') || c.url.includes('e_accelerate'),
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
