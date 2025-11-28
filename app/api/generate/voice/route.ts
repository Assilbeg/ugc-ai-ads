import { NextRequest, NextResponse } from 'next/server'
import { cloneVoice } from '@/lib/api/falai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoUrl, referenceVoiceUrl, text } = body as {
      videoUrl: string
      referenceVoiceUrl: string
      text?: string
    }

    if (!videoUrl || !referenceVoiceUrl) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      )
    }

    const audioUrl = await cloneVoice(videoUrl, referenceVoiceUrl, text)

    return NextResponse.json({ audioUrl })
  } catch (error) {
    console.error('Error cloning voice:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur de clonage' },
      { status: 500 }
    )
  }
}

