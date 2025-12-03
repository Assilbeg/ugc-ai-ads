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
 * IMPORTANT: Le paramètre "clip" ne fonctionne PAS avec les presets (ipad-high, etc.)
 * Il faut utiliser preset: 'empty' avec des paramètres FFmpeg explicites
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
    // Séparer le trim début et fin pour éviter de couper le début accidentellement
    const hasTrimStart = trimStart > 0
    const hasTrimEnd = effectiveTrimEnd < duration
    const hasSpeed = speed !== 1.0

    console.log('[ProcessClip] Will process - hasTrimStart:', hasTrimStart, 'hasTrimEnd:', hasTrimEnd, 'hasSpeed:', hasSpeed, 'trimStart:', trimStart, 'trimEnd:', effectiveTrimEnd, 'duration:', duration)

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

    // Construire la commande FFmpeg selon les transformations nécessaires
    // IMPORTANT: On utilise TOUJOURS preset: 'empty' car le param 'clip' ne fonctionne pas avec les presets
    const ptsFactor = (1 / speed).toFixed(4)
    
    // Construire les filtres video et audio
    // IMPORTANT: On sépare le trim début et fin pour éviter que trim=start=0 coupe des frames
    // Les vidéos IA peuvent avoir des timestamps qui ne commencent pas exactement à 0
    const videoFilters: string[] = []
    const audioFilters: string[] = []
    
    // Gestion du trim : on sépare début et fin pour éviter les problèmes de timestamps
    // Le problème avec trim=start=0:end=X est que si la vidéo a des timestamps qui ne commencent pas à 0,
    // FFmpeg peut couper des frames au début même si start=0
    
    if (hasTrimStart && hasTrimEnd) {
      // Trim début ET fin - setpts nécessaire car on change le point de départ
      videoFilters.push(`trim=start=${trimStart}:end=${effectiveTrimEnd}`)
      videoFilters.push('setpts=PTS-STARTPTS')
      audioFilters.push(`atrim=start=${trimStart}:end=${effectiveTrimEnd}`)
      audioFilters.push('asetpts=PTS-STARTPTS')
    } else if (hasTrimStart) {
      // Trim du début uniquement - setpts nécessaire car on change le point de départ
      videoFilters.push(`trim=start=${trimStart}`)
      videoFilters.push('setpts=PTS-STARTPTS')
      audioFilters.push(`atrim=start=${trimStart}`)
      audioFilters.push('asetpts=PTS-STARTPTS')
    } else if (hasTrimEnd) {
      // Trim de la fin uniquement - PAS de setpts car on garde le début intact
      // Utiliser trim=end=X sans start pour préserver le début exactement
      videoFilters.push(`trim=end=${effectiveTrimEnd}`)
      audioFilters.push(`atrim=end=${effectiveTrimEnd}`)
      // Note: pas de setpts ici car on ne change pas le point de départ
    }
    
    // Speed via setpts (video) et atempo (audio)
    if (hasSpeed) {
      videoFilters.push(`setpts=${ptsFactor}*PTS`)
      audioFilters.push(`atempo=${speed}`)
    }
    
    // Construire les paramètres FFmpeg
    const ffmpegParams: Record<string, unknown> = {}
    
    // Appliquer les filtres si nécessaire
    if (videoFilters.length > 0 || audioFilters.length > 0) {
      const vf = videoFilters.length > 0 ? videoFilters.join(',') : 'copy'
      const af = audioFilters.length > 0 ? audioFilters.join(',') : 'anull'
      
      // Utiliser filter_complex pour traiter video et audio ensemble
      ffmpegParams['filter_complex'] = `[0:v]${vf}[v];[0:a]${af}[a]`
      ffmpegParams['map'] = ['[v]', '[a]']
    }
    
    // Paramètres de qualité pour le ré-encodage
    // IMPORTANT: Normaliser video ET audio pour une concaténation propre
    // Video
    ffmpegParams['c:v'] = 'libx264'
    ffmpegParams['preset'] = 'fast'
    ffmpegParams['crf'] = 23
    ffmpegParams['r'] = 30  // Framerate constant 30fps
    // Audio - CRITIQUE pour la concaténation !
    ffmpegParams['c:a'] = 'aac'
    ffmpegParams['b:a'] = '128k'
    ffmpegParams['ar'] = 48000   // Sample rate 48kHz (standard vidéo)
    ffmpegParams['ac'] = 2       // Stéréo
    // Optimisation streaming
    ffmpegParams['movflags'] = '+faststart'
    
    const steps: Record<string, unknown> = {
      // 1. Importer la vidéo depuis l'URL
      imported: {
        robot: '/http/import',
        url: videoUrl
      },
      // 2. Traiter (trim + speed en une seule passe)
      processed: {
        robot: '/video/encode',
        use: 'imported',
        result: true,
        preset: 'empty',  // OBLIGATOIRE pour les paramètres FFmpeg custom
        ffmpeg_stack: 'v6.0.0',
        ffmpeg: ffmpegParams
      }
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
      // Log plus de détails sur l'erreur
      if (result.results) {
        console.error('[ProcessClip] Results:', JSON.stringify(result.results, null, 2))
      }
      throw new Error(result.message || 'Assembly failed')
    }

    // Récupérer l'URL de sortie (toujours "processed" maintenant)
    const outputUrl = result.results?.processed?.[0]?.ssl_url
    
    if (!outputUrl) {
      console.error('[ProcessClip] No output URL in result:', JSON.stringify(result.results, null, 2))
      throw new Error('No output URL')
    }

    // Récupérer la durée réelle du fichier de sortie (si disponible)
    const outputDuration = result.results?.processed?.[0]?.meta?.duration || newDuration

    console.log('[ProcessClip] ✓ Processed:', outputUrl.slice(0, 60))
    console.log('[ProcessClip] ✓ Duration: expected', newDuration.toFixed(2), 's, actual', outputDuration, 's')

    return NextResponse.json({
      videoUrl: outputUrl,
      processed: true,
      originalDuration: duration,
      newDuration: outputDuration, // Utiliser la durée réelle du fichier
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
