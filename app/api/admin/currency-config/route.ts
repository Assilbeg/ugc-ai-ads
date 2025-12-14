import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface CurrencyConfig {
  id?: string
  language_code: string
  currency_code: string
  currency_symbol: string
  exchange_rate: number
  is_default: boolean
  is_active: boolean
}

// GET - Fetch all currency configs
export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data, error } = await (supabase
      .from('currency_config') as any)
      .select('*')
      .order('language_code')
    
    if (error) {
      console.error('Error fetching currency configs:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des devises' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ configs: data })
  } catch (error) {
    console.error('Error in currency-config API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// PUT - Update currency configs
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { configs } = body as { configs: CurrencyConfig[] }

    if (!configs || !Array.isArray(configs)) {
      return NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 }
      )
    }

    // Update each config
    for (const config of configs) {
      const { error } = await (supabase
        .from('currency_config') as any)
        .update({
          currency_code: config.currency_code,
          currency_symbol: config.currency_symbol,
          exchange_rate: config.exchange_rate,
          is_default: config.is_default,
          is_active: config.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('language_code', config.language_code)

      if (error) {
        console.error('Error updating currency config:', error)
        return NextResponse.json(
          { error: `Erreur lors de la mise à jour de ${config.language_code}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in currency-config API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// POST - Add new currency config
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const config = body as CurrencyConfig

    if (!config.language_code || !config.currency_code || !config.currency_symbol) {
      return NextResponse.json(
        { error: 'Données manquantes' },
        { status: 400 }
      )
    }

    const { data, error } = await (supabase
      .from('currency_config') as any)
      .insert({
        language_code: config.language_code,
        currency_code: config.currency_code,
        currency_symbol: config.currency_symbol,
        exchange_rate: config.exchange_rate || 1.0,
        is_default: config.is_default || false,
        is_active: config.is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding currency config:', error)
      return NextResponse.json(
        { error: 'Erreur lors de l\'ajout de la devise' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, config: data })
  } catch (error) {
    console.error('Error in currency-config API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// DELETE - Remove currency config
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const languageCode = searchParams.get('language_code')

    if (!languageCode) {
      return NextResponse.json(
        { error: 'Code de langue manquant' },
        { status: 400 }
      )
    }

    // Don't allow deleting the default currency
    const { data: config } = await (supabase
      .from('currency_config') as any)
      .select('is_default')
      .eq('language_code', languageCode)
      .single()

    if (config?.is_default) {
      return NextResponse.json(
        { error: 'Impossible de supprimer la devise par défaut' },
        { status: 400 }
      )
    }

    const { error } = await (supabase
      .from('currency_config') as any)
      .delete()
      .eq('language_code', languageCode)

    if (error) {
      console.error('Error deleting currency config:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la suppression' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in currency-config API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
