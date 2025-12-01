import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserCredits, getAllGenerationCosts, estimateCampaignCost, getRemainingGenerations } from '@/lib/credits'

export async function GET() {
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

    // Get user credits
    const userCredits = await getUserCredits(user.id)
    
    if (!userCredits) {
      return NextResponse.json(
        { error: 'Compte utilisateur non trouvé' },
        { status: 404 }
      )
    }

    // Get generation costs
    const costs = await getAllGenerationCosts()
    
    // Get remaining generations estimate
    const remaining = await getRemainingGenerations(userCredits.balance)
    
    // Check Early Bird eligibility
    const now = new Date()
    const earlyBirdDeadline = userCredits.early_bird_eligible_until 
      ? new Date(userCredits.early_bird_eligible_until)
      : null
    const isEarlyBirdEligible = earlyBirdDeadline 
      ? now < earlyBirdDeadline && !userCredits.early_bird_used
      : false
    const earlyBirdTimeRemaining = earlyBirdDeadline && isEarlyBirdEligible
      ? Math.max(0, earlyBirdDeadline.getTime() - now.getTime())
      : 0

    return NextResponse.json({
      balance: userCredits.balance,
      subscription: {
        tier: userCredits.subscription_tier,
        status: userCredits.subscription_status,
        currentPeriodEnd: userCredits.subscription_current_period_end,
      },
      earlyBird: {
        eligible: isEarlyBirdEligible,
        used: userCredits.early_bird_used,
        deadline: userCredits.early_bird_eligible_until,
        timeRemaining: earlyBirdTimeRemaining,
      },
      costs,
      remaining,
    })
  } catch (error) {
    console.error('Error fetching credits:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur' },
      { status: 500 }
    )
  }
}

