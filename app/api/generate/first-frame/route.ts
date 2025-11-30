import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFirstFrame } from '@/lib/api/falai'
import crypto from 'crypto'

// Template si on utilise la soul_image (sans intention_media pré-générée)
const DEFAULT_TEMPLATE = `Make me another photo like this as if it was another first frame of the same TikTok UGC but in a different position since she's talking to the camera. WEARING THE EXACT SAME CLOTHES AND OUTFIT as in the reference photo - do NOT change clothing. {PROMPT}. Same person as reference, same clothing. NO TIKTOK UI, NO TEXT, NO WATERMARKS, NO OVERLAYS.`

// Template si on utilise une intention_image (l'acteur est déjà dans le bon contexte)
const INTENTION_IMAGE_TEMPLATE = `Generate a variation of this same person in the same setting, but with a different pose/expression. {PROMPT}. Keep the EXACT SAME FACE, clothing, and location. Only change the expression and gesture as described. NO TIKTOK UI, NO TEXT, NO WATERMARKS, NO OVERLAYS.`

// Template si on utilise l'image du clip précédent (continuité entre clips)
const PREVIOUS_FRAME_TEMPLATE = `Generate the next frame of this same TikTok UGC video with the same person. {PROMPT}. Keep the EXACT SAME FACE, clothing and style. Maintain visual continuity with the reference. NO TIKTOK UI, NO TEXT, NO WATERMARKS, NO OVERLAYS.`

// Coût estimé par génération (en euros)
const GENERATION_COST = 0.15

// Générer un hash SHA256 du prompt pour recherche rapide
function hashPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { soulImageUrl, prompt, presetId, intentionImageUrl, previousFrameUrl, actorId, skipCache } = body as {
      soulImageUrl: string
      prompt: string
      presetId?: string
      intentionImageUrl?: string // Image de l'acteur dans cette intention
      previousFrameUrl?: string  // Image du clip précédent (pour continuité)
      actorId?: string           // ID de l'acteur pour le cache
      skipCache?: boolean        // Forcer la régénération
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

    const supabase = await createClient()

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
    const { data: promptData } = await supabase
      .from('system_prompts')
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
      const { data: existingAsset } = await supabase
        .from('generated_assets')
        .select('id, url')
        .eq('asset_type', 'first_frame')
        .eq('actor_id', actorId)
        .eq('prompt_hash', promptHash)
        .single()

      if (existingAsset) {
        console.log('✓ Cache hit! Reusing existing first frame:', existingAsset.url?.slice(0, 50))
        
        // Incrémenter le compteur d'utilisation
        await supabase.rpc('increment_asset_use_count', { asset_id: existingAsset.id })

        return NextResponse.json({ 
          url: existingAsset.url, 
          cached: true,
          usedIntentionImage: !!intentionImageUrl && !previousFrameUrl,
          usedPreviousFrame: !!previousFrameUrl 
        })
      }
    }

    // ══════════════════════════════════════════════════════════════
    // GÉNÉRER UNE NOUVELLE IMAGE
    // ══════════════════════════════════════════════════════════════
    const startTime = Date.now()
    const url = await generateFirstFrame(referenceImageUrl, fullPrompt)
    const generationTime = Date.now() - startTime

    console.log('First frame generated:', url?.slice(0, 50), `(${generationTime}ms)`)

    // ══════════════════════════════════════════════════════════════
    // SAUVEGARDER L'ASSET (sauf si previousFrame car trop spécifique)
    // ══════════════════════════════════════════════════════════════
    if (!previousFrameUrl && actorId && url) {
      const { error: insertError } = await supabase
        .from('generated_assets')
        .insert({
          asset_type: 'first_frame',
          actor_id: actorId,
          preset_id: presetId || null,
          prompt: fullPrompt,
          prompt_hash: promptHash,
          url: url,
          generation_cost: GENERATION_COST,
          generation_time_ms: generationTime,
          model_used: 'fal-ai/flux-pro', // ou le modèle utilisé
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
      usedPreviousFrame: !!previousFrameUrl 
    })
  } catch (error) {
    console.error('Error generating first frame:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur de génération' },
      { status: 500 }
    )
  }
}

