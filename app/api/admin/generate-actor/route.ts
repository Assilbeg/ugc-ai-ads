import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateSoulImage, buildActorPrompt, ActorDescription } from '@/lib/api/higgsfield'
import { isAdmin } from '@/lib/admin'

/**
 * POST /api/admin/generate-actor
 * Génère un acteur via Higgsfield Soul et l'ajoute à la DB
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { actor, saveToDb = false } = body as { 
      actor: ActorDescription
      saveToDb?: boolean 
    }

    if (!actor || !actor.name || !actor.gender) {
      return NextResponse.json(
        { error: 'Paramètres manquants: actor requis avec name et gender' },
        { status: 400 }
      )
    }

    // Build prompt
    const prompt = buildActorPrompt(actor)
    console.log('[Generate Actor] Prompt:', prompt)

    // Generate via Higgsfield Soul
    const result = await generateSoulImage(prompt, '9:16')
    console.log('[Generate Actor] Generated:', result.image_url)

    // Optionally save to DB
    // On utilise le service client pour bypass RLS car les acteurs preset ont user_id = null
    let savedActor = null
    if (saveToDb) {
      const serviceSupabase = createServiceClient()
      const { data, error } = await (serviceSupabase
        .from('actors') as any)
        .insert({
          name: actor.name,
          soul_image_url: result.image_url,
          appearance: {
            gender: actor.gender,
            age_range: actor.age_range,
            ethnicity: actor.ethnicity,
            hair: actor.hair,
            distinctive_features: actor.distinctive_features,
          },
          voice: {
            voice_style: '',
            reference_audio_url: '',
          },
          is_custom: false,
          user_id: null, // Preset actors have no owner
        })
        .select()
        .single()

      if (error) {
        console.error('[Generate Actor] DB error:', error)
        return NextResponse.json({ 
          error: 'Acteur généré mais erreur DB: ' + error.message,
          image_url: result.image_url,
          prompt,
        }, { status: 500 })
      }

      savedActor = data
    }

    return NextResponse.json({
      success: true,
      image_url: result.image_url,
      request_id: result.request_id,
      prompt,
      actor: savedActor,
    })

  } catch (error) {
    console.error('[Generate Actor] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}

