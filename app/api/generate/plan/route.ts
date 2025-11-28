import { NextRequest, NextResponse } from 'next/server'
import { generateCampaignPlan } from '@/lib/api/claude'
import { Actor, IntentionPreset, CampaignBrief, ProductConfig } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { actor, preset, brief, product } = body as {
      actor: Actor
      preset: IntentionPreset
      brief: CampaignBrief
      product: ProductConfig
    }

    if (!actor || !preset || !brief) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      )
    }

    const plan = await generateCampaignPlan({
      actor,
      preset,
      brief,
      product,
    })

    return NextResponse.json(plan)
  } catch (error) {
    console.error('Error generating plan:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur de génération' },
      { status: 500 }
    )
  }
}

