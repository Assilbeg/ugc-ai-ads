import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFirstFrame } from '@/lib/api/falai'
import { checkCredits, deductCredits, getGenerationCost } from '@/lib/credits'
import { createGenerationLog, markGenerationCompleted, markGenerationFailed } from '@/lib/generation-logger'
import crypto from 'crypto'

// NanoBanana Pro est généralement rapide mais on met 60s par sécurité
export const maxDuration = 60 // 1 minute

// Template si on utilise la soul_image (sans intention_media pré-générée)
const DEFAULT_TEMPLATE = `Make me another photo like this as if it was another first frame of the same TikTok UGC but in a different position since she's talking to the camera. WEARING THE EXACT SAME CLOTHES AND OUTFIT as in the reference photo - do NOT change clothing. {PROMPT}. Same person as reference, same clothing. NO TIKTOK UI, NO TEXT, NO WATERMARKS, NO OVERLAYS.`

// Template si on utilise une intention_image (l'acteur est déjà dans le bon contexte)
const INTENTION_IMAGE_TEMPLATE = `Generate a variation of this same person in the same setting, but with a different pose/expression. {PROMPT}. Keep the EXACT SAME FACE, clothing, and location. Only change the expression and gesture as described. NO TIKTOK UI, NO TEXT, NO WATERMARKS, NO OVERLAYS.`

// Template si on utilise l'image du clip précédent (continuité entre clips)
const PREVIOUS_FRAME_TEMPLATE = `Generate the next frame of this same TikTok UGC video with the same person. {PROMPT}. Keep the EXACT SAME FACE, clothing and style. Maintain visual continuity with the reference. NO TIKTOK UI, NO TEXT, NO WATERMARKS, NO OVERLAYS.`

// Coût estimé par génération (en euros) - kept for legacy asset tracking
const GENERATION_COST = 0.15

