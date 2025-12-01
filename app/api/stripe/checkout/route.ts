import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/lib/stripe'
import { getUserCredits } from '@/lib/credits'

export async function POST(request: NextRequest) {
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
    const { planId } = body as { planId: string }

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID requis' },
        { status: 400 }
      )
    }

    // Get plan details
    const { data: plan, error: planError } = await (supabase
      .from('subscription_plans') as any)
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan non trouvé' },
        { status: 404 }
      )
    }

    // Check Early Bird eligibility if it's an early bird plan
    if (plan.is_early_bird) {
      const userCredits = await getUserCredits(user.id)
      
      if (!userCredits) {
        return NextResponse.json(
          { error: 'Compte utilisateur non trouvé' },
          { status: 404 }
        )
      }

      // Check if already used Early Bird
      if (userCredits.early_bird_used) {
        return NextResponse.json(
          { error: 'Offre Early Bird déjà utilisée' },
          { status: 400 }
        )
      }

      // Check if still eligible (within 24h)
      const now = new Date()
      const deadline = userCredits.early_bird_eligible_until 
        ? new Date(userCredits.early_bird_eligible_until)
        : null
      
      if (!deadline || now > deadline) {
        return NextResponse.json(
          { error: 'Offre Early Bird expirée' },
          { status: 400 }
        )
      }
    }

    // Check if Stripe Price ID is configured
    if (!plan.stripe_price_id) {
      return NextResponse.json(
        { error: 'Plan non configuré sur Stripe. Ajoutez le stripe_price_id dans l\'admin.' },
        { status: 400 }
      )
    }

    // Get user's existing Stripe customer ID
    const userCredits = await getUserCredits(user.id)
    
    // Build URLs
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = `${origin}/dashboard/billing?success=true&plan=${planId}`
    const cancelUrl = `${origin}/dashboard/billing?canceled=true`

    // Create Stripe checkout session
    const session = await createCheckoutSession({
      userId: user.id,
      userEmail: user.email!,
      planId,
      stripePriceId: plan.stripe_price_id,
      isSubscription: !plan.is_one_time,
      successUrl,
      cancelUrl,
      stripeCustomerId: userCredits?.stripe_customer_id || undefined,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la création de la session' },
      { status: 500 }
    )
  }
}

