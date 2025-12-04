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
 * Valider une URL de vidéo (HEAD request)
 */
async function validateVideoUrl(url: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    })
    clearTimeout(timeout)
    
    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}: ${response.statusText}` }
    }
    
    return { valid: true }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'URL inaccessible' }
  }
}

/**
 * Exécuter l'assemblage Transloadit avec retry automatique
 */
async function executeWithRetry(
  transloadit: Transloadit,
  steps: Record<string, unknown>,
  maxRetries = 3,
  baseDelay = 2000
): Promise<{ ok: string | null | undefined; assembly_id?: string; results?: Record<string, unknown[]>; error?: string; message?: string }> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[ProcessClip] Tentative ${attempt}/${maxRetries}...`)
      
      const result = await transloadit.createAssembly({
        params: { steps } as any,
        waitForCompletion: true,
      })
      
      if (result.ok === 'ASSEMBLY_COMPLETED') {
        console.log(`[ProcessClip] ✓ Traitement réussi (tentative ${attempt})`)
        return result as { ok: string; assembly_id?: string; results?: Record<string, unknown[]>; error?: string; message?: string }
      }
      
      // Erreurs non-retry-able
      const nonRetryableErrors = ['INVALID_FORM_DATA', 'INVALID_FILE_META_DATA', 'MISSING_REQUIRED_PARAM']
      if (result.error && nonRetryableErrors.includes(result.error)) {
        console.error(`[ProcessClip] Erreur non-retry-able: ${result.error}`)
        return result as { ok: string | null | undefined; assembly_id?: string; results?: Record<string, unknown[]>; error?: string; message?: string }
      }
      
      lastError = new Error(result.message || result.error || 'Processing failed')
      console.warn(`[ProcessClip] Échec tentative ${attempt}: ${result.error} - ${result.message}`)
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1)
        console.log(`[ProcessClip] Attente ${delay}ms avant retry...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.error(`[ProcessClip] Erreur tentative ${attempt}:`, lastError.message)
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError || new Error('Échec après toutes les tentatives')
}

/**
 * Applique trim + speed sur un clip vidéo avec audio synchronisé
 * VERSION ROBUSTE avec validation et retry automatique
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

    // ════════════════════════════════════════════════════════════════
    // VALIDATION DE L'URL
    // ════════════════════════════════════════════════════════════════
    console.log('[ProcessClip] Validation URL:', videoUrl.slice(0, 60))
    const validation = await validateVideoUrl(videoUrl)
    if (!validation.valid) {
      console.error('[ProcessClip] ❌ URL invalide:', validation.error)
      return NextResponse.json({ 
        error: `URL invalide: ${validation.error}`,
        videoUrl: videoUrl.slice(0, 100)
      }, { status: 400 })
    }

    const effectiveTrimEnd = trimEnd ?? duration
    const hasTrimStart = trimStart > 0
    const hasTrimEnd = effectiveTrimEnd < duration
    const hasSpeed = speed !== 1.0

    console.log('[ProcessClip] Processing:', {
      videoUrl: videoUrl.slice(0, 60),
      trimStart,
      trimEnd: effectiveTrimEnd,
      speed,
      duration,
      hasTrimStart,
      hasTrimEnd,
      hasSpeed
    })

    // Calculer la nouvelle durée
    const trimmedDuration = effectiveTrimEnd - trimStart
    const newDuration = trimmedDuration / speed

    // Initialiser le client Transloadit
    const transloadit = new Transloadit({
      authKey: TRANSLOADIT_KEY,
      authSecret: TRANSLOADIT_SECRET,
    })

    // Construire la commande FFmpeg
    const ptsFactor = (1 / speed).toFixed(4)
    const videoFilters: string[] = []
    const audioFilters: string[] = []
    
    // ÉTAPE 1 : Normaliser les timestamps
    videoFilters.push('setpts=PTS-STARTPTS')
    audioFilters.push('asetpts=PTS-STARTPTS')
    
    // ÉTAPE 2 : Gestion du trim
    if (hasTrimStart && hasTrimEnd) {
      videoFilters.push(`trim=start=${trimStart}:end=${effectiveTrimEnd}`)
      audioFilters.push(`atrim=start=${trimStart}:end=${effectiveTrimEnd}`)
    } else if (hasTrimStart) {
      videoFilters.push(`trim=start=${trimStart}`)
      audioFilters.push(`atrim=start=${trimStart}`)
    } else if (hasTrimEnd) {
      videoFilters.push(`trim=start=0:end=${effectiveTrimEnd}`)
      audioFilters.push(`atrim=start=0:end=${effectiveTrimEnd}`)
    } else {
      videoFilters.push('trim=start=0')
      audioFilters.push('atrim=start=0')
    }
    
    // ÉTAPE 2.5 : Reset après trim
    videoFilters.push('setpts=PTS-STARTPTS')
    audioFilters.push('asetpts=PTS-STARTPTS')
    
    // ÉTAPE 3 : Speed
    if (hasSpeed) {
      videoFilters.push(`setpts=${ptsFactor}*PTS`)
      audioFilters.push(`atempo=${speed}`)
    }
    
    // ÉTAPE 4 : Reset final
    videoFilters.push('setpts=PTS-STARTPTS')
    audioFilters.push('asetpts=PTS-STARTPTS')
    
    // NOTE: Pas de resize ici - les vidéos Veo sont déjà en 9:16
    // Si resize nécessaire, l'ajouter de manière contrôlée après tests
    
    // Construire les paramètres FFmpeg
    const ffmpegParams: Record<string, unknown> = {}
    
    if (videoFilters.length > 0 || audioFilters.length > 0) {
      const vf = videoFilters.length > 0 ? videoFilters.join(',') : 'copy'
      const af = audioFilters.length > 0 ? audioFilters.join(',') : 'anull'
      ffmpegParams['filter_complex'] = `[0:v]${vf}[v];[0:a]${af}[a]`
      ffmpegParams['map'] = ['[v]', '[a]']
    }
    
    // Paramètres robustes
    ffmpegParams['fflags'] = '+genpts+discardcorrupt+igndts'
    ffmpegParams['vsync'] = 'cfr'
    ffmpegParams['c:v'] = 'libx264'
    ffmpegParams['preset'] = 'fast'
    ffmpegParams['crf'] = 23
    ffmpegParams['r'] = 30
    ffmpegParams['force_key_frames'] = 'expr:eq(t,0)'
    ffmpegParams['c:a'] = 'aac'
    ffmpegParams['b:a'] = '128k'
    ffmpegParams['ar'] = 48000
    ffmpegParams['ac'] = 2
    ffmpegParams['movflags'] = '+faststart'
    ffmpegParams['strict'] = 'experimental'
    
    const steps: Record<string, unknown> = {
      imported: {
        robot: '/http/import',
        url: videoUrl,
        max_retries: 3,
      },
      // Trim + Speed + normalisation timestamps
      // PAS de resize ici - les vidéos Veo sont déjà en 9:16
      processed: {
        robot: '/video/encode',
        use: 'imported',
        result: true,
        preset: 'empty',
        ffmpeg_stack: 'v6.0.0',
        ffmpeg: ffmpegParams
      }
    }

    // ════════════════════════════════════════════════════════════════
    // EXÉCUTION AVEC RETRY
    // ════════════════════════════════════════════════════════════════
    const result = await executeWithRetry(transloadit, steps, 3, 2000)

    if (result.ok !== 'ASSEMBLY_COMPLETED') {
      console.error('[ProcessClip] ❌ Échec final:', result.error, result.message)
      return NextResponse.json({
        error: `Traitement échoué: ${result.message || result.error}`,
        assemblyId: result.assembly_id || 'unknown'
      }, { status: 500 })
    }

    const processedResults = result.results?.processed as Array<{ ssl_url?: string; meta?: { duration?: number } }> | undefined
    const outputUrl = processedResults?.[0]?.ssl_url
    
    if (!outputUrl) {
      console.error('[ProcessClip] ❌ Pas d\'URL dans le résultat')
      return NextResponse.json({ error: 'No output URL' }, { status: 500 })
    }

    const outputDuration = processedResults?.[0]?.meta?.duration || newDuration

    console.log('[ProcessClip] ✓ Processed:', outputUrl.slice(0, 60))
    console.log('[ProcessClip] ✓ Duration:', outputDuration, 's')

    return NextResponse.json({
      videoUrl: outputUrl,
      processed: true,
      originalDuration: duration,
      newDuration: outputDuration,
      transformations: { trimStart, trimEnd: effectiveTrimEnd, speed }
    })

  } catch (error) {
    console.error('[ProcessClip] ❌ Erreur:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur traitement clip' },
      { status: 500 }
    )
  }
}
