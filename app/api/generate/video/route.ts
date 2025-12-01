import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateVideo, getVeo31Endpoint, VEO31_PRICING, VideoQuality } from '@/lib/api/falai'
import { checkCredits, deductCredits, getGenerationCost, GenerationType } from '@/lib/credits'
import { createGenerationLog, markGenerationCompleted, markGenerationFailed, estimateCost } from '@/lib/generation-logger'
import { VideoEngine } from '@/types'

// Map quality to generation type for credits
function getGenerationTypeForQuality(quality: VideoQuality): GenerationType {
  return quality === 'fast' ? 'video_veo31_fast' : 'video_veo31'
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

    // Default to standard quality if not specified
    const videoQuality: VideoQuality = quality || 'standard'

    if (!prompt || !firstFrameUrl || !engine || !duration) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      )
    }

    // Determine generation type based on quality
    const generationType = getGenerationTypeForQuality(videoQuality)
    const qualityLabel = videoQuality === 'fast' ? 'Fast' : 'Standard'

    // Check credits (unless skipped for testing)
    if (!skipCredits) {
      const creditsCheck = await checkCredits(user.id, generationType, user.email)
      
      if (!creditsCheck.hasEnough) {
        return NextResponse.json(
          { 
            error: 'Crédits insuffisants',
            code: 'INSUFFICIENT_CREDITS',
            required: creditsCheck.requiredAmount,
            current: creditsCheck.currentBalance,
            missing: creditsCheck.missingAmount,
            isEarlyBirdEligible: creditsCheck.isEarlyBirdEligible,
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
      estimatedCostCents: estimateCost('video_veo31', { durationSeconds: duration, quality: videoQuality }),
      campaignId,
      clipId,
    })

    // Generate video
    const videoUrl = await generateVideo(prompt, firstFrameUrl, engine, duration, videoQuality)

    // Get billed cost
    const billedCost = await getGenerationCost(generationType)

    // Mark log as completed
    if (logId) {
      await markGenerationCompleted(logId, videoUrl, startTime, billedCost, {
        durationSeconds: duration,
      })
    }

    // Deduct credits after successful generation
    if (!skipCredits) {
      const deductResult = await deductCredits(
        user.id,
        generationType,
        `Vidéo Veo 3.1 ${qualityLabel} (${duration}s)`,
        campaignId,
        clipId,
        user.email
      )
      
      if (!deductResult.success) {
        console.error('Failed to deduct credits:', deductResult.errorMessage)
      }
    }

    return NextResponse.json({ videoUrl, logId, quality: videoQuality })
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

