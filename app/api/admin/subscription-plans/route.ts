import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface SubscriptionPlan {
  id: string
  name: string
  description: string | null
  price_cents: number
  monthly_credits: number
  stripe_price_id: string | null
  is_early_bird: boolean
  is_one_time: boolean
  is_active: boolean
  display_order: number
  features: string[]
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is admin (you should implement proper admin check)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // TODO: Add proper admin check here
    // For now, we'll allow any authenticated user for development

    const body = await request.json()
    const { plans } = body as { plans: SubscriptionPlan[] }

    if (!plans || !Array.isArray(plans)) {
      return NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 }
      )
    }

    // Update each plan
    for (const plan of plans) {
      const { error } = await (supabase
        .from('subscription_plans') as any)
        .update({
          name: plan.name,
          description: plan.description,
          price_cents: plan.price_cents,
          monthly_credits: plan.monthly_credits,
          stripe_price_id: plan.stripe_price_id,
          is_active: plan.is_active,
          display_order: plan.display_order,
          features: plan.features,
          updated_at: new Date().toISOString(),
        })
        .eq('id', plan.id)

      if (error) {
        console.error('Error updating plan:', error)
        return NextResponse.json(
          { error: `Erreur lors de la mise à jour de ${plan.id}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in subscription-plans API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

