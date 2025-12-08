import { NextResponse } from 'next/server'

// Cache en mémoire (6h)
let hookTemplatesCache: { data: string[]; timestamp: number } | null = null
const CACHE_DURATION = 6 * 60 * 60 * 1000

export async function GET() {
  try {
    // Vérifier cache
    if (hookTemplatesCache && Date.now() - hookTemplatesCache.timestamp < CACHE_DURATION) {
      return NextResponse.json({ templates: hookTemplatesCache.data })
    }

    const apiKey = process.env.SUBMAGIC_API_KEY
    if (!apiKey) {
      console.error('[Submagic] SUBMAGIC_API_KEY not configured')
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const response = await fetch('https://api.submagic.co/v1/hook-title/templates', {
      headers: { 'x-api-key': apiKey }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Submagic] Failed to fetch hook templates:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch hook templates' }, { status: response.status })
    }

    const data = await response.json()
    hookTemplatesCache = { data: data.templates, timestamp: Date.now() }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('[Submagic] Error fetching hook templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

