import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/api/falai'
import { analyzeSpeechBoundaries } from '@/lib/api/claude'
import { createClient } from '@/lib/supabase/server'

interface AnalyzeClipInput {
  clipId: string
  videoUrl: string
  originalScript: string
  videoDuration: number
}

/**
 * Analyse un clip existant pour générer les données de transcription
 * (speech_start, speech_end, words_per_second, suggested_speed)
 * 
 * Utile pour les clips générés avant l'ajout de cette feature.
 * 
 * POST /api/generate/analyze-clip
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      clipId,
      videoUrl, 
      originalScript,
      videoDuration = 6,
    } = body as AnalyzeClipInput

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'videoUrl est requis' },
        { status: 400 }
      )
    }

    console.log('[Analyze] Starting analysis for clip:', {
      clipId,
      videoUrl: videoUrl.slice(0, 50) + '...',
      hasScript: !!originalScript,
      videoDuration
    })

    // Étape 1 : Transcription Whisper
    const whisperResult = await transcribeAudio(videoUrl, null)

    console.log('[Analyze] Whisper done:', {
      text: whisperResult.text.slice(0, 50) + '...',
      chunks: whisperResult.chunks.length,
    })

    // Étape 2 : Analyse Claude (si script fourni)
    let speech_start = whisperResult.speech_start
    let speech_end = whisperResult.speech_end
    let confidence: 'high' | 'medium' | 'low' = 'medium'
    let words_per_second = 3.0
    let suggested_speed = 1.0

    if (originalScript && whisperResult.chunks.length > 0) {
      console.log('[Analyze] Analyzing with Claude...')
      
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
        words_per_second = analysis.words_per_second
        suggested_speed = analysis.suggested_speed

        console.log('[Analyze] Claude analysis:', {
          speech_start,
          speech_end,
          confidence,
          words_per_second,
          suggested_speed,
        })
      } catch (claudeError) {
        console.warn('[Analyze] Claude analysis failed:', claudeError)
        confidence = 'low'
        
        // Calcul basique
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

    // Étape 3 : Sauvegarder dans Supabase (si clipId fourni)
    if (clipId) {
      const supabase = await createClient()
      
      const transcriptionData = {
        text: whisperResult.text,
        chunks: whisperResult.chunks,
        speech_start,
        speech_end,
        words_per_second,
        suggested_speed,
      }

      // Note: transcription est un champ JSONB ajouté récemment
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('campaign_clips')
        .update({ transcription: transcriptionData })
        .eq('id', clipId)

      if (error) {
        console.error('[Analyze] Failed to save transcription:', error)
      } else {
        console.log('[Analyze] ✓ Transcription saved to DB')
      }
    }

    console.log('[Analyze] ✓ Done:', {
      speech_start,
      speech_end,
      words_per_second,
      suggested_speed,
      confidence
    })

    return NextResponse.json({
      text: whisperResult.text,
      chunks: whisperResult.chunks,
      speech_start,
      speech_end,
      confidence,
      words_per_second,
      suggested_speed,
    })

  } catch (error) {
    console.error('[Analyze] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur analyse' },
      { status: 500 }
    )
  }
}

