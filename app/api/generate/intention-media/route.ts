import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateFirstFrame } from '@/lib/api/falai'
import { IntentionPreset, ActorIntentionMedia } from '@/types'

// Templates par filming_type pour générer l'image de l'acteur
const FILMING_TYPE_TEMPLATES: Record<string, string> = {
  // Selfie tenu à la main - bras tendu visible
  handheld: `Generate a photo of this same person as a first frame for a TikTok UGC video. {CONTEXT}. Same person as reference, natural selfie pose with arm extended holding phone visible in frame, looking at camera, authentic UGC selfie style. KEEP THE EXACT SAME FACE AND IDENTITY. NO TIKTOK UI, NO TEXT, NO WATERMARKS, NO OVERLAYS ON THE IMAGE.`,
  
  // Filmé par quelqu'un d'autre - pas de bras tendu, cadrage plus large
  filmed_by_other: `Generate a photo of this same person as a first frame for a TikTok UGC video. {CONTEXT}. Same person as reference, natural pose as if filmed by someone else, looking at camera or slightly off-camera, half-body or full-body framing, authentic UGC style. KEEP THE EXACT SAME FACE AND IDENTITY. NO TIKTOK UI, NO TEXT, NO WATERMARKS, NO OVERLAYS ON THE IMAGE.`,
  
  // Téléphone posé/trépied - cadrage fixe, mains libres pour montrer produit
  setup_phone: `Generate a photo of this same person as a first frame for a TikTok UGC video. {CONTEXT}. Same person as reference, natural pose with both hands free (as if phone is on tripod), looking at camera, half-body framing showing hands/desk area, authentic UGC style. KEEP THE EXACT SAME FACE AND IDENTITY. NO TIKTOK UI, NO TEXT, NO WATERMARKS, NO OVERLAYS ON THE IMAGE.`,
}

// Construire le contexte visuel à partir du preset
function buildContextFromPreset(preset: IntentionPreset): string {
  const { first_frame } = preset
  
  const locationDescriptions: Record<string, string> = {
    bedroom: 'In a cozy bedroom, sitting on the bed',
    living_room: 'In a comfortable living room, on the couch',
    kitchen: 'In a bright modern kitchen, standing by the counter',
    bathroom: 'In a bathroom, mirror selfie style',
    office_desk: 'At a home office desk',
    car: 'In a car interior, sitting in driver seat with seatbelt',
    street_urban: 'On a city street, walking casually, urban background',
    cafe: 'In a cozy cafe, sitting at a table',
    park_outdoor: 'In a park outdoors, natural setting',
    neutral_background: 'Against a clean neutral background',
  }

  const lightingDescriptions: Record<string, string> = {
    soft_warm: 'soft warm lamp light',
    bright_natural: 'bright natural morning light',
    golden_hour: 'golden hour warm sunlight',
    neutral_daylight: 'neutral natural daylight',
    moody_low: 'moody low ambient lighting',
    ring_light: 'professional ring light',
  }

  const expressionDescriptions: Record<string, string> = {
    neutral_relaxed: 'looking relaxed and natural',
    thoughtful: 'looking thoughtful',
    excited: 'looking excited and energetic',
    curious: 'looking curious',
    frustrated: 'looking slightly frustrated',
    relieved: 'looking relieved',
    confident: 'looking confident',
    surprised: 'looking surprised',
  }

  const location = locationDescriptions[first_frame.location] || first_frame.location
  const lighting = lightingDescriptions[first_frame.lighting] || first_frame.lighting
  const expression = expressionDescriptions[first_frame.base_expression] || first_frame.base_expression

  return `${location}, ${lighting}, ${expression}, ${first_frame.extra_prompt}`
}

