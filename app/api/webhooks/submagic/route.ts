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

    // Trouver la campagne par submagic_project_id avec sa config
    const { data: campaign, error: fetchError } = await (supabase.from('campaigns') as any)
      .select('id, submagic_status, submagic_config')
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
    const now = new Date().toISOString()
    const updateData: Record<string, unknown> = {
      submagic_status: newStatus,
      submagic_updated_at: now,
      updated_at: now
    }

    // Ajouter l'URL vidéo si disponible
    const videoUrl = directUrl || downloadUrl
    if (status === 'completed' && videoUrl) {
      updateData.submagic_video_url = videoUrl
      
      // Créer une entrée dans l'historique des versions
      // D'abord, compter les versions existantes pour cette campagne
      const { count } = await (supabase.from('submagic_versions') as any)
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
      
      const versionNumber = (count || 0) + 1
      
      // Insérer la nouvelle version
      const { error: versionError } = await (supabase.from('submagic_versions') as any)
        .insert({
          campaign_id: campaign.id,
          project_id: projectId,
          video_url: videoUrl,
          config: campaign.submagic_config || {},
          status: 'completed',
          version_number: versionNumber,
        })
      
      if (versionError) {
        console.error('[Submagic Webhook] Error creating version:', versionError)
        // On continue quand même, ce n'est pas bloquant
      } else {
        console.log(`[Submagic Webhook] Created version ${versionNumber} for campaign ${campaign.id}`)
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

