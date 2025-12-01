import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateVideo, getVeo31Endpoint, VideoQuality } from '@/lib/api/falai'
import { getUserCredits, getGenerationCost, GenerationType, isAdminEmail } from '@/lib/credits'
import { createGenerationLog, markGenerationCompleted, markGenerationFailed } from '@/lib/generation-logger'
import { VideoEngine } from '@/types'

// Map quality to generation type for credits
function getGenerationTypeForQuality(quality: VideoQuality): GenerationType {
  return quality === 'fast' ? 'video_veo31_fast' : 'video_veo31_standard'
}

export async function POST(request: NextRequest) {
  let logId: string | null = null
  const startTime = Date.now()
  
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { prompt, firstFrameUrl, engine, duration, campaignId, clipId, skipCredits, quality } = body as {
      prompt: string
      firstFrameUrl: string
      engine: VideoEngine
      duration: number
      campaignId?: string
      clipId?: string
      skipCredits?: boolean // For testing only
      quality?: VideoQuality // 'standard' (default) or 'fast'
    }

    // Default to fast quality (moins cher)
    const videoQuality: VideoQuality = quality || 'fast'

    if (!prompt || !firstFrameUrl || !engine || !duration) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      )
    }

    // Determine generation type based on quality (standard or fast)
    const generationType = getGenerationTypeForQuality(videoQuality)
    
    // Get price per second from DB
    const pricePerSecond = await getGenerationCost(generationType)
    
    // Calculate total cost based on duration
    const totalCost = pricePerSecond * duration

    // Check credits (unless skipped for testing or admin)
    if (!skipCredits && !isAdminEmail(user.email)) {
      const userCredits = await getUserCredits(user.id)
      
      if (!userCredits || userCredits.balance < totalCost) {
        return NextResponse.json(
          { 
            error: 'Crédits insuffisants',
            code: 'INSUFFICIENT_CREDITS',
            required: totalCost,
            current: userCredits?.balance || 0,
            missing: totalCost - (userCredits?.balance || 0),
          },
          { status: 402 }
        )
      }
    }

    // Create generation log
    const modelPath = getVeo31Endpoint(videoQuality)
    logId = await createGenerationLog({
      userId: user.id,
      generationType,
      modelPath,
      inputParams: {
        prompt: prompt.slice(0, 500),
        firstFrameUrl: firstFrameUrl.slice(0, 200),
        duration,
        engine,
        quality: videoQuality,
      },
      estimatedCostCents: totalCost,
      campaignId,
      clipId,
    })

    // Generate video
    const videoUrl = await generateVideo(prompt, firstFrameUrl, engine, duration, videoQuality)

    // Mark log as completed
    if (logId) {
      await markGenerationCompleted(logId, videoUrl, startTime, totalCost, {
        durationSeconds: duration,
      })
    }

    // Deduct credits after successful generation
    if (!skipCredits && !isAdminEmail(user.email)) {
      // Deduct manually with calculated cost
      const { error: deductError } = await (supabase.rpc as any)('deduct_credits', {
        p_user_id: user.id,
        p_amount: totalCost,
        p_description: `Vidéo Veo 3.1 ${videoQuality === 'fast' ? 'Fast' : 'Standard'} (${duration}s)`,
        p_generation_type: generationType,
        p_campaign_id: campaignId || null,
        p_clip_id: clipId || null,
      })
      
      if (deductError) {
        console.error('Failed to deduct credits:', deductError)
      }
    }

    return NextResponse.json({ videoUrl, logId, quality: videoQuality, cost: totalCost })
  } catch (error) {
    console.error('Error generating video:', error)
    
    // Mark log as failed
    if (logId) {
      await markGenerationFailed(
        logId,
        error instanceof Error ? error.message : 'Unknown error',
        startTime
      )
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur de génération' },
      { status: 500 }
    )
  }
}

