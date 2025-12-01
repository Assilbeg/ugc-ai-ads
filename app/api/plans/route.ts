import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserCredits } from '@/lib/credits'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get authenticated user (optional - to check Early Bird eligibility)
    const { data: { user } } = await supabase.auth.getUser()

    // Get all active plans
    const { data: plans, error } = await (supabase
      .from('subscription_plans') as any)
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: 'Erreur lors du chargement des plans' },
        { status: 500 }
      )
    }

    // Check Early Bird eligibility if user is authenticated
    let isEarlyBirdEligible = false
    
    if (user) {
      const userCredits = await getUserCredits(user.id)
      
      if (userCredits) {
        const now = new Date()
        const deadline = userCredits.early_bird_eligible_until 
          ? new Date(userCredits.early_bird_eligible_until)
          : null
        isEarlyBirdEligible = deadline 
          ? now < deadline && !userCredits.early_bird_used
          : false
      }
    }

    // Filter plans based on Early Bird eligibility
    const filteredPlans = plans?.filter((plan: any) => {
      if (plan.is_early_bird) {
        return isEarlyBirdEligible
      }
      return true
    }) || []

    return NextResponse.json({
      plans: filteredPlans,
      isEarlyBirdEligible,
    })
  } catch (error) {
    console.error('Error fetching plans:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur' },
      { status: 500 }
    )
  }
}

