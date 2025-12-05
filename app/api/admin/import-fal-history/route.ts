import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'

/**
 * API pour importer l'historique FAL depuis le CSV scrappé du dashboard
 * 
 * GET: Parse le CSV et retourne les stats + récupère les URLs FAL
 * POST: Compare avec la DB et identifie les orphelins
 */

const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'ugc-admin-temp-2024'
const FAL_KEY = process.env.FAL_KEY

interface FalRequest {
  requestId: string
  model: string
  modelEndpoint: string  // Endpoint complet pour récupérer le résultat
  playgroundUrl: string
  timeAgo: string
  duration: string
  status: string
}

interface FalResult {
  requestId: string
  model: string
  url: string | null
  error?: string
}

function parseCSV(csvContent: string): FalRequest[] {
  const lines = csvContent.split('\n')
  const requests: FalRequest[] = []
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    
    // Parse CSV with quoted fields
    const matches = line.match(/"([^"]*)"/g)
    if (!matches || matches.length < 7) continue
    
    const playgroundUrl = matches[0].replace(/"/g, '')
    const modelName = matches[2].replace(/"/g, '')
    const timeAgo = matches[3].replace(/"/g, '')
    const duration = matches[4].replace(/"/g, '')
    const status = matches[5].replace(/"/g, '')
    const requestId = matches[6].replace(/"/g, '')
    
    // Déterminer le type de modèle et l'endpoint pour récupérer le résultat
    // Note: Pour GET result, on utilise le model_id de BASE sans subpath
    let model = ''
    let modelEndpoint = ''
    
    if (modelName.includes('veo3.1')) {
      model = 'veo3.1'
      modelEndpoint = 'fal-ai/veo3.1'  // Sans /fast/image-to-video
    } else if (modelName.includes('ChatterboxHD') || modelName.includes('speech-to-speech')) {
      model = 'chatterbox'
      modelEndpoint = 'resemble-ai/chatterboxhd'  // Sans /speech-to-speech
    } else if (modelName.includes('elevenlabs')) {
      model = 'elevenlabs'
      modelEndpoint = 'fal-ai/elevenlabs'  // Sans /sound-effects/v2
    } else if (modelName.includes('whisper')) {
      model = 'whisper'
      modelEndpoint = 'fal-ai/whisper'
    } else if (modelName.includes('nano-banana')) {
      model = 'nano-banana'
      modelEndpoint = 'fal-ai/nano-banana-pro'  // Sans /edit
    } else {
      continue // Skip unknown models
    }
    
    requests.push({
      requestId,
      model,
      modelEndpoint,
      playgroundUrl,
      timeAgo,
      duration,
      status,
    })
  }
  
  return requests
}

async function getFalResultUrl(requestId: string, modelEndpoint: string, model: string): Promise<string | null> {
  if (!FAL_KEY) throw new Error('FAL_KEY not configured')
  
  try {
    const url = `https://queue.fal.run/${modelEndpoint}/requests/${requestId}`
    console.log(`[FAL] GET ${url}`)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
      },
    })
    
    if (!response.ok) {
      const text = await response.text()
      console.error(`[FAL] Error ${response.status} for ${requestId}: ${text}`)
      return null
    }
    
    const result = await response.json()
    
    // Extraire l'URL selon le type
    if (model === 'veo3.1') {
      return result.video?.url || null
    } else if (model === 'chatterbox' || model === 'elevenlabs') {
      return result.audio?.url || null
    } else if (model === 'nano-banana') {
      return result.images?.[0]?.url || null
    } else if (model === 'whisper') {
      // Whisper retourne du texte, pas une URL
      return result.text ? `[TRANSCRIPTION] ${result.text.slice(0, 100)}` : null
    }
    
    return null
  } catch (error) {
    console.error(`[FAL] Failed to fetch ${requestId}:`, error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key') || new URL(request.url).searchParams.get('key')
    if (adminKey !== ADMIN_KEY) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    
    const fetchUrls = new URL(request.url).searchParams.get('fetch') === 'true'
    const limitParam = new URL(request.url).searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam) : 5
    
    // Lire le fichier CSV
    const csvPath = path.join(process.cwd(), 'fal.csv')
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ error: 'Fichier fal.csv non trouvé' }, { status: 404 })
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    const requests = parseCSV(csvContent)
    
    // Stats par modèle
    const stats = {
      total: requests.length,
      byModel: {
        'veo3.1': requests.filter(r => r.model === 'veo3.1').length,
        'chatterbox': requests.filter(r => r.model === 'chatterbox').length,
        'elevenlabs': requests.filter(r => r.model === 'elevenlabs').length,
        'whisper': requests.filter(r => r.model === 'whisper').length,
        'nano-banana': requests.filter(r => r.model === 'nano-banana').length,
      },
      sample: requests.slice(0, 3),
      fetchedResults: [] as FalResult[],
    }
    
    // Optionnel: récupérer les URLs pour un échantillon
    if (fetchUrls) {
      const sampleRequests = requests
        .filter(r => r.model === 'veo3.1' || r.model === 'chatterbox' || r.model === 'elevenlabs')
        .slice(0, limit)
      
      for (const req of sampleRequests) {
        const url = await getFalResultUrl(req.requestId, req.modelEndpoint, req.model)
        stats.fetchedResults.push({
          requestId: req.requestId,
          model: req.model,
          url,
        })
        // Petit délai pour éviter rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    return NextResponse.json(stats)
    
  } catch (error) {
    console.error('[Import FAL] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key') || new URL(request.url).searchParams.get('key')
    if (adminKey !== ADMIN_KEY) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    
    const body = await request.json().catch(() => ({}))
    const { model: filterModel, limit = 100, compareDb = false } = body
    
    // Lire le fichier CSV
    const csvPath = path.join(process.cwd(), 'fal.csv')
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    let requests = parseCSV(csvContent)
    
    // Filtrer par modèle si spécifié
    if (filterModel) {
      requests = requests.filter(r => r.model === filterModel)
    } else {
      // Par défaut, seulement les modèles qui produisent des assets
      requests = requests.filter(r => ['veo3.1', 'chatterbox', 'elevenlabs'].includes(r.model))
    }
    
    // Limiter
    requests = requests.slice(0, limit)
    
    console.log(`[Import FAL] Processing ${requests.length} requests...`)
    
    const results: FalResult[] = []
    
    for (const req of requests) {
      const url = await getFalResultUrl(req.requestId, req.modelEndpoint, req.model)
      results.push({
        requestId: req.requestId,
        model: req.model,
        url,
      })
      
      // Petit délai
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    const succeeded = results.filter(r => r.url).length
    const failed = results.filter(r => !r.url).length
    
    // Optionnel: comparer avec la DB
    let dbComparison = null
    if (compareDb) {
      const supabase = await createServiceClient()
      
      // Récupérer toutes les URLs FAL de la DB
      const { data: clips } = await supabase
        .from('campaign_clips')
        .select('id, video, audio, first_frame')
      
      const dbUrls = new Set<string>()
      clips?.forEach((clip: any) => {
        if (clip.video?.raw_url) dbUrls.add(clip.video.raw_url)
        if (clip.video?.final_url) dbUrls.add(clip.video.final_url)
        if (clip.audio?.transformed_voice_url) dbUrls.add(clip.audio.transformed_voice_url)
        if (clip.audio?.ambient_url) dbUrls.add(clip.audio.ambient_url)
        if (clip.first_frame?.image_url) dbUrls.add(clip.first_frame.image_url)
      })
      
      const inDb = results.filter(r => r.url && dbUrls.has(r.url))
      const notInDb = results.filter(r => r.url && !dbUrls.has(r.url))
      
      dbComparison = {
        totalDbUrls: dbUrls.size,
        matchedInDb: inDb.length,
        orphans: notInDb.length,
        orphansList: notInDb.map(r => ({
          requestId: r.requestId,
          model: r.model,
          url: r.url,
        })),
      }
    }
    
    return NextResponse.json({
      total: results.length,
      succeeded,
      failed,
      results: results.slice(0, 20), // Limiter l'output
      dbComparison,
    })
    
  } catch (error) {
    console.error('[Import FAL] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur' },
      { status: 500 }
    )
  }
}
