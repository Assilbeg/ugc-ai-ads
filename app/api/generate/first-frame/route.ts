import { NextRequest, NextResponse } from 'next/server'
import { generateFirstFrame } from '@/lib/api/falai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { soulImageUrl, prompt } = body as {
      soulImageUrl: string
      prompt: string
    }

    if (!soulImageUrl || !prompt) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      )
    }

    const imageUrl = await generateFirstFrame(soulImageUrl, prompt)

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error('Error generating first frame:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur de génération' },
      { status: 500 }
    )
  }
}

