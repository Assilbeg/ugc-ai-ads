import { NextRequest, NextResponse } from 'next/server'

const FAL_KEY = process.env.FAL_KEY

interface MixVideoInput {
  videoUrl: string           // URL de la vidéo brute (Veo)
  voiceUrl?: string          // URL de la voiceover (speech-to-speech)
  ambientUrl?: string        // URL de l'ambiance (ElevenLabs)
  voiceVolume?: number       // Volume voix (0-100, défaut 100)
  ambientVolume?: number     // Volume ambiance (0-100, défaut 20)
  duration: number           // Durée en secondes
}

interface Track {
  id: string
  type: 'video' | 'audio'
  keyframes: { url: string; timestamp: number; duration: number }[]
}

interface ComposeOutput {
  video_url: string
  thumbnail_url?: string
}

/**
 * Mixe une vidéo avec voiceover et ambiance
 * Utilise fal.ai FFmpeg compose pour combiner les tracks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      videoUrl, 
      voiceUrl, 
      ambientUrl, 
      voiceVolume = 100, 
      ambientVolume = 20,
      duration 
    } = body as MixVideoInput

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'videoUrl est requis' },
        { status: 400 }
      )
    }

    if (!FAL_KEY) {
      return NextResponse.json(
        { error: 'FAL_KEY non configuré' },
        { status: 500 }
      )
    }

    // Si pas d'audio à mixer, retourner la vidéo originale
    if (!voiceUrl && !ambientUrl) {
      console.log('[Mix] No audio to mix, returning original video')
      return NextResponse.json({ 
        videoUrl,
        mixed: false 
      })
    }

    console.log('[Mix] Starting video mix:', {
      videoUrl: videoUrl.slice(0, 50),
      voiceUrl: voiceUrl?.slice(0, 50),
      ambientUrl: ambientUrl?.slice(0, 50),
      voiceVolume,
      ambientVolume,
      duration
    })

    const durationMs = duration * 1000

    // Track vidéo (sans audio - on va utiliser les tracks audio séparées)
    const tracks: Track[] = [
      {
        id: 'video-track',
        type: 'video',
        keyframes: [{
          url: videoUrl,
          timestamp: 0,
          duration: durationMs
        }]
      }
    ]

    // Track voiceover
    if (voiceUrl) {
      tracks.push({
        id: 'voice-track',
        type: 'audio',
        keyframes: [{
          url: voiceUrl,
          timestamp: 0,
          duration: durationMs
        }]
      })
      console.log('[Mix] Added voice track')
    }

    // Track ambiance
    if (ambientUrl) {
      tracks.push({
        id: 'ambient-track',
        type: 'audio',
        keyframes: [{
          url: ambientUrl,
          timestamp: 0,
          duration: durationMs
        }]
      })
      console.log('[Mix] Added ambient track')
    }

    // Appeler fal.ai FFmpeg compose
    console.log('[Mix] Calling fal.ai FFmpeg compose with', tracks.length, 'tracks')
    
    const response = await fetch('https://fal.run/fal-ai/ffmpeg-api/compose', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tracks })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Mix] fal.ai error:', errorText)
      throw new Error(`fal.ai error: ${response.status} - ${errorText}`)
    }

    const result: ComposeOutput = await response.json()
    console.log('[Mix] Video mixed successfully:', result.video_url?.slice(0, 50))

    return NextResponse.json({
      videoUrl: result.video_url,
      thumbnailUrl: result.thumbnail_url,
      mixed: true
    })

  } catch (error) {
    console.error('[Mix] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur mixage vidéo' },
      { status: 500 }
    )
  }
}

