import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // TODO: Add proper admin check

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')

    let query = (supabase.from('generation_logs') as any)
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq('generation_type', type)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: logs, error } = await query

    if (error) {
      console.error('Error fetching logs:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des logs' },
        { status: 500 }
      )
    }

    // Get stats
    const { data: stats } = await (supabase.from('generation_logs') as any)
      .select('generation_type, status, estimated_cost_cents, actual_cost_cents, billed_cost_cents, duration_ms')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    const summary = {
      total: stats?.length || 0,
      completed: stats?.filter((s: any) => s.status === 'completed').length || 0,
      failed: stats?.filter((s: any) => s.status === 'failed').length || 0,
      totalEstimatedCost: stats?.reduce((sum: number, s: any) => sum + (s.estimated_cost_cents || 0), 0) || 0,
      totalActualCost: stats?.reduce((sum: number, s: any) => sum + (s.actual_cost_cents || 0), 0) || 0,
      totalBilled: stats?.reduce((sum: number, s: any) => sum + (s.billed_cost_cents || 0), 0) || 0,
      avgDurationMs: stats?.length 
        ? Math.round(stats.reduce((sum: number, s: any) => sum + (s.duration_ms || 0), 0) / stats.length)
        : 0,
    }

    return NextResponse.json({ logs, summary })
  } catch (error) {
    console.error('Error in generation-logs API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}