// Obtenir le template selon le filming_type
function getTemplateForFilmingType(filmingType?: string): string {
  return FILMING_TYPE_TEMPLATES[filmingType || 'handheld'] || FILMING_TYPE_TEMPLATES.handheld
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { actorId, soulImageUrl, presets, customPrompts } = body as {
      actorId: string
      soulImageUrl: string
      presets: IntentionPreset[]
      customPrompts?: Record<string, string> // presetId -> custom prompt
    }

    if (!actorId || !soulImageUrl || !presets?.length) {
      return NextResponse.json(
        { error: 'Paramètres manquants: actorId, soulImageUrl, presets requis' },
        { status: 400 }
      )
    }

    console.log(`[Intention Media] Generating ${presets.length} images for actor ${actorId}`)

    // Générer toutes les images en parallèle
    const generationPromises = presets.map(async (preset) => {
      // Utiliser le prompt personnalisé s'il existe, sinon construire le prompt par défaut
      let fullPrompt: string
      if (customPrompts?.[preset.id]) {
        fullPrompt = customPrompts[preset.id]
        console.log(`[Intention Media] Using custom prompt for ${preset.id}`)
      } else {
        const context = buildContextFromPreset(preset)
        const template = getTemplateForFilmingType(preset.filming_type)
        fullPrompt = template.replace('{CONTEXT}', context)
        console.log(`[Intention Media] Using filming_type: ${preset.filming_type || 'handheld'} for ${preset.id}`)
      }

      console.log(`[Intention Media] Generating ${preset.id}...`)
      
      try {
        const imageUrl = await generateFirstFrame(soulImageUrl, fullPrompt)
        console.log(`[Intention Media] ✓ ${preset.id} done`)
        return { presetId: preset.id, imageUrl, success: true }
      } catch (error) {
        console.error(`[Intention Media] ✗ ${preset.id} failed:`, error)
        return { presetId: preset.id, imageUrl: null, success: false, error: String(error) }
      }
    })

    const results = await Promise.all(generationPromises)

    // Construire l'objet intention_media
    const intentionMedia: Record<string, ActorIntentionMedia> = {}
    const failures: string[] = []

    for (const result of results) {
      if (result.success && result.imageUrl) {
        intentionMedia[result.presetId] = { image_url: result.imageUrl }
      } else {
        failures.push(result.presetId)
      }
    }

    // Mettre à jour l'acteur dans Supabase
    // On utilise le service client pour bypass RLS car les acteurs preset ont user_id = null
    const supabase = await createServiceClient()
    
    // D'abord récupérer les intention_media existantes
    const { data: existingActor } = await (supabase
      .from('actors') as any)
      .select('intention_media')
      .eq('id', actorId)
      .single()

    // Merger avec les nouvelles (garder les vidéos existantes si présentes)
    const existingMedia = (existingActor?.intention_media as Record<string, ActorIntentionMedia>) || {}
    const mergedIntentionMedia: Record<string, ActorIntentionMedia> = {}
    
    // Copier l'existant
    for (const [presetId, media] of Object.entries(existingMedia)) {
      mergedIntentionMedia[presetId] = { ...media }
    }
    
    // Ajouter/mettre à jour avec les nouvelles images
    for (const [presetId, media] of Object.entries(intentionMedia)) {
      mergedIntentionMedia[presetId] = {
        ...mergedIntentionMedia[presetId],
        image_url: media.image_url,
      }
    }

    const { error: updateError } = await (supabase
      .from('actors') as any)
      .update({ intention_media: mergedIntentionMedia })
      .eq('id', actorId)

    if (updateError) {
      console.error('[Intention Media] Failed to update actor:', updateError)
      return NextResponse.json(
        { error: `Erreur mise à jour acteur: ${updateError.message}` },
        { status: 500 }
      )
    }

    console.log(`[Intention Media] ✓ Actor updated with ${Object.keys(intentionMedia).length} new images`)

    return NextResponse.json({
      success: true,
      generated: Object.keys(intentionMedia),
      failed: failures,
      intentionMedia: mergedIntentionMedia,
    })
  } catch (error) {
    console.error('[Intention Media] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur de génération' },
      { status: 500 }
    )
  }
}

