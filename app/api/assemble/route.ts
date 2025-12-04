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

interface ValidationResult {
  valid: boolean
  clipOrder: number
  url: string
  error?: string
  contentType?: string
  contentLength?: number
}

/**
 * Valider une URL de vidéo (HEAD request)
 * Retourne si l'URL est accessible et si c'est bien une vidéo
 */
async function validateVideoUrl(url: string, clipOrder: number): Promise<ValidationResult> {
  try {
    // Timeout de 10 secondes pour la validation
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    })
    clearTimeout(timeout)
    
    const contentType = response.headers.get('content-type') || ''
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10)
    
    if (!response.ok) {
      return {
        valid: false,
        clipOrder,
        url,
        error: `HTTP ${response.status}: ${response.statusText}`,
        contentType,
        contentLength
      }
    }
    
    // Vérifier que c'est bien une vidéo
    const isVideo = contentType.startsWith('video/') || 
                   contentType.includes('mp4') || 
                   contentType.includes('webm') ||
                   contentType.includes('quicktime') ||
                   contentType.includes('octet-stream') // Certains CDN retournent ce type
    
    if (!isVideo && contentLength < 10000) {
      // Fichier trop petit et pas un type vidéo connu
      return {
        valid: false,
        clipOrder,
        url,
        error: `Type de fichier invalide: ${contentType} (${contentLength} bytes)`,
        contentType,
        contentLength
      }
    }
    
    return { valid: true, clipOrder, url, contentType, contentLength }
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
    return {
      valid: false,
      clipOrder,
      url,
      error: `Impossible d'accéder à l'URL: ${errorMessage}`
    }
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
 * Exécuter l'assemblage Transloadit avec retry automatique
 * @param transloadit - Client Transloadit
 * @param steps - Les steps Transloadit à exécuter
 * @param maxRetries - Nombre max de tentatives (défaut: 3)
 * @param baseDelay - Délai de base en ms pour le backoff (défaut: 2000)
 */
