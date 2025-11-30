import { NextRequest, NextResponse } from 'next/server'
import { speechToSpeech } from '@/lib/api/falai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceAudioUrl, targetVoiceUrl } = body as {
      sourceAudioUrl: string   // Audio extrait de la vidéo Veo3
      targetVoiceUrl: string   // Voix de référence de l'acteur
    }

    if (!sourceAudioUrl || !targetVoiceUrl) {
      return NextResponse.json(
        { error: `Paramètres manquants: sourceAudioUrl=${!!sourceAudioUrl}, targetVoiceUrl=${!!targetVoiceUrl}` },
        { status: 400 }
      )
    }

    console.log('[Voice API] Speech-to-Speech conversion:', {
      source: sourceAudioUrl.slice(0, 50),
      target: targetVoiceUrl.slice(0, 50)
    })

    const audioUrl = await speechToSpeech(sourceAudioUrl, targetVoiceUrl)

    return NextResponse.json({ audioUrl })
  } catch (error) {
    console.error('Error in speech-to-speech:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur de conversion voix' },
      { status: 500 }
    )
  }
}

