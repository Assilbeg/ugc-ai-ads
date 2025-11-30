import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// fal.ai configuration
const FAL_KEY = process.env.FAL_KEY

interface Track {
  id: string
  type: 'video' | 'audio'
  keyframes: Array<{
    url: string
    start?: number
    duration?: number
  }>
}

interface ComposeInput {
  tracks: Track[]
}

interface ComposeOutput {
  video_url: string
  thumbnail_url: string
}

/**
 * Assemble multiple video clips into a single video using fal.ai FFmpeg API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoUrls, campaignId } = body as {
      videoUrls: string[]
      campaignId: string
    }

    if (!videoUrls || videoUrls.length === 0) {
      return NextResponse.json(
        { error: 'videoUrls est requis' },
        { status: 400 }
      )
    }

    if (!FAL_KEY) {
      return NextResponse.json(
        { error: 'FAL_KEY non configuré' },
        { status: 500 }
      )
    }

    console.log('[Assemble] Starting assembly of', videoUrls.length, 'clips')

    // Construire les tracks pour fal.ai FFmpeg compose
    // Chaque vidéo est un keyframe dans une track vidéo
    const videoTrack: Track = {
      id: 'video-track',
      type: 'video',
      keyframes: videoUrls.map((url, index) => ({
        url,
        start: index === 0 ? 0 : undefined, // Le premier commence à 0, les autres s'enchaînent
      }))
    }

    const input: ComposeInput = {
      tracks: [videoTrack]
    }

    // Appeler fal.ai FFmpeg compose
    const response = await fetch('https://fal.run/fal-ai/ffmpeg-api/compose', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Assemble] fal.ai error:', errorText)
      throw new Error(`fal.ai error: ${response.status}`)
    }

    const result: ComposeOutput = await response.json()
    console.log('[Assemble] Video assembled:', result.video_url?.slice(0, 50))

    // Sauvegarder l'URL finale dans la campagne
    if (campaignId && result.video_url) {
      const supabase = await createClient()
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('campaigns') as any)
        .update({ 
          final_video_url: result.video_url,
          status: 'completed'
        })
        .eq('id', campaignId)
      
      console.log('[Assemble] Campaign updated with final video')
    }

    return NextResponse.json({
      videoUrl: result.video_url,
      thumbnailUrl: result.thumbnail_url,
    })
  } catch (error) {
    console.error('[Assemble] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur assemblage' },
      { status: 500 }
    )
  }
}

