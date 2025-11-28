import { NextRequest, NextResponse } from 'next/server'
import { regenerateClipScript } from '@/lib/api/claude'
import { CampaignClip, IntentionPreset, CampaignBrief } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clip, preset, brief, feedback } = body as {
      clip: CampaignClip
      preset: IntentionPreset
      brief: CampaignBrief
      feedback?: string
    }

    if (!clip || !preset || !brief) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      )
    }

    const newScript = await regenerateClipScript(clip, preset, brief, feedback)

    return NextResponse.json({ script: newScript })
  } catch (error) {
    console.error('Error regenerating clip:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur de régénération' },
      { status: 500 }
    )
  }
}

