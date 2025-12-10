import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

interface ExtractedBrief {
  what_selling: string
  pain_point: string
  target_audience: string
  key_benefits: string[]
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL manquante' },
        { status: 400 }
      )
    }

    console.log('[Extract Brief] Fetching URL:', url)

    // Utiliser Jina Reader pour extraire le contenu en markdown
    const jinaUrl = `https://r.jina.ai/${url}`
    const contentResponse = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/markdown',
      },
    })

    if (!contentResponse.ok) {
      throw new Error(`Impossible de lire la page: ${contentResponse.status}`)
    }

    const pageContent = await contentResponse.text()
    
    // Limiter le contenu pour éviter de dépasser les tokens
    const truncatedContent = pageContent.slice(0, 15000)

    console.log('[Extract Brief] Content length:', truncatedContent.length)

    // Analyser avec Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Analyse cette page web et extrait les informations clés pour créer une publicité UGC.

CONTENU DE LA PAGE :
${truncatedContent}

════════════════════════════════════════
INSTRUCTIONS
════════════════════════════════════════
Extrait les informations suivantes en français. Si une info n'est pas claire, fais une déduction logique basée sur le contexte.

1. what_selling : Décris le produit/service vendu (2-3 phrases max)
2. pain_point : Quel problème/frustration/douleur cette offre résout ? (2-3 phrases, sois spécifique sur l'émotion)
3. target_audience : Qui est la cible ? (1 phrase)
4. key_benefits : Liste 2-4 bénéfices clés (tableau de strings)

Retourne UNIQUEMENT du JSON valide, sans markdown, sans backticks :
{
  "what_selling": "...",
  "pain_point": "...",
  "target_audience": "...",
  "key_benefits": ["...", "..."]
}`,
        },
      ],
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('Pas de réponse de Claude')
    }

    // Parser le JSON
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Impossible de parser la réponse')
    }

    const extracted = JSON.parse(jsonMatch[0]) as ExtractedBrief

    console.log('[Extract Brief] Extracted:', extracted)

    return NextResponse.json({
      success: true,
      brief: extracted,
    })
  } catch (error) {
    console.error('[Extract Brief] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur d\'extraction' },
      { status: 500 }
    )
  }
}










