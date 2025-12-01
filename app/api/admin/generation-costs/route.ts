import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface GenerationCost {
  id: string
  name: string
  description: string | null
  cost_cents: number
  real_cost_cents: number | null
  is_active: boolean
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
    // In production, check user role or email

    const body = await request.json()
    const { costs } = body as { costs: GenerationCost[] }

    if (!costs || !Array.isArray(costs)) {
      return NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 }
      )
    }

    // Update each cost
    for (const cost of costs) {
      const { error } = await (supabase
        .from('generation_costs') as any)
        .update({
          cost_cents: cost.cost_cents,
          real_cost_cents: cost.real_cost_cents,
          is_active: cost.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cost.id)

      if (error) {
        console.error('Error updating cost:', error)
        return NextResponse.json(
          { error: `Erreur lors de la mise à jour de ${cost.id}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in generation-costs API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

