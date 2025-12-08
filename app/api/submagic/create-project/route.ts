import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCredits, deductCredits, isAdminEmail } from '@/lib/credits'
import type { SubmagicConfig } from '@/types'

const SUBMAGIC_COST = 25 // crédits

// Mapping langue brief → Submagic
const languageMap: Record<string, string> = {
  'fr': 'fr',
  'en-us': 'en',
  'en-uk': 'en',
  'es': 'es',
  'es-latam': 'es',
  'de': 'de',
  'it': 'it',
  'pt-br': 'pt',
  'pt': 'pt',
  'nl': 'nl'
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { campaignId, config } = body as { campaignId: string; config: SubmagicConfig }

    if (!campaignId || !config) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    // Vérifier crédits (sauf admin)
    const isAdmin = isAdminEmail(user.email)
    if (!isAdmin) {
      const creditsCheck = await checkCredits(user.id, 'submagic_subtitles', user.email)
      if (!creditsCheck.hasEnough) {
        return NextResponse.json({ 
          error: 'Crédits insuffisants',
          required: SUBMAGIC_COST,
          current: creditsCheck.currentBalance
        }, { status: 402 })
      }
    }

    // Récupérer la campagne avec clips
    const { data: campaign, error: fetchError } = await (supabase.from('campaigns') as any)
      .select('*, campaign_clips(*)')
      .eq('id', campaignId)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campagne non trouvée' }, { status: 404 })
    }

    if (!campaign.final_video_url) {
      return NextResponse.json({ error: 'La vidéo finale n\'est pas encore disponible' }, { status: 400 })
    }

    // Vérifier qu'un traitement n'est pas déjà en cours
    if (campaign.submagic_status === 'processing') {
      return NextResponse.json({ error: 'Un traitement Submagic est déjà en cours' }, { status: 409 })
    }

    // Extraire le dictionnaire automatiquement
    const dictionary = extractDictionary(campaign)

    // Construire le payload Submagic
    // Tronquer le titre à 100 caractères max (limite Submagic)
    const rawTitle = campaign.brief?.what_selling || 'UGC Video'
    const title = rawTitle.length > 100 ? rawTitle.slice(0, 97) + '...' : rawTitle
    
    const submagicPayload: Record<string, unknown> = {
      title,
      language: languageMap[campaign.brief?.language] || 'fr',
      videoUrl: campaign.final_video_url,
      templateName: config.templateName || 'Sara',
      dictionary,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/submagic`,
    }

    // Hook Title (optionnel)
    if (config.hookTitle?.enabled && config.hookTitle.text) {
      submagicPayload.hookTitle = {
        text: config.hookTitle.text.slice(0, 100),
        template: config.hookTitle.template || 'tiktok',
        top: config.hookTitle.top ?? 50,
        size: config.hookTitle.size ?? 30
      }
    }

    // Magic Zooms
    if (config.magicZooms !== undefined) {
      submagicPayload.magicZooms = config.magicZooms
    }

    // Magic B-rolls
    if (config.magicBrolls !== undefined) {
      submagicPayload.magicBrolls = config.magicBrolls
      if (config.magicBrolls && config.magicBrollsPercentage !== undefined) {
        submagicPayload.magicBrollsPercentage = config.magicBrollsPercentage
      }
    }

    // Remove Silence Pace
    if (config.removeSilencePace) {
      submagicPayload.removeSilencePace = config.removeSilencePace
    }

    // Remove Bad Takes
    if (config.removeBadTakes !== undefined) {
      submagicPayload.removeBadTakes = config.removeBadTakes
    }

    console.log('[Submagic] Creating project with payload:', JSON.stringify(submagicPayload, null, 2))

    // Appeler Submagic
    const apiKey = process.env.SUBMAGIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'SUBMAGIC_API_KEY not configured' }, { status: 500 })
    }

    const submagicResponse = await fetch('https://api.submagic.co/v1/projects', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submagicPayload)
    })

    if (!submagicResponse.ok) {
      const errorData = await submagicResponse.json().catch(() => ({}))
      console.error('[Submagic] API error:', submagicResponse.status, errorData)
      return NextResponse.json({ 
        error: errorData.message || 'Erreur Submagic' 
      }, { status: submagicResponse.status })
    }

    const submagicData = await submagicResponse.json()
    console.log('[Submagic] Project created:', submagicData)

    // Déduire les crédits (après succès Submagic)
    if (!isAdmin) {
      await deductCredits(
        user.id, 
        'submagic_subtitles', 
        'Sous-titres Submagic',
        campaignId,
        undefined,
        user.email
      )
    }

    // Mettre à jour la campagne
    const { error: updateError } = await (supabase.from('campaigns') as any)
      .update({
        submagic_project_id: submagicData.id,
        submagic_status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)

    if (updateError) {
      console.error('[Submagic] Error updating campaign:', updateError)
    }

    return NextResponse.json({ 
      success: true, 
      projectId: submagicData.id,
      status: 'processing'
    })

  } catch (error) {
    console.error('[Submagic] Error creating project:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

/**
 * Extrait un dictionnaire de termes importants pour améliorer la transcription
 */
function extractDictionary(campaign: any): string[] {
  const terms = new Set<string>()
  
  // Nom du produit
  if (campaign.brief?.what_selling) {
    const productName = campaign.brief.what_selling.slice(0, 50)
    terms.add(productName)
    
    // Ajouter les mots individuels du nom s'ils sont longs
    productName.split(/\s+/).forEach((word: string) => {
      const clean = word.replace(/[^a-zA-ZÀ-ÿ]/g, '')
      if (clean.length > 4) {
        terms.add(clean)
      }
    })
  }

  // Mots des scripts (> 5 lettres, pas mots courants)
  const commonWords = new Set([
    'alors', 'aussi', 'autre', 'avant', 'comme', 'dans', 'depuis', 'encore', 
    'entre', 'être', 'faire', 'leurs', 'mais', 'même', 'notre', 'nous', 
    'parce', 'plus', 'pour', 'quand', 'quel', 'cette', 'tout', 'tous', 
    'très', 'vous', 'avec', 'avoir', 'bien', 'cette', 'chez', 'comment',
    'donc', 'elle', 'elles', 'encore', 'enfin', 'fait', 'faut', 'genre',
    'jamais', 'juste', 'moins', 'peut', 'puis', 'sais', 'sans', 'sont',
    'toujours', 'trop', 'vraiment', 'aujourd', 'because', 'really', 'actually',
    'thing', 'things', 'stuff', 'something', 'everything', 'nothing', 'anyone'
  ])
  
  campaign.campaign_clips?.forEach((clip: any) => {
    const text = clip.script?.text || ''
    const words = text.split(/\s+/)
    words.forEach((word: string) => {
      const clean = word.replace(/[^a-zA-ZÀ-ÿ]/g, '').toLowerCase()
      if (clean.length > 5 && !commonWords.has(clean) && terms.size < 50) {
        terms.add(clean)
      }
    })
  })

  // Limiter à 100 termes max (limite API Submagic)
  return Array.from(terms).slice(0, 100)
}

