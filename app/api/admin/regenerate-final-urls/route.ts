import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * API admin pour régénérer les final_url manquants
 * Appelle /api/generate/mix-video pour chaque clip qui a raw_url mais pas final_url
 * 
 * GET: Liste les clips à régénérer (preview)
 * POST: Régénère les final_url manquants
 */

interface ClipToRegenerate {
  id: string
  campaign_id: string
  beat: string
  order: number
  raw_url: string
  voice_url?: string
  ambient_url?: string
  duration: number
}

// Clé admin temporaire pour bypass auth (à retirer après usage)
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'ugc-admin-temp-2024'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'auth (admin only) ou clé admin
    const adminKey = request.headers.get('x-admin-key') || new URL(request.url).searchParams.get('key')
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user && adminKey !== ADMIN_KEY) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    
    // Trouver tous les clips
    const { data: clips, error } = await supabase
      .from('campaign_clips')
      .select('id, campaign_id, beat, order, video, audio, status') as { data: any[] | null; error: any }
    
    // Debug: log total clips
    console.log(`[Admin] Total clips: ${clips?.length || 0}`)
    
    // Filtrer manuellement les clips avec raw_url mais sans final_url
    const filteredClips = (clips || []).filter((clip: any) => {
      const hasRaw = !!clip.video?.raw_url
      const hasFinal = !!clip.video?.final_url
      if (hasRaw && !hasFinal) {
        console.log(`[Admin] Clip ${clip.id} needs regeneration: raw=${hasRaw}, final=${hasFinal}`)
      }
      return hasRaw && !hasFinal
    })
    
    if (error) {
      console.error('[Admin] Error fetching clips:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    const clipsToRegenerate: ClipToRegenerate[] = (filteredClips as any[]).map((clip: any) => ({
      id: clip.id,
      campaign_id: clip.campaign_id,
      beat: clip.beat,
      order: clip.order,
      raw_url: clip.video?.raw_url,
      voice_url: clip.audio?.transformed_voice_url,
      ambient_url: clip.audio?.ambient_url,
      duration: clip.video?.duration || 4,
    }))
    
    return NextResponse.json({
      count: clipsToRegenerate.length,
      clips: clipsToRegenerate,
      message: `${clipsToRegenerate.length} clips à régénérer. POST pour lancer.`
    })
    
  } catch (error) {
    console.error('[Admin] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'auth (admin only) ou clé admin
    const adminKey = request.headers.get('x-admin-key') || new URL(request.url).searchParams.get('key')
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user && adminKey !== ADMIN_KEY) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    
    // Option: régénérer un seul clip par ID
    const body = await request.json().catch(() => ({}))
    const singleClipId = body.clipId
    
    // Trouver tous les clips
    let query = supabase
      .from('campaign_clips')
      .select('id, campaign_id, beat, order, video, audio, status')
    
    if (singleClipId) {
      query = query.eq('id', singleClipId)
    }
    
    const { data: allClips, error } = await query as { data: any[] | null; error: any }
    
    if (error) {
      console.error('[Admin] Error fetching clips:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log(`[Admin POST] Total clips: ${allClips?.length || 0}`)
    
    // Filtrer manuellement les clips avec raw_url mais sans final_url
    const clips = (allClips || []).filter((clip: any) => 
      clip.video?.raw_url && !clip.video?.final_url
    )
    
    console.log(`[Admin POST] Clips to regenerate: ${clips.length}`)
    
    if (clips.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Aucun clip à régénérer',
        regenerated: 0 
      })
    }
    
    console.log(`[Admin] Régénération de ${clips.length} clips...`)
    
    const results: { id: string; success: boolean; final_url?: string; error?: string }[] = []
    
    // Traiter chaque clip séquentiellement
    for (const clip of clips as any[]) {
      const rawUrl = clip.video?.raw_url
      const voiceUrl = clip.audio?.transformed_voice_url
      const ambientUrl = clip.audio?.ambient_url
      const duration = clip.video?.duration || 4
      
      if (!rawUrl) {
        results.push({ id: clip.id, success: false, error: 'No raw_url' })
        continue
      }
      
      console.log(`[Admin] Processing clip ${clip.id} (beat: ${clip.beat})...`)
      
      try {
        // Appeler l'API mix-video
        const mixResponse = await fetch(new URL('/api/generate/mix-video', request.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoUrl: rawUrl,
            voiceUrl: voiceUrl,
            ambientUrl: ambientUrl,
            voiceVolume: clip.audio?.voice_volume ?? 100,
            ambientVolume: clip.audio?.ambient_volume ?? 20,
            duration: duration,
          }),
        })
        
        if (!mixResponse.ok) {
          const err = await mixResponse.json()
          throw new Error(err.error || 'Mix failed')
        }
        
        const mixData = await mixResponse.json()
        
        if (!mixData.mixed || !mixData.videoUrl) {
          // Pas de mixage nécessaire (pas d'audio à mixer)
          // Dans ce cas, utiliser raw_url comme final_url
          const { error: updateError } = await (supabase
            .from('campaign_clips') as any)
            .update({
              video: { ...clip.video, final_url: rawUrl }
            })
            .eq('id', clip.id)
          
          if (updateError) throw updateError
          
          results.push({ id: clip.id, success: true, final_url: rawUrl })
          console.log(`[Admin] ✓ Clip ${clip.id}: using raw_url as final_url`)
        } else {
          // Mixage réussi - mettre à jour la DB
          const { error: updateError } = await (supabase
            .from('campaign_clips') as any)
            .update({
              video: { ...clip.video, final_url: mixData.videoUrl },
              audio: { ...clip.audio, final_audio_url: mixData.videoUrl }
            })
            .eq('id', clip.id)
          
          if (updateError) throw updateError
          
          results.push({ id: clip.id, success: true, final_url: mixData.videoUrl })
          console.log(`[Admin] ✓ Clip ${clip.id}: mixed successfully`)
        }
        
      } catch (clipError) {
        console.error(`[Admin] ✗ Clip ${clip.id} failed:`, clipError)
        results.push({ 
          id: clip.id, 
          success: false, 
          error: clipError instanceof Error ? clipError.message : 'Unknown error' 
        })
      }
    }
    
    const succeeded = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    
    console.log(`[Admin] Régénération terminée: ${succeeded} succès, ${failed} échecs`)
    
    return NextResponse.json({
      success: true,
      total: results.length,
      succeeded,
      failed,
      results,
    })
    
  } catch (error) {
    console.error('[Admin] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur' },
      { status: 500 }
    )
  }
}

