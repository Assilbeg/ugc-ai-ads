import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/api/falai'
import { analyzeSpeechBoundaries } from '@/lib/api/claude'
import { countSyllables } from '@/lib/api/video-utils'

// Whisper + Claude analysis peut prendre jusqu'à 2 minutes
export const maxDuration = 120 // 2 minutes

interface TranscribeInput {
  audioUrl: string
  language?: string | null
  originalScript?: string    // Script original pour comparaison intelligente
  videoDuration?: number     // Durée de la vidéo
}

/**
 * Transcrit l'audio d'une vidéo avec timestamps mot par mot (Whisper)
 * puis utilise Claude pour trouver les VRAIS marqueurs de parole
 * en comparant avec le script original.
 * 
 * POST /api/generate/transcribe
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      audioUrl, 
      language = null,
      originalScript,
      videoDuration = 6,
    } = body as TranscribeInput

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'audioUrl est requis' },
        { status: 400 }
      )
    }

    console.log('[Transcribe] Starting transcription:', {
      audioUrl: audioUrl.slice(0, 50) + '...',
      language: language || 'auto-detect',
      hasScript: !!originalScript,
      videoDuration
    })

    // Étape 1 : Transcription Whisper
    const whisperResult = await transcribeAudio(audioUrl, language)

    console.log('[Transcribe] Whisper done:', {
      text: whisperResult.text.slice(0, 50) + '...',
      chunks: whisperResult.chunks.length,
    })

    // Étape 2 : Analyse intelligente avec Claude (si script fourni)
    let speech_start = whisperResult.speech_start
    let speech_end = whisperResult.speech_end
    let confidence: 'high' | 'medium' | 'low' = 'medium'
    let reasoning = 'Based on raw Whisper timestamps'
    let syllables_per_second = 5.5  // Défaut (milieu de la zone "bon")
    let suggested_speed = 1.0   // Défaut

    if (originalScript && whisperResult.chunks.length > 0) {
      console.log('[Transcribe] Analyzing with Claude...')
      
      try {
        const analysis = await analyzeSpeechBoundaries({
          transcription: {
            text: whisperResult.text,
            chunks: whisperResult.chunks,
          },
          originalScript,
          videoDuration,
        })

        speech_start = analysis.speech_start
        speech_end = analysis.speech_end
        confidence = analysis.confidence
        reasoning = analysis.reasoning
        syllables_per_second = analysis.syllables_per_second
        // IMPORTANT: Pas de vitesse < 1.0 (pas de ralentissement pour UGC TikTok)
        suggested_speed = Math.max(1.0, analysis.suggested_speed)

        console.log('[Transcribe] Claude analysis:', {
          speech_start,
          speech_end,
          confidence,
          syllables_per_second,
          suggested_speed,
          reasoning: reasoning.slice(0, 50) + '...'
        })
      } catch (claudeError) {
        console.warn('[Transcribe] Claude analysis failed, using Whisper:', claudeError)
        confidence = 'low'
        reasoning = 'Claude analysis failed, using raw Whisper timestamps'
        
        // Calcul basique du débit en SYLLABES si Claude échoue (UGC TikTok = pas de ralentissement)
        const syllableCount = countSyllables(originalScript)
        const speechDuration = speech_end - speech_start
        if (speechDuration > 0) {
          syllables_per_second = Math.round((syllableCount / speechDuration) * 10) / 10
          // Seuils : < 5 s/s = trop lent → 1.2x | 5-6 s/s = un peu lent → 1.1x | ≥ 6 s/s = bon → 1.0x
          if (syllables_per_second < 5) suggested_speed = 1.2
          else if (syllables_per_second < 6) suggested_speed = 1.1
          // Pas de 0.8x ou 0.9x - on garde 1.0x même si rapide
        }
      }
    }

    console.log('[Transcribe] ✓ Final result:', {
      speech_start,
      speech_end,
      confidence,
      syllables_per_second,
      suggested_speed
    })

    return NextResponse.json({
      text: whisperResult.text,
      chunks: whisperResult.chunks,
      speech_start,
      speech_end,
      confidence,
      reasoning,
      syllables_per_second,
      suggested_speed,
    })

  } catch (error) {
    console.error('[Transcribe] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur transcription' },
      { status: 500 }
    )
  }
}