// Générer un hash SHA256 du prompt pour recherche rapide
function hashPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { soulImageUrl, prompt, presetId, intentionImageUrl, previousFrameUrl, actorId, skipCache, campaignId, clipId, skipCredits } = body as {
      soulImageUrl: string
      prompt: string
      presetId?: string
      intentionImageUrl?: string // Image de l'acteur dans cette intention
      previousFrameUrl?: string  // Image du clip précédent (pour continuité)
      actorId?: string           // ID de l'acteur pour le cache
      skipCache?: boolean        // Forcer la régénération
      campaignId?: string
      clipId?: string
      skipCredits?: boolean
    }

    console.log('First frame request:', { 
      soulImageUrl: soulImageUrl?.slice(0, 50), 
      prompt: prompt?.slice(0, 50),
      presetId,
      actorId,
      hasIntentionImage: !!intentionImageUrl,
      hasPreviousFrame: !!previousFrameUrl,
      skipCache
    })

    if (!soulImageUrl || !prompt) {
      return NextResponse.json(
        { error: `Paramètres manquants: soulImageUrl=${!!soulImageUrl}, prompt=${!!prompt}` },
        { status: 400 }
      )
    }

    // Choisir l'image de référence et le template approprié
    // Priorité : previousFrameUrl > intentionImageUrl > soulImageUrl
    let referenceImageUrl = soulImageUrl
    let template = DEFAULT_TEMPLATE
    let promptId = 'nanobanana_frame'

    if (previousFrameUrl) {
      // Utiliser l'image du clip précédent pour continuité
      referenceImageUrl = previousFrameUrl
      template = PREVIOUS_FRAME_TEMPLATE
      promptId = 'nanobanana_previous_frame'
      console.log('Using previous frame for continuity')
    } else if (intentionImageUrl) {
      // Si on a une intention_image pour cette intention, l'utiliser
      referenceImageUrl = intentionImageUrl
      template = INTENTION_IMAGE_TEMPLATE
      promptId = 'nanobanana_intention_frame'
      console.log('Using intention image for:', presetId)
    }

    // Load prompt template from Supabase (editable via /admin/prompts)
    const { data: promptData } = await (supabase
      .from('system_prompts') as any)
      .select('prompt')
      .eq('id', promptId)
      .single()

    template = promptData?.prompt || template
    
    // Replace {PROMPT} placeholder with actual prompt
    const fullPrompt = template.replace('{PROMPT}', prompt)
    const promptHash = hashPrompt(fullPrompt)

    // ══════════════════════════════════════════════════════════════
    // VÉRIFIER SI UN ASSET EXISTE DÉJÀ (sauf si previousFrame ou skipCache)
    // ══════════════════════════════════════════════════════════════
    if (!previousFrameUrl && !skipCache && actorId) {
      const { data: existingAsset } = await (supabase
        .from('generated_assets') as any)
        .select('id, url')
        .eq('asset_type', 'first_frame')
        .eq('actor_id', actorId)
        .eq('prompt_hash', promptHash)
        .single()

      if (existingAsset) {
        console.log('✓ Cache hit! Reusing existing first frame:', existingAsset.url?.slice(0, 50))
        
        // Incrémenter le compteur d'utilisation
        await (supabase.rpc as any)('increment_asset_use_count', { asset_id: existingAsset.id })

        return NextResponse.json({ 
          url: existingAsset.url, 
          cached: true,
          usedIntentionImage: !!intentionImageUrl && !previousFrameUrl,
          usedPreviousFrame: !!previousFrameUrl 
        })
      }
    }

    // ══════════════════════════════════════════════════════════════
    // VÉRIFIER LES CRÉDITS AVANT GÉNÉRATION
    // ══════════════════════════════════════════════════════════════
    if (!skipCredits) {
      const creditsCheck = await checkCredits(user.id, 'first_frame', user.email)
      
      if (!creditsCheck.hasEnough) {
        return NextResponse.json(
          { 
            error: 'Crédits insuffisants',
            code: 'INSUFFICIENT_CREDITS',
            required: creditsCheck.requiredAmount,
            current: creditsCheck.currentBalance,
            missing: creditsCheck.missingAmount,
            isEarlyBirdEligible: creditsCheck.isEarlyBirdEligible,
          },
          { status: 402 }
        )
      }
    }

    // ══════════════════════════════════════════════════════════════
    // CREATE GENERATION LOG
    // ══════════════════════════════════════════════════════════════
    const logId = await createGenerationLog({
      userId: user.id,
      generationType: 'first_frame',
      modelPath: 'fal-ai/nano-banana-pro/edit',
      inputParams: {
        prompt: prompt.slice(0, 500),
        referenceImageUrl: referenceImageUrl.slice(0, 200),
        presetId,
        usedIntentionImage: !!intentionImageUrl && !previousFrameUrl,
        usedPreviousFrame: !!previousFrameUrl,
      },
      campaignId,
      clipId,
    })

    // ══════════════════════════════════════════════════════════════
    // GÉNÉRER UNE NOUVELLE IMAGE
    // ══════════════════════════════════════════════════════════════
    const startTime = Date.now()
    let url: string
    
    try {
      url = await generateFirstFrame(referenceImageUrl, fullPrompt)
    } catch (error) {
      // Mark log as failed
      if (logId) {
        await markGenerationFailed(
          logId,
          error instanceof Error ? error.message : 'Unknown error',
          startTime
        )
      }
      throw error
    }
    
    const generationTime = Date.now() - startTime
    console.log('First frame generated:', url?.slice(0, 50), `(${generationTime}ms)`)

    // Get billed cost
    const billedCost = await getGenerationCost('first_frame')

    // Mark log as completed
    if (logId) {
      await markGenerationCompleted(logId, url, startTime, billedCost)
    }

    // Deduct credits after successful generation
    if (!skipCredits) {
      const deductResult = await deductCredits(
        user.id,
        'first_frame',
        'First Frame NanoBanana Pro',
        campaignId,
        clipId,
        user.email
      )
      
      if (!deductResult.success) {
        console.error('Failed to deduct credits:', deductResult.errorMessage)
      }
    }

    // ══════════════════════════════════════════════════════════════
    // SAUVEGARDER L'ASSET (sauf si previousFrame car trop spécifique)
    // ══════════════════════════════════════════════════════════════
    if (!previousFrameUrl && actorId && url) {
      const { error: insertError } = await (supabase
        .from('generated_assets') as any)
        .insert({
          asset_type: 'first_frame',
          actor_id: actorId,
          preset_id: presetId || null,
          prompt: fullPrompt,
          prompt_hash: promptHash,
          url: url,
          generation_cost: GENERATION_COST,
          generation_time_ms: generationTime,
          model_used: 'fal-ai/nano-banana-pro',
        })

      if (insertError) {
        console.warn('Failed to cache asset:', insertError.message)
        // On ne fail pas la requête pour ça
      } else {
        console.log('✓ Asset cached for future reuse')
      }
    }

    return NextResponse.json({ 
      url, 
      cached: false,
      usedIntentionImage: !!intentionImageUrl && !previousFrameUrl,
      usedPreviousFrame: !!previousFrameUrl,
      logId,
    })
  } catch (error) {
    console.error('Error generating first frame:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur de génération' },
      { status: 500 }
    )
  }
}

