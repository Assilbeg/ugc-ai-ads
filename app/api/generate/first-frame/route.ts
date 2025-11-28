import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFirstFrame } from '@/lib/api/falai'

// Default template if not found in DB
// {PROMPT} = contexte généré par Claude (lieu, expression, ambiance)
const DEFAULT_TEMPLATE = `Make me another photo like this as if it was another first frame of the same TikTok UGC but in a different position since she's talking to the camera. WEARING THE EXACT SAME CLOTHES AND OUTFIT as in the reference photo - do NOT change clothing. {PROMPT}. Same person as reference, same clothing.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { soulImageUrl, prompt } = body as {
      soulImageUrl: string
      prompt: string
    }

    console.log('First frame request:', { soulImageUrl: soulImageUrl?.slice(0, 50), prompt: prompt?.slice(0, 50) })

    if (!soulImageUrl || !prompt) {
      return NextResponse.json(
        { error: `Paramètres manquants: soulImageUrl=${!!soulImageUrl}, prompt=${!!prompt}` },
        { status: 400 }
      )
    }

    // Load prompt template from Supabase (editable via /admin/prompts)
    const supabase = await createClient()
    const { data: promptData } = await supabase
      .from('system_prompts')
      .select('prompt')
      .eq('id', 'nanobanana_frame')
      .single()

    const template = promptData?.prompt || DEFAULT_TEMPLATE
    
    // Replace {PROMPT} placeholder with actual prompt
    const fullPrompt = template.replace('{PROMPT}', prompt)

    const url = await generateFirstFrame(soulImageUrl, fullPrompt)

    console.log('First frame generated:', url?.slice(0, 50))

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error generating first frame:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur de génération' },
      { status: 500 }
    )
  }
}

