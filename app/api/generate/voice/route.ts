import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { speechToSpeech } from '@/lib/api/falai'
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
    const { sourceAudioUrl, targetVoiceUrl, campaignId, clipId, skipCredits } = body as {
      sourceAudioUrl: string   // Audio extrait de la vidéo Veo3
      targetVoiceUrl: string   // Voix de référence de l'acteur
      campaignId?: string
      clipId?: string
      skipCredits?: boolean
    }

    if (!sourceAudioUrl || !targetVoiceUrl) {
      return NextResponse.json(
        { error: `Paramètres manquants: sourceAudioUrl=${!!sourceAudioUrl}, targetVoiceUrl=${!!targetVoiceUrl}` },
        { status: 400 }
      )
    }

    // Check credits
    if (!skipCredits) {
      const creditsCheck = await checkCredits(user.id, 'voice_chatterbox')
      
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
      generationType: 'voice_chatterbox',
      modelPath: 'resemble-ai/chatterboxhd/speech-to-speech',
      inputParams: {
        sourceAudioUrl: sourceAudioUrl.slice(0, 200),
        targetVoiceUrl: targetVoiceUrl.slice(0, 200),
      },
      campaignId,
      clipId,
    })

    console.log('[Voice API] Speech-to-Speech conversion:', {
      source: sourceAudioUrl.slice(0, 50),
      target: targetVoiceUrl.slice(0, 50)
    })

    const audioUrl = await speechToSpeech(sourceAudioUrl, targetVoiceUrl)

    // Get billed cost
    const billedCost = await getGenerationCost('voice_chatterbox')

    // Mark log as completed
    if (logId) {
      await markGenerationCompleted(logId, audioUrl, startTime, billedCost)
    }

    // Deduct credits after successful generation
    if (!skipCredits) {
      const deductResult = await deductCredits(
        user.id,
        'voice_chatterbox',
        'Conversion voix Chatterbox HD',
        campaignId,
        clipId
      )
      
      if (!deductResult.success) {
        console.error('Failed to deduct credits:', deductResult.errorMessage)
      }
    }

    return NextResponse.json({ audioUrl, logId })
  } catch (error) {
    console.error('Error in speech-to-speech:', error)
    
    // Mark log as failed
    if (logId) {
      await markGenerationFailed(
        logId,
        error instanceof Error ? error.message : 'Unknown error',
        startTime
      )
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur de conversion voix' },
      { status: 500 }
    )
  }
}

