// Higgsfield SOUL API Client
// Used for generating consistent AI actors
// Docs: https://docs.higgsfield.ai/guides/images

const HIGGSFIELD_API_URL = 'https://platform.higgsfield.ai'
const API_KEY_ID = process.env.HIGGSFIELD_API_KEY_ID!
const API_KEY_SECRET = process.env.HIGGSFIELD_API_KEY_SECRET!

interface HiggsFieldRequestOptions {
  model: string  // e.g. 'higgsfield-ai/soul/standard'
  body: Record<string, unknown>
}

interface HiggsFieldQueueResponse {
  request_id: string
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  response_url?: string
  status_url?: string
}

interface HiggsFieldStatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  response_url?: string
}

interface HiggsFieldImageResult {
  images: Array<{ url: string; content_type: string }>
  timings?: Record<string, number>
  seed?: number
}

async function higgsFieldRequest<T>({ model, body }: HiggsFieldRequestOptions): Promise<T> {
  const auth = `${API_KEY_ID}:${API_KEY_SECRET}`
  
  console.log(`[Higgsfield] POST ${HIGGSFIELD_API_URL}/${model}`)
  console.log(`[Higgsfield] Body:`, JSON.stringify(body, null, 2))
  console.log(`[Higgsfield] Auth key starts with:`, API_KEY_ID?.slice(0, 8) + '...')
  
  const response = await fetch(`${HIGGSFIELD_API_URL}/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const responseText = await response.text()
  console.log(`[Higgsfield] Response ${response.status}:`, responseText.slice(0, 500))

  if (!response.ok) {
    throw new Error(`Higgsfield error (${response.status}): ${responseText}`)
  }

  try {
    return JSON.parse(responseText)
  } catch {
    throw new Error(`Invalid JSON response: ${responseText}`)
  }
}

// Poll for completion
async function pollHiggsfield<T>(
  statusUrl: string,
  responseUrl: string,
  maxAttempts = 60,
  intervalMs = 3000
): Promise<T> {
  const auth = `${API_KEY_ID}:${API_KEY_SECRET}`
  
  for (let i = 0; i < maxAttempts; i++) {
    const statusResponse = await fetch(statusUrl, {
      headers: { 'Authorization': `Key ${auth}` },
    })
    
    if (!statusResponse.ok) {
      throw new Error(`Status check failed: ${await statusResponse.text()}`)
    }
    
    const status = await statusResponse.json() as HiggsFieldStatusResponse
    console.log(`[Higgsfield] Status: ${status.status}`)
    
    if (status.status === 'COMPLETED') {
      const resultResponse = await fetch(responseUrl, {
        headers: { 'Authorization': `Key ${auth}` },
      })
      return resultResponse.json()
    }
    
    if (status.status === 'FAILED') {
      throw new Error('Higgsfield generation failed')
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  
  throw new Error('Timeout waiting for Higgsfield generation')
}

// ─────────────────────────────────────────────────────────────────
// SOUL ACTOR GENERATION
// Model: higgsfield-ai/soul/standard
// ─────────────────────────────────────────────────────────────────

export interface SoulGenerateInput {
  prompt: string
  aspect_ratio?: '9:16' | '16:9' | '1:1' | '4:3' | '3:4'
  resolution?: '480p' | '720p' | '1080p'
}

export interface SoulGenerateResult {
  image_url: string
  request_id: string
}

/**
 * Génère une image d'acteur Soul via Higgsfield
 * @param prompt Description détaillée du personnage à générer
 * @param aspectRatio Format de l'image (défaut: 9:16 portrait)
 * @returns URL de l'image générée + request_id
 */
export async function generateSoulImage(
  prompt: string,
  aspectRatio: '9:16' | '16:9' | '1:1' = '9:16'
): Promise<SoulGenerateResult> {
  console.log('[Higgsfield Soul] Generating actor image:', prompt.slice(0, 100) + '...')
  
  const queueResponse = await higgsFieldRequest<HiggsFieldQueueResponse>({
    model: 'higgsfield-ai/soul/standard',
    body: {
      prompt,
      aspect_ratio: aspectRatio,
      resolution: '720p',
    },
  })
  
  console.log('[Higgsfield Soul] Queued:', queueResponse.request_id)
  
  // Si on a une réponse directe (synchrone)
  if ('images' in queueResponse) {
    const result = queueResponse as unknown as HiggsFieldImageResult
    return {
      image_url: result.images[0].url,
      request_id: queueResponse.request_id,
    }
  }
  
  // Sinon, poll pour le résultat
  if (queueResponse.status_url && queueResponse.response_url) {
    const result = await pollHiggsfield<HiggsFieldImageResult>(
      queueResponse.status_url,
      queueResponse.response_url
    )
    
    if (!result.images?.[0]?.url) {
      throw new Error('No image in Higgsfield response')
    }
    
    return {
      image_url: result.images[0].url,
      request_id: queueResponse.request_id,
    }
  }
  
  throw new Error('Unexpected Higgsfield response format')
}

// ─────────────────────────────────────────────────────────────────
// HELPER - Build optimized SOUL prompt for UGC actors
// Style: Authentic selfie UGC (like Luna reference)
// Preset: TOUJOURS utiliser "0.5 selfie" sur Higgsfield
// ─────────────────────────────────────────────────────────────────

export interface ActorDescription {
  name: string
  gender: 'male' | 'female' | 'non-binary'
  age_range: string       // e.g. "24-28"
  ethnicity: string       // e.g. "European", "Asian", "African", "Latin American"
  hair: string            // e.g. "long blonde straight", "short black curly"
  distinctive_features: string  // e.g. "bright blue eyes, warm smile"
  location?: string       // e.g. "bedroom", "living room", "kitchen"
  style?: string          // e.g. "casual", "trendy", "elegant"
}

/**
 * Construit un prompt optimisé pour générer un acteur UGC style selfie authentique
 * 
 * IMPORTANT: Sur Higgsfield, utiliser TOUJOURS le preset "0.5 selfie"
 * 
 * Style de référence: Luna (selfie chambre, golden hour, casual)
 * @see docs/CRITICAL_BEHAVIORS.md section 13
 */
export function buildActorPrompt(actor: ActorDescription): string {
  const genderLabel = actor.gender === 'male' ? 'man' : actor.gender === 'female' ? 'woman' : 'person'
  const location = actor.location || 'bedroom'
  
  // Mapping location -> description naturelle
  const locationDescriptions: Record<string, string> = {
    bedroom: 'in her bedroom, sitting on bed with white sheets, cozy bedroom background with mirror and plants',
    living_room: 'in her apartment living room, cozy modern interior with couch and plants',
    kitchen: 'in bright kitchen, modern kitchen background',
    bathroom: 'in bathroom, mirror selfie style',
    car: 'in car interior, sitting in driver seat',
  }
  
  const locationDesc = locationDescriptions[location] || locationDescriptions.bedroom
  
  const parts = [
    // Base: selfie authentique UGC
    `Young ${genderLabel} taking a selfie ${locationDesc}`,
    // Physical features
    `${actor.hair} hair`,
    actor.ethnicity ? `${actor.ethnicity} features` : null,
    actor.distinctive_features,
    // Lighting: naturel, golden hour
    'natural golden hour lighting from window',
    // Clothing: casual
    actor.style ? `wearing casual ${actor.style} outfit` : 'wearing casual everyday clothes',
    // Pose: selfie authentique
    'arm extended holding phone',
    'looking at camera with confident natural expression',
    // Style: UGC TikTok
    'authentic UGC TikTok style',
    'photorealistic, natural skin',
    // NO studio look
    'no studio lighting, no professional setup',
  ]
  
  return parts.filter(Boolean).join(', ')
}

// ─────────────────────────────────────────────────────────────────
// PRESET ACTORS (for demo/MVP)
// ─────────────────────────────────────────────────────────────────

export interface PresetActor {
  id: string
  name: string
  soul_image_url: string
  thumbnail_video_url: string
  appearance: {
    gender: 'male' | 'female' | 'non-binary'
    age_range: string
    ethnicity: string
    hair: string
    distinctive_features: string
  }
  voice_reference_url: string
}

// These would be pre-generated actors stored in Supabase
// Placeholder URLs - to be replaced with actual generated actors
export const PRESET_ACTORS: PresetActor[] = [
  {
    id: 'preset-luna',
    name: 'Luna',
    soul_image_url: '/actors/luna-soul.jpg',
    thumbnail_video_url: '/actors/luna-preview.mp4',
    appearance: {
      gender: 'female',
      age_range: '25-30',
      ethnicity: 'European',
      hair: 'long brown wavy',
      distinctive_features: 'warm smile, freckles',
    },
    voice_reference_url: '/voices/luna-reference.mp3',
  },
  {
    id: 'preset-marc',
    name: 'Marc',
    soul_image_url: '/actors/marc-soul.jpg',
    thumbnail_video_url: '/actors/marc-preview.mp4',
    appearance: {
      gender: 'male',
      age_range: '28-35',
      ethnicity: 'Mediterranean',
      hair: 'short dark',
      distinctive_features: 'defined jawline, stubble',
    },
    voice_reference_url: '/voices/marc-reference.mp3',
  },
  {
    id: 'preset-jade',
    name: 'Jade',
    soul_image_url: '/actors/jade-soul.jpg',
    thumbnail_video_url: '/actors/jade-preview.mp4',
    appearance: {
      gender: 'female',
      age_range: '22-28',
      ethnicity: 'Asian',
      hair: 'medium black straight',
      distinctive_features: 'bright eyes, youthful',
    },
    voice_reference_url: '/voices/jade-reference.mp3',
  },
  {
    id: 'preset-alex',
    name: 'Alex',
    soul_image_url: '/actors/alex-soul.jpg',
    thumbnail_video_url: '/actors/alex-preview.mp4',
    appearance: {
      gender: 'male',
      age_range: '30-38',
      ethnicity: 'African',
      hair: 'short fade',
      distinctive_features: 'confident expression, well-groomed',
    },
    voice_reference_url: '/voices/alex-reference.mp3',
  },
]

