import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCredits, checkCreditsForMultiple, GenerationType } from '@/lib/credits'

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
    
    // Single generation check
    if (body.generationType) {
      const result = await checkCredits(user.id, body.generationType as GenerationType, user.email)
      return NextResponse.json(result)
    }
    
    // Multiple generations check
    if (body.generations && Array.isArray(body.generations)) {
      const result = await checkCreditsForMultiple(user.id, body.generations, user.email)
      return NextResponse.json(result)
    }

    return NextResponse.json(
      { error: 'generationType ou generations requis' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error checking credits:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur' },
      { status: 500 }
    )
  }
}