async function executeAssemblyWithRetry(
  transloadit: Transloadit,
  steps: Record<string, unknown>,
  maxRetries = 3,
  baseDelay = 2000
): Promise<{ ok: string; assembly_id: string; results?: any; error?: string; message?: string }> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Assemble] Tentative ${attempt}/${maxRetries}...`)
      
      const result = await transloadit.createAssembly({
        params: { steps } as any,
        waitForCompletion: true,
      })
      
      // Si succès ou erreur non-retry-able, retourner
      if (result.ok === 'ASSEMBLY_COMPLETED') {
        console.log(`[Assemble] ✓ Assemblage réussi (tentative ${attempt})`)
        return result
      }
      
      // Erreurs qui ne valent pas la peine de retenter
      const nonRetryableErrors = [
        'INVALID_FORM_DATA',
        'INVALID_FILE_META_DATA', 
        'MISSING_REQUIRED_PARAM'
      ]
      
      if (result.error && nonRetryableErrors.includes(result.error)) {
        console.error(`[Assemble] Erreur non-retry-able: ${result.error}`)
        return result
      }
      
      // Sinon, c'est une erreur retry-able (INTERNAL_COMMAND_ERROR, timeout, etc.)
      lastError = new Error(result.message || result.error || 'Assembly failed')
      console.warn(`[Assemble] Échec tentative ${attempt}: ${result.error} - ${result.message}`)
      
      if (attempt < maxRetries) {
        // Backoff exponentiel: 2s, 4s, 8s...
        const delay = baseDelay * Math.pow(2, attempt - 1)
        console.log(`[Assemble] Attente ${delay}ms avant retry...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.error(`[Assemble] Erreur tentative ${attempt}:`, lastError.message)
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1)
        console.log(`[Assemble] Attente ${delay}ms avant retry...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  // Toutes les tentatives ont échoué
  throw lastError || new Error('Échec après toutes les tentatives')
}

/**
 * Assemble multiple video clips into a single video using Transloadit
 * VERSION ROBUSTE avec:
 * - Validation des URLs avant assemblage
 * - Retry automatique avec backoff exponentiel
 * - Logs détaillés pour debug
 * - Identification du clip problématique
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

    console.log('[Assemble] ════════════════════════════════════════════════')
    console.log('[Assemble] Starting ROBUST assembly of', clipsToProcess.length, 'clips')
    console.log('[Assemble] Campaign:', campaignId)

    // Trier par clipOrder
    const sortedClips = [...clipsToProcess].sort((a, b) => 
      (a.clipOrder || 0) - (b.clipOrder || 0)
    )

    // ════════════════════════════════════════════════════════════════
    // ÉTAPE 1: VALIDATION DES URLs (avant d'envoyer à Transloadit)
    // ════════════════════════════════════════════════════════════════
    console.log('[Assemble] 📋 Validation des URLs...')
    
    const validationResults = await Promise.all(
      sortedClips.map((clip, index) => 
        validateVideoUrl(clip.rawUrl, clip.clipOrder || index + 1)
      )
    )
    
    const invalidClips = validationResults.filter(r => !r.valid)
    
    if (invalidClips.length > 0) {
      console.error('[Assemble] ❌ URLs invalides détectées:')
      invalidClips.forEach(clip => {
        console.error(`  - Clip ${clip.clipOrder}: ${clip.error}`)
        console.error(`    URL: ${clip.url.slice(0, 100)}...`)
      })
      
      if (campaignId) await updateCampaignStatus(supabase, campaignId, 'failed')
      
      return NextResponse.json({
        error: `${invalidClips.length} clip(s) avec URL invalide`,
        invalidClips: invalidClips.map(c => ({
          clipOrder: c.clipOrder,
          error: c.error
        })),
        suggestion: 'Essayez de régénérer les clips problématiques'
      }, { status: 400 })
    }
    
    console.log('[Assemble] ✓ Toutes les URLs sont valides')
    validationResults.forEach(r => {
      console.log(`  - Clip ${r.clipOrder}: ${r.contentType} (${Math.round((r.contentLength || 0) / 1024)}KB)`)
    })

    // ════════════════════════════════════════════════════════════════
    // ÉTAPE 2: CONSTRUCTION DES STEPS TRANSLOADIT
    // ════════════════════════════════════════════════════════════════
    const transloadit = new Transloadit({
      authKey: TRANSLOADIT_KEY,
      authSecret: TRANSLOADIT_SECRET,
    })

    const steps: Record<string, unknown> = {}
    const importStepNames: string[] = []

    // Importer chaque vidéo avec timeout augmenté
    sortedClips.forEach((clip, index) => {
      const stepName = `import_${index + 1}`
      steps[stepName] = {
        robot: '/http/import',
        url: clip.rawUrl,
        // Timeout de 5 min par vidéo (vidéos IA peuvent être lourdes)
        max_retries: 3,
      }
      importStepNames.push(stepName)
    })

    // ÉTAPE 1: Concaténer SANS resize (le resize sur /video/concat cause des erreurs)
    steps['concatenated'] = {
      robot: '/video/concat',
      use: {
        steps: importStepNames.map((name, index) => ({ 
          name, 
          as: `video_${index + 1}`
        }))
      },
      ffmpeg_stack: 'v6.0.0',
      // Pas de resize ici ! Juste concat basique
      ffmpeg: {
        'fflags': '+genpts+discardcorrupt',
        'vsync': 'cfr',
        'r': 30,
        'c:v': 'libx264',
        'preset': 'fast',
        'crf': '23',
        'c:a': 'aac',
        'b:a': '128k',
        'ar': '48000',
        'ac': '2',
      }
    }

    // ÉTAPE 2: Normaliser en 9:16 avec /video/encode (qui supporte width/height)
    steps['normalized'] = {
      robot: '/video/encode',
      use: 'concatenated',
      result: true,
      ffmpeg_stack: 'v6.0.0',
      width: 1080,
      height: 1920,
      resize_strategy: 'crop',  // Crop au centre pour 9:16 sans bandes noires
      preset: 'ipad-high',      // Preset standard, bonne qualité
    }

    // Thumbnail (basée sur la vidéo normalisée)
    steps['thumbnail'] = {
      robot: '/video/thumbs',
      use: 'normalized',
      result: true,
      count: 1,
      offsets: [0],
      format: 'jpg',
      width: 720,
      height: 1280,
    }

    console.log('[Assemble] 🎬 Steps créés:', Object.keys(steps))

    // ════════════════════════════════════════════════════════════════
    // ÉTAPE 3: EXÉCUTION AVEC RETRY AUTOMATIQUE
    // ════════════════════════════════════════════════════════════════
    console.log('[Assemble] 🚀 Lancement assemblage avec retry automatique...')
    
    const result = await executeAssemblyWithRetry(transloadit, steps, 3, 2000)

    if (result.ok !== 'ASSEMBLY_COMPLETED') {
      console.error('[Assemble] ❌ Échec final:', result.error, result.message)
      
      // Essayer d'identifier le clip problématique
      const errorDetails = result.message || result.error || 'Erreur inconnue'
      
      if (campaignId) await updateCampaignStatus(supabase, campaignId, 'failed')
      
      return NextResponse.json({
        error: `Assemblage échoué après 3 tentatives: ${errorDetails}`,
        assemblyId: result.assembly_id,
        suggestion: 'Les vidéos peuvent avoir un format incompatible. Essayez de régénérer les clips.'
      }, { status: 500 })
    }

    // ════════════════════════════════════════════════════════════════
    // ÉTAPE 4: RÉCUPÉRATION DES RÉSULTATS
    // ════════════════════════════════════════════════════════════════
    const videoUrl = result.results?.normalized?.[0]?.ssl_url
    const thumbnailUrl = result.results?.thumbnail?.[0]?.ssl_url

    if (!videoUrl) {
      console.error('[Assemble] ❌ Pas d\'URL vidéo dans le résultat:', result.results)
      throw new Error('No output video URL')
    }

    console.log('[Assemble] ✓ Vidéo:', videoUrl.slice(0, 60))
    console.log('[Assemble] ✓ Thumbnail:', thumbnailUrl?.slice(0, 60) || 'aucune')

    // Calculer la durée totale
    const totalDuration = sortedClips.reduce((sum, c) => sum + (c.duration || 0), 0)

    // ════════════════════════════════════════════════════════════════
    // ÉTAPE 5: SAUVEGARDE EN BASE
    // ════════════════════════════════════════════════════════════════
    if (campaignId) {
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
        console.error('[Assemble] Erreur sauvegarde assembly:', assemblyError)
        // Fallback si la table n'existe pas
        if (assemblyError.code === '42P01') {
          console.log('[Assemble] Table campaign_assemblies non trouvée, mise à jour campagne directe')
          await (supabase
            .from('campaigns') as any)
            .update({ 
              final_video_url: videoUrl,
              status: 'completed'
            })
            .eq('id', campaignId)
        }
      } else {
        console.log('[Assemble] ✓ Assembly sauvegardé, version:', assembly?.version || 'N/A')
      }

      // Mettre à jour la campagne
      await (supabase
        .from('campaigns') as any)
        .update({ 
          final_video_url: videoUrl,
          status: 'completed'
        })
        .eq('id', campaignId)
      
      console.log('[Assemble] ✓ Campagne mise à jour')
    }

    console.log('[Assemble] ════════════════════════════════════════════════')
    console.log('[Assemble] ✅ ASSEMBLAGE TERMINÉ AVEC SUCCÈS')
    console.log('[Assemble] ════════════════════════════════════════════════')

    return NextResponse.json({
      videoUrl,
      thumbnailUrl: thumbnailUrl || null,
      duration: totalDuration,
      clipCount: sortedClips.length,
      method: 'transloadit-concat-robust',
      assemblyId: result.assembly_id
    })

  } catch (error) {
    console.error('[Assemble] ❌ ERREUR CRITIQUE:', error)
    
    if (campaignId) {
      await updateCampaignStatus(supabase, campaignId, 'failed')
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Erreur assemblage vidéo'
    
    return NextResponse.json({
      error: errorMessage,
      suggestion: 'Si le problème persiste, essayez de régénérer les clips ou contactez le support.'
    }, { status: 500 })
  }
}
