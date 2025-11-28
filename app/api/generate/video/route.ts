import { NextRequest, NextResponse } from 'next/server'
import { generateVideo } from '@/lib/api/falai'
import { VideoEngine } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, firstFrameUrl, engine, duration } = body as {
      prompt: string
      firstFrameUrl: string
      engine: VideoEngine
      duration: number
    }

    if (!prompt || !firstFrameUrl || !engine || !duration) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      )
    }

    const videoUrl = await generateVideo(prompt, firstFrameUrl, engine, duration)

    return NextResponse.json({ videoUrl })
  } catch (error) {
    console.error('Error generating video:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur de génération' },
      { status: 500 }
    )
  }
}

