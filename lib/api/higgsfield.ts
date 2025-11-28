// Higgsfield SOUL API Client
// Used for generating consistent AI actors

const HIGGSFIELD_API_URL = 'https://api.higgsfield.ai/v1'
const API_KEY_ID = process.env.HIGGSFIELD_API_KEY_ID!
const API_KEY_SECRET = process.env.HIGGSFIELD_API_KEY_SECRET!

interface HiggsFieldRequestOptions {
  endpoint: string
  method: 'GET' | 'POST'
  body?: Record<string, unknown>
}

async function higgsFieldRequest<T>({ endpoint, method, body }: HiggsFieldRequestOptions): Promise<T> {
  const auth = Buffer.from(`${API_KEY_ID}:${API_KEY_SECRET}`).toString('base64')
  
  const response = await fetch(`${HIGGSFIELD_API_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Higgsfield error: ${error}`)
  }

  return response.json()
}

// ─────────────────────────────────────────────────────────────────
// SOUL ACTOR GENERATION
// ─────────────────────────────────────────────────────────────────

interface SoulGenerateInput {
  prompt: string
  gender?: 'male' | 'female'
  age_range?: string
  ethnicity?: string
  style?: string
}

interface SoulGenerateOutput {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  image_url?: string
  video_url?: string
}

export async function generateSoulActor(params: SoulGenerateInput): Promise<SoulGenerateOutput> {
  const prompt = buildSoulPrompt(params)
  
  return higgsFieldRequest<SoulGenerateOutput>({
    endpoint: '/soul/generate',
    method: 'POST',
    body: {
      prompt,
      output_format: 'image_and_video',
      video_duration: 3, // Short loop for preview
      aspect_ratio: '9:16',
    },
  })
}

export async function getSoulStatus(soulId: string): Promise<SoulGenerateOutput> {
  return higgsFieldRequest<SoulGenerateOutput>({
    endpoint: `/soul/${soulId}`,
    method: 'GET',
  })
}

// Poll until SOUL generation is complete
export async function waitForSoulGeneration(
  soulId: string,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<SoulGenerateOutput> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getSoulStatus(soulId)
    
    if (status.status === 'completed') {
      return status
    }
    
    if (status.status === 'failed') {
      throw new Error('SOUL generation failed')
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  
  throw new Error('Timeout waiting for SOUL generation')
}

// ─────────────────────────────────────────────────────────────────
// HELPER - Build optimized SOUL prompt
// ─────────────────────────────────────────────────────────────────

function buildSoulPrompt(params: SoulGenerateInput): string {
  const parts: string[] = []
  
  // Base description
  if (params.gender) {
    parts.push(params.gender === 'male' ? 'A man' : 'A woman')
  } else {
    parts.push('A person')
  }
  
  // Age
  if (params.age_range) {
    parts.push(`in their ${params.age_range}`)
  }
  
  // Ethnicity (optional, for diversity)
  if (params.ethnicity) {
    parts.push(`with ${params.ethnicity} features`)
  }
  
  // User's custom prompt
  if (params.prompt) {
    parts.push(params.prompt)
  }
  
  // UGC-specific additions
  parts.push('photorealistic, natural skin texture, authentic look')
  parts.push('suitable for UGC content creator, relatable appearance')
  parts.push('front-facing portrait, good for selfie videos')
  
  return parts.join(', ')
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

