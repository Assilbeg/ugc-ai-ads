import { NextRequest, NextResponse } from 'next/server'
import { Transloadit } from 'transloadit'

// Transloadit encoding peut prendre 2-3 minutes
export const maxDuration = 180 // 3 minutes

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

    // Construire la commande FFmpeg selon les transformations nécessaires
    // IMPORTANT: On utilise TOUJOURS preset: 'empty' car le param 'clip' ne fonctionne pas avec les presets
    const ptsFactor = (1 / speed).toFixed(4)
    
    // Construire les filtres video et audio
    // ═══════════════════════════════════════════════════════════════
    // ORDRE CRITIQUE DES FILTRES :
    // 1. setpts=PTS-STARTPTS → Normaliser les timestamps à 0 AVANT tout
    // 2. trim/atrim → Couper aux bonnes positions
    // 3. setpts pour speed → Modifier la vitesse
    // 4. setpts=PTS-STARTPTS → Reset final pour le concat
    //
    // Les vidéos IA (Veo, etc.) ont des timestamps qui ne commencent
    // pas à 0, donc trim=end=5 peut couper le début par erreur !
    // ═══════════════════════════════════════════════════════════════
    const videoFilters: string[] = []
    const audioFilters: string[] = []
    
    // ÉTAPE 1 : TOUJOURS normaliser les timestamps EN PREMIER
    // C'est CRITIQUE pour que trim fonctionne correctement
    videoFilters.push('setpts=PTS-STARTPTS')
    audioFilters.push('asetpts=PTS-STARTPTS')
    
    // ÉTAPE 2 : Gestion du trim (maintenant les timestamps sont normalisés)
    // IMPORTANT: TOUJOURS ajouter un trim explicite pour forcer FFmpeg à garder
    // toutes les frames depuis le début. Les vidéos Veo peuvent avoir des frames
    // "cachées" avant le PTS 0 qui causent des problèmes.
    if (hasTrimStart && hasTrimEnd) {
      videoFilters.push(`trim=start=${trimStart}:end=${effectiveTrimEnd}`)
      audioFilters.push(`atrim=start=${trimStart}:end=${effectiveTrimEnd}`)
    } else if (hasTrimStart) {
      videoFilters.push(`trim=start=${trimStart}`)
      audioFilters.push(`atrim=start=${trimStart}`)
    } else if (hasTrimEnd) {
      // Ajouter start=0 explicite pour forcer le démarrage à 0
      videoFilters.push(`trim=start=0:end=${effectiveTrimEnd}`)
      audioFilters.push(`atrim=start=0:end=${effectiveTrimEnd}`)
    } else {
      // Pas de trim demandé, mais on force quand même start=0 pour les vidéos Veo
      videoFilters.push('trim=start=0')
      audioFilters.push('atrim=start=0')
    }
    
    // ÉTAPE 2.5 : TOUJOURS normaliser APRÈS le trim et AVANT le speed
    // C'est nécessaire même sans trim car les timestamps après trim peuvent être décalés
    videoFilters.push('setpts=PTS-STARTPTS')
    audioFilters.push('asetpts=PTS-STARTPTS')
    
    // ÉTAPE 3 : Speed via setpts (video) et atempo (audio)
    // Maintenant les timestamps commencent à 0, donc le calcul est correct
    if (hasSpeed) {
      videoFilters.push(`setpts=${ptsFactor}*PTS`)
      audioFilters.push(`atempo=${speed}`)
    }
    
    // ÉTAPE 4 : Reset final des timestamps pour l'assemblage
    // Après trim/speed, les timestamps peuvent être décalés, on les remet à 0
    videoFilters.push('setpts=PTS-STARTPTS')
    audioFilters.push('asetpts=PTS-STARTPTS')
    
    // Construire les paramètres FFmpeg
    const ffmpegParams: Record<string, unknown> = {}
    
    if (videoFilters.length > 0 || audioFilters.length > 0) {
      const vf = videoFilters.length > 0 ? videoFilters.join(',') : 'copy'
      const af = audioFilters.length > 0 ? audioFilters.join(',') : 'anull'
      ffmpegParams['filter_complex'] = `[0:v]${vf}[v];[0:a]${af}[a]`
      ffmpegParams['map'] = ['[v]', '[a]']
    }
    
    // Paramètres de qualité pour le ré-encodage
    // IMPORTANT: Normaliser video ET audio pour une concaténation propre
    
    // ═══════════════════════════════════════════════════════════════
    // TRIM PRÉCIS AU FRAME PRÈS - Important pour éviter de couper le début
    // ═══════════════════════════════════════════════════════════════
    // - genpts : Génère des PTS si manquants (vidéos IA)
    // - discardcorrupt : Ignore les frames corrompues
    // - On ne met PAS igndts car ça peut causer des problèmes de timing
    ffmpegParams['fflags'] = '+genpts+discardcorrupt'
    ffmpegParams['vsync'] = 'cfr'  // Constant frame rate pour précision
    
    // Video - avec keyframe forcé au début pour un assemblage propre
    ffmpegParams['c:v'] = 'libx264'
    ffmpegParams['preset'] = 'fast'
    ffmpegParams['crf'] = 23
    ffmpegParams['r'] = 30  // Framerate constant 30fps
    // CRITIQUE: Force un keyframe à 0 pour éviter les problèmes d'assemblage
    ffmpegParams['force_key_frames'] = 'expr:eq(t,0)'
    // Audio - CRITIQUE pour la concaténation !
    ffmpegParams['c:a'] = 'aac'
    ffmpegParams['b:a'] = '128k'
    ffmpegParams['ar'] = 48000   // Sample rate 48kHz (standard vidéo)
    ffmpegParams['ac'] = 2       // Stéréo
    // Optimisation streaming
    ffmpegParams['movflags'] = '+faststart'
    
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
