import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAmbientAudio } from '@/lib/api/falai'
import { checkCredits, deductCredits, getGenerationCost } from '@/lib/credits'
import { createGenerationLog, markGenerationCompleted, markGenerationFailed } from '@/lib/generation-logger'

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
    const { prompt, duration, campaignId, clipId, skipCredits } = body as {
      prompt: string
      duration?: number
      campaignId?: string
      clipId?: string
      skipCredits?: boolean
    }

    if (!prompt) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      )
    }

    // Check credits
    if (!skipCredits) {
      const creditsCheck = await checkCredits(user.id, 'ambient_elevenlabs', user.email)
      
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
    logId = await createGenerationLog({
      userId: user.id,
      generationType: 'ambient_elevenlabs',
      modelPath: 'fal-ai/elevenlabs/sound-effects/v2',
      inputParams: {
        prompt: prompt.slice(0, 500),
        duration,
      },
      campaignId,
      clipId,
    })

    const audioUrl = await generateAmbientAudio(prompt, duration)

    // Get billed cost
    const billedCost = await getGenerationCost('ambient_elevenlabs')

    // Mark log as completed
    if (logId) {
      await markGenerationCompleted(logId, audioUrl, startTime, billedCost, {
        durationSeconds: duration,
      })
    }

    // Deduct credits after successful generation
    if (!skipCredits) {
      const deductResult = await deductCredits(
        user.id,
        'ambient_elevenlabs',
        'Audio ambiant ElevenLabs',
        campaignId,
        clipId,
        user.email
      )
      
      if (!deductResult.success) {
        console.error('Failed to deduct credits:', deductResult.errorMessage)
      }
    }

    return NextResponse.json({ audioUrl, logId })
  } catch (error) {
    console.error('Error generating ambient audio:', error)
    
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

