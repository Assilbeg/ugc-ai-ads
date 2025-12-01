import { NextRequest, NextResponse } from 'next/server'
import { Transloadit } from 'transloadit'

// Transloadit credentials
const TRANSLOADIT_KEY = process.env.TRANSLOADIT_KEY
const TRANSLOADIT_SECRET = process.env.TRANSLOADIT_SECRET

interface ProcessClipInput {
  videoUrl: string      // URL de la vidéo (avec audio mixé)
  trimStart?: number    // Début du trim (secondes)
  trimEnd?: number      // Fin du trim (secondes)
  speed?: number        // Vitesse (0.5 à 2.0)
  duration: number      // Durée originale
}

/**
 * Applique trim + speed sur un clip vidéo avec audio synchronisé
 * Utilise Transloadit (FFmpeg en cloud) - 100% fiable
 * 
 * Doc: https://transloadit.com/docs/robots/video-encode/
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      videoUrl, 
      trimStart = 0, 
      trimEnd,
      speed = 1.0,
      duration 
    } = body as ProcessClipInput

    if (!videoUrl) {
      return NextResponse.json({ error: 'videoUrl requis' }, { status: 400 })
    }

    if (!TRANSLOADIT_KEY || !TRANSLOADIT_SECRET) {
      console.error('[ProcessClip] Transloadit credentials missing')
      return NextResponse.json({ 
        error: 'TRANSLOADIT_KEY/SECRET non configurés',
        fallback: true
      }, { status: 500 })
    }

    const effectiveTrimEnd = trimEnd ?? duration
    const hasTrim = trimStart > 0 || effectiveTrimEnd !== duration
    const hasSpeed = speed !== 1.0

    // TOUJOURS traiter pour garantir la durée exacte
    // (fal.ai compose ne trim pas, il utilise la vidéo complète)
    // Même sans trim/speed, on re-encode pour avoir une vidéo de la durée spécifiée
    console.log('[ProcessClip] Will process - hasTrim:', hasTrim, 'hasSpeed:', hasSpeed)

    console.log('[ProcessClip] Processing with Transloadit:', {
      videoUrl: videoUrl.slice(0, 60),
      trimStart,
      trimEnd: effectiveTrimEnd,
      speed,
      duration
    })

    // Calculer la nouvelle durée
    const trimmedDuration = effectiveTrimEnd - trimStart
    const newDuration = trimmedDuration / speed

    // Initialiser le client Transloadit
    const transloadit = new Transloadit({
      authKey: TRANSLOADIT_KEY,
      authSecret: TRANSLOADIT_SECRET,
    })

    // Définir les steps de l'assemblage
    // Ref: https://transloadit.com/demos/video-encoding/manipulate-playback-speed/
    const ptsFactor = (1 / speed).toFixed(4)
    
    const steps: Record<string, unknown> = {
      // 1. Importer la vidéo depuis l'URL
      imported: {
        robot: '/http/import',
        url: videoUrl
      },
      // 2. D'abord le trim (coupe la vidéo)
      trimmed: {
        robot: '/video/encode',
        use: 'imported',
        result: !hasSpeed, // Résultat final seulement si pas de speed
        preset: 'ipad-high', // Preset standard avec ré-encodage
        ffmpeg_stack: 'v7.0.0',
        clip: {
          offset_start: trimStart,
          duration: trimmedDuration
        }
      },
      // 3. Ensuite le speed (si nécessaire) - sur la vidéo déjà trimmée
      ...(hasSpeed ? {
        processed: {
          robot: '/video/encode',
          use: 'trimmed',
          result: true,
          preset: 'empty', // Empty pour les filtres custom
          ffmpeg_stack: 'v7.0.0',
          ffmpeg: {
            'filter_complex': `[0:v]setpts=${ptsFactor}*PTS[v];[0:a]atempo=${speed}[a]`,
            'map': ['[v]', '[a]']
          }
        }
      } : {})
    }
    
    console.log('[ProcessClip] Assembly steps:', JSON.stringify(steps, null, 2))

    // Créer et attendre l'assemblage
    const result = await transloadit.createAssembly({
      params: { steps } as any, // Cast to any to satisfy Transloadit types
      waitForCompletion: true,
    })

    console.log('[ProcessClip] Assembly result:', result.ok, result.assembly_id)

    if (result.ok !== 'ASSEMBLY_COMPLETED') {
      console.error('[ProcessClip] Assembly failed:', result.error, result.message)
      throw new Error(result.message || 'Assembly failed')
    }

    // Récupérer l'URL de sortie (processed si speed, sinon trimmed)
    const outputUrl = hasSpeed 
      ? result.results?.processed?.[0]?.ssl_url
      : result.results?.trimmed?.[0]?.ssl_url
    
    if (!outputUrl) {
      console.error('[ProcessClip] No output URL in result:', result.results)
      console.error('[ProcessClip] hasSpeed:', hasSpeed, 'Looking for:', hasSpeed ? 'processed' : 'trimmed')
      throw new Error('No output URL')
    }

    console.log('[ProcessClip] ✓ Processed:', outputUrl.slice(0, 60), '(hasSpeed:', hasSpeed, ')')

    return NextResponse.json({
      videoUrl: outputUrl,
      processed: true,
      originalDuration: duration,
      newDuration,
      transformations: { trimStart, trimEnd: effectiveTrimEnd, speed }
    })

  } catch (error) {
    console.error('[ProcessClip] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur traitement clip' },
      { status: 500 }
    )
  }
}
