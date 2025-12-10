import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe, createOrGetStripeCustomer } from '@/lib/stripe'
import { isAdmin } from '@/lib/admin'

// Custom checkout for admin - variable amount
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

    // Only admin can use this endpoint
    if (!isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { amount } = body as { amount: number }

    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: 'Montant minimum: 1€ (100 centimes)' },
        { status: 400 }
      )
    }

    // Get user's existing Stripe customer ID
    const { data: userCredits } = await (supabase
      .from('user_credits') as any)
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    const stripe = getStripe()

    // Get or create customer
    const customerId = await createOrGetStripeCustomer(
      user.id,
      user.email!,
      userCredits?.stripe_customer_id
    )

    // Build URLs
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = `${origin}/dashboard/billing?success=true&custom=true`
    const cancelUrl = `${origin}/dashboard/billing?canceled=true`

    // Create checkout session with custom amount
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Crédits UGC AI (Admin)',
              description: `Recharge de ${(amount / 100).toFixed(2)}€ de crédits`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        plan_id: 'custom_admin',
        credits_amount: amount.toString(),
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          plan_id: 'custom_admin',
          credits_amount: amount.toString(),
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creating custom checkout session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la création de la session' },
      { status: 500 }
    )
  }
}









