import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPortalSession } from '@/lib/stripe'
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

    // Get user's Stripe customer ID
    const userCredits = await getUserCredits(user.id)
    
    if (!userCredits?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Aucun compte Stripe associé. Effectuez d\'abord un achat.' },
        { status: 400 }
      )
    }

    // Build return URL
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const returnUrl = `${origin}/dashboard/billing`

    // Create portal session
    const session = await createPortalSession(
      userCredits.stripe_customer_id,
      returnUrl
    )

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creating portal session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la création de la session' },
      { status: 500 }
    )
  }
}



