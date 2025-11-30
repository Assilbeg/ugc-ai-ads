import { NextRequest, NextResponse } from 'next/server'
import { speechToSpeech, generateAmbientAudio } from '@/lib/api/falai'

/**
 * ENDPOINT DE TEST - Pipeline Audio Complet
 * 
 * Permet de tester le flux audio sans regénérer de vidéo :
 * 1. Speech-to-Speech (Chatterbox HD)
 * 2. Génération d'ambiance (ElevenLabs SFX)
 * 
 * Le mixage final sera fait côté client ou via FFmpeg plus tard.
 */

interface TestRequest {
  // Source audio (URL vidéo Veo3 ou audio extrait)
  sourceAudioUrl: string
  // Voix de référence de l'acteur
  targetVoiceUrl: string
  // Prompt pour l'ambiance
  ambientPrompt?: string
  // Durée de l'ambiance (secondes)
  ambientDuration?: number
}

interface TestResponse {
  success: boolean
  // Audio transformé par Chatterbox
  transformedVoiceUrl?: string
  // Ambiance générée
  ambientUrl?: string
  // Erreurs éventuelles
  errors: string[]
  // Temps de traitement
  timing: {
    speechToSpeech?: number
    ambient?: number
    total: number
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const errors: string[] = []
  const timing: TestResponse['timing'] = { total: 0 }
  
  let transformedVoiceUrl: string | undefined
  let ambientUrl: string | undefined

  try {
    const body: TestRequest = await request.json()
    const { 
      sourceAudioUrl, 
      targetVoiceUrl, 
      ambientPrompt = 'quiet room ambient, subtle background noise',
      ambientDuration = 10 
    } = body

    console.log('[Test Pipeline] Starting audio pipeline test:', {
      sourceAudioUrl: sourceAudioUrl?.slice(0, 50),
      targetVoiceUrl: targetVoiceUrl?.slice(0, 50),
      ambientPrompt: ambientPrompt?.slice(0, 50),
      ambientDuration
    })

    if (!sourceAudioUrl || !targetVoiceUrl) {
      return NextResponse.json({
        success: false,
        errors: ['sourceAudioUrl et targetVoiceUrl sont requis'],
        timing: { total: Date.now() - startTime }
      } as TestResponse, { status: 400 })
    }

    // ══════════════════════════════════════════════════════════════
    // ÉTAPE 1 : Speech-to-Speech (Chatterbox HD)
    // ══════════════════════════════════════════════════════════════
    const s2sStart = Date.now()
    try {
      console.log('[Test Pipeline] Step 1: Speech-to-Speech...')
      transformedVoiceUrl = await speechToSpeech(sourceAudioUrl, targetVoiceUrl)
      timing.speechToSpeech = Date.now() - s2sStart
      console.log('[Test Pipeline] ✓ Speech-to-Speech done:', transformedVoiceUrl?.slice(0, 50))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur Speech-to-Speech'
      errors.push(`Speech-to-Speech: ${errorMsg}`)
      console.error('[Test Pipeline] ✗ Speech-to-Speech failed:', errorMsg)
    }

    // ══════════════════════════════════════════════════════════════
    // ÉTAPE 2 : Génération d'ambiance (ElevenLabs SFX)
    // ══════════════════════════════════════════════════════════════
    const ambientStart = Date.now()
    try {
      console.log('[Test Pipeline] Step 2: Generating ambient audio...')
      ambientUrl = await generateAmbientAudio(ambientPrompt, ambientDuration)
      timing.ambient = Date.now() - ambientStart
      console.log('[Test Pipeline] ✓ Ambient audio done:', ambientUrl?.slice(0, 50))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur génération ambiance'
      errors.push(`Ambient: ${errorMsg}`)
      console.error('[Test Pipeline] ✗ Ambient generation failed:', errorMsg)
    }

    timing.total = Date.now() - startTime

    const success = errors.length === 0 && !!transformedVoiceUrl

    console.log('[Test Pipeline] Pipeline completed:', { 
      success, 
      errors, 
      timing,
      transformedVoiceUrl: transformedVoiceUrl?.slice(0, 50),
      ambientUrl: ambientUrl?.slice(0, 50)
    })

    return NextResponse.json({
      success,
      transformedVoiceUrl,
      ambientUrl,
      errors,
      timing
    } as TestResponse)

  } catch (error) {
    console.error('[Test Pipeline] Fatal error:', error)
    return NextResponse.json({
      success: false,
      errors: [error instanceof Error ? error.message : 'Erreur fatale'],
      timing: { total: Date.now() - startTime }
    } as TestResponse, { status: 500 })
  }
}

