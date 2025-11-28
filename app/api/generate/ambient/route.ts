import { NextRequest, NextResponse } from 'next/server'
import { generateAmbientAudio } from '@/lib/api/falai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, duration } = body as {
      prompt: string
      duration?: number
    }

    if (!prompt) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      )
    }

    const audioUrl = await generateAmbientAudio(prompt, duration)

    return NextResponse.json({ audioUrl })
  } catch (error) {
    console.error('Error generating ambient audio:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur de génération' },
      { status: 500 }
    )
  }
}

