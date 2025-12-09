import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/api/falai'
import { analyzeSpeechBoundaries } from '@/lib/api/claude'
import { createClient } from '@/lib/supabase/server'
import { countSyllables } from '@/lib/api/video-utils'

interface AnalyzeClipInput {
  clipId: string
  videoUrl: string
  originalScript: string
  videoDuration: number
}

/**
 * Analyse un clip existant pour générer les données de transcription
 * (speech_start, speech_end, syllables_per_second, suggested_speed)
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
    let syllables_per_second = 5.5  // Défaut (milieu de la zone "bon")
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
        syllables_per_second = analysis.syllables_per_second
        // IMPORTANT: Pas de vitesse < 1.0 (pas de ralentissement pour UGC TikTok)
        suggested_speed = Math.max(1.0, analysis.suggested_speed)

        console.log('[Analyze] Claude analysis:', {
          speech_start,
          speech_end,
          confidence,
          syllables_per_second,
          suggested_speed,
        })
      } catch (claudeError) {
        console.warn('[Analyze] Claude analysis failed:', claudeError)
        confidence = 'low'
        
        // Calcul basique en SYLLABES (UGC TikTok = pas de ralentissement)
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

    // Étape 3 : Sauvegarder dans Supabase (si clipId fourni)
    if (clipId) {
      const supabase = await createClient()
      
      const transcriptionData = {
        text: whisperResult.text,
        chunks: whisperResult.chunks,
        speech_start,
        speech_end,
        syllables_per_second,
        suggested_speed,
      }
      
      // Calculer les ajustements automatiques basés sur la transcription
      const trimStart = Math.max(0, speech_start)
      const trimEnd = Math.min(speech_end, videoDuration)
      const adjustmentsData = {
        trimStart,
        trimEnd,
        speed: suggested_speed,
      }

      // Sauvegarder transcription + ajustements
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('campaign_clips')
        .update({ 
          transcription: transcriptionData,
          adjustments: adjustmentsData,
        })
        .eq('id', clipId)

      if (error) {
        console.error('[Analyze] Failed to save transcription/adjustments:', error)
      } else {
        console.log('[Analyze] ✓ Transcription + adjustments saved to DB')
      }
    }

    console.log('[Analyze] ✓ Done:', {
      speech_start,
      speech_end,
      syllables_per_second,
      suggested_speed,
      confidence
    })

    return NextResponse.json({
      text: whisperResult.text,
      chunks: whisperResult.chunks,
      speech_start,
      speech_end,
      confidence,
      syllables_per_second,
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

