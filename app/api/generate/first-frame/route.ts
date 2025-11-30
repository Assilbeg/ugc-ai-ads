import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFirstFrame } from '@/lib/api/falai'

// Template si on utilise la soul_image (sans intention_media pré-générée)
const DEFAULT_TEMPLATE = `Make me another photo like this as if it was another first frame of the same TikTok UGC but in a different position since she's talking to the camera. WEARING THE EXACT SAME CLOTHES AND OUTFIT as in the reference photo - do NOT change clothing. {PROMPT}. Same person as reference, same clothing. NO TIKTOK UI, NO TEXT, NO WATERMARKS, NO OVERLAYS.`

// Template si on utilise une intention_image (l'acteur est déjà dans le bon contexte)
const INTENTION_IMAGE_TEMPLATE = `Generate a variation of this same person in the same setting, but with a different pose/expression. {PROMPT}. Keep the EXACT SAME FACE, clothing, and location. Only change the expression and gesture as described. NO TIKTOK UI, NO TEXT, NO WATERMARKS, NO OVERLAYS.`

// Template si on utilise l'image du clip précédent (continuité entre clips)
const PREVIOUS_FRAME_TEMPLATE = `Generate the next frame of this same TikTok UGC video with the same person. {PROMPT}. Keep the EXACT SAME FACE, clothing and style. Maintain visual continuity with the reference. NO TIKTOK UI, NO TEXT, NO WATERMARKS, NO OVERLAYS.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { soulImageUrl, prompt, presetId, intentionImageUrl, previousFrameUrl } = body as {
      soulImageUrl: string
      prompt: string
      presetId?: string
      intentionImageUrl?: string // Image de l'acteur dans cette intention
      previousFrameUrl?: string  // Image du clip précédent (pour continuité)
    }

    console.log('First frame request:', { 
      soulImageUrl: soulImageUrl?.slice(0, 50), 
      prompt: prompt?.slice(0, 50),
      presetId,
      hasIntentionImage: !!intentionImageUrl,
      hasPreviousFrame: !!previousFrameUrl
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
    const supabase = await createClient()
    const { data: promptData } = await supabase
      .from('system_prompts')
      .select('prompt')
      .eq('id', promptId)
      .single()

    template = promptData?.prompt || template
    
    // Replace {PROMPT} placeholder with actual prompt
    const fullPrompt = template.replace('{PROMPT}', prompt)

    const url = await generateFirstFrame(referenceImageUrl, fullPrompt)

    console.log('First frame generated:', url?.slice(0, 50))

    return NextResponse.json({ 
      url, 
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

