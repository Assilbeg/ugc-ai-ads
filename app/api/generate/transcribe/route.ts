import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/api/falai'
import { analyzeSpeechBoundaries } from '@/lib/api/claude'

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
    let words_per_second = 3.0  // Défaut
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
        words_per_second = analysis.words_per_second
        suggested_speed = analysis.suggested_speed

        console.log('[Transcribe] Claude analysis:', {
          speech_start,
          speech_end,
          confidence,
          words_per_second,
          suggested_speed,
          reasoning: reasoning.slice(0, 50) + '...'
        })
      } catch (claudeError) {
        console.warn('[Transcribe] Claude analysis failed, using Whisper:', claudeError)
        confidence = 'low'
        reasoning = 'Claude analysis failed, using raw Whisper timestamps'
        
        // Calcul basique du débit si Claude échoue
        const wordCount = whisperResult.text.split(/\s+/).filter((w: string) => w.length > 0).length
        const speechDuration = speech_end - speech_start
        if (speechDuration > 0) {
          words_per_second = Math.round((wordCount / speechDuration) * 10) / 10
          if (words_per_second < 2.5) suggested_speed = 1.2
          else if (words_per_second < 3.0) suggested_speed = 1.1
          else if (words_per_second > 4.5) suggested_speed = 0.8
          else if (words_per_second > 4.0) suggested_speed = 0.9
        }
      }
    }

    console.log('[Transcribe] ✓ Final result:', {
      speech_start,
      speech_end,
      confidence,
      words_per_second,
      suggested_speed
    })

    return NextResponse.json({
      text: whisperResult.text,
      chunks: whisperResult.chunks,
      speech_start,
      speech_end,
      confidence,
      reasoning,
      words_per_second,
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

