import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Webhook endpoint pour les notifications Submagic
 * Appelé par Submagic quand le traitement est terminé
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectId, status, downloadUrl, directUrl } = body

    console.log('[Submagic Webhook] Received:', { projectId, status, hasDownloadUrl: !!downloadUrl, hasDirectUrl: !!directUrl })

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    // Utiliser service client pour bypass RLS
    const supabase = createServiceClient()

    // Trouver la campagne par submagic_project_id
    const { data: campaign, error: fetchError } = await (supabase.from('campaigns') as any)
      .select('id, submagic_status')
      .eq('submagic_project_id', projectId)
      .single()

    if (fetchError || !campaign) {
      console.error('[Submagic Webhook] Campaign not found for projectId:', projectId, fetchError)
      // Retourner 200 quand même pour éviter les retries Submagic
      return NextResponse.json({ error: 'Campaign not found', received: true }, { status: 200 })
    }

    // Mapper le statut Submagic vers notre statut
    let newStatus: 'processing' | 'completed' | 'failed' = 'processing'
    if (status === 'completed') {
      newStatus = 'completed'
    } else if (status === 'failed') {
      newStatus = 'failed'
    }

    // Construire les données de mise à jour
    const updateData: Record<string, unknown> = {
      submagic_status: newStatus,
      updated_at: new Date().toISOString()
    }

    // Ajouter l'URL vidéo si disponible
    if (status === 'completed') {
      // Préférer directUrl (CDN) sur downloadUrl
      const videoUrl = directUrl || downloadUrl
      if (videoUrl) {
        updateData.submagic_video_url = videoUrl
      }
    }

    // Mettre à jour la campagne
    const { error: updateError } = await (supabase.from('campaigns') as any)
      .update(updateData)
      .eq('id', campaign.id)

    if (updateError) {
      console.error('[Submagic Webhook] Error updating campaign:', updateError)
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
    }

    console.log(`[Submagic Webhook] Campaign ${campaign.id} updated: ${newStatus}`)

    return NextResponse.json({ success: true, campaignId: campaign.id, status: newStatus })

  } catch (error) {
    console.error('[Submagic Webhook] Error processing webhook:', error)
    // Retourner 200 pour éviter les retries
    return NextResponse.json({ error: 'Internal error', received: true }, { status: 200 })
  }
}

/**
 * Health check pour vérifier que le webhook est accessible
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'submagic-webhook' })
}

