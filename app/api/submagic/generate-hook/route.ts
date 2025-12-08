import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { campaignId } = body as { campaignId: string }

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId manquant' }, { status: 400 })
    }

    // Récupérer la campagne avec ses clips
    const { data: campaign, error: fetchError } = await (supabase.from('campaigns') as any)
      .select('*, campaign_clips(*)')
      .eq('id', campaignId)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campagne non trouvée' }, { status: 404 })
    }

    const brief = campaign.brief
    const clips = campaign.campaign_clips || []
    
    // Récupérer le script du premier clip (hook) pour contexte
    const hookClip = clips.find((c: any) => c.order === 1 || c.script?.beat === 'hook')
    const hookScript = hookClip?.script?.text || ''
    
    // Construire le contexte pour Claude
    const productName = brief?.what_selling || 'le produit'
    const sellingPoints = brief?.selling_points || ''
    const painPoint = brief?.pain_point || ''
    const language = brief?.language || 'fr'
    
    const languageInstruction = language.startsWith('en') 
      ? 'Write in English'
      : language === 'es' || language === 'es-latam'
      ? 'Escribe en español'
      : language === 'de'
      ? 'Schreibe auf Deutsch'
      : language === 'it'
      ? 'Scrivi in italiano'
      : language === 'pt' || language === 'pt-br'
      ? 'Escreva em português'
      : 'Écris en français'

    // Prompt optimisé pour générer un hook accrocheur
    const prompt = `Tu es un expert en copywriting TikTok/Reels. Génère UN SEUL hook textuel ultra-accrocheur pour une vidéo UGC.

RÈGLES STRICTES :
- Maximum 8 mots + 1 emoji pertinent à la fin
- Doit STOPPER LE SCROLL immédiatement
- Doit créer de la curiosité ou de l'identification
- ${languageInstruction}
- PAS de guillemets autour du texte
- PAS de ponctuation inutile
- JAMAIS de formule générique type "Découvrez..." ou "Tu veux savoir..."

CONTEXTE :
- Produit : ${productName}
- Points forts : ${sellingPoints}
- Problème cible : ${painPoint}
- Script du hook vidéo : ${hookScript}

EXEMPLES DE BONS HOOKS (pour inspiration) :
- "la stratégie secrète des top performers 🚀"
- "personne ne te dit ça sur LinkedIn 🤫"
- "j'aurais aimé savoir ça avant 💡"
- "le hack que j'utilise tous les jours ⚡"
- "arrête de faire cette erreur 🛑"

Réponds UNIQUEMENT avec le hook, rien d'autre. Pas d'explication, pas de préambule.`

    console.log('[Submagic] Generating hook for campaign:', campaignId)

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    // Extraire le texte de la réponse
    const hookText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
      // Nettoyer les guillemets potentiels
      .replace(/^["']|["']$/g, '')
      .trim()

    console.log('[Submagic] Generated hook:', hookText)

    return NextResponse.json({ 
      success: true, 
      hook: hookText 
    })

  } catch (error) {
    console.error('[Submagic] Error generating hook:', error)
    return NextResponse.json({ error: 'Erreur lors de la génération du hook' }, { status: 500 })
  }
}

