// Fal.ai API Client
// Handles: NanoBanana Pro (first frames), Veo 3.1, Chatterbox HD, ElevenLabs v2

const FAL_API_URL = 'https://queue.fal.run'

interface FalRequestOptions {
  path: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any
}

interface FalQueueResponse {
  request_id: string
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  response_url: string
  status_url: string
}

interface FalStatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  response_url?: string
  logs?: Array<{ message: string; timestamp: string }>
}

// Helper to make Fal.ai requests
async function falRequest<T>({ path, input }: FalRequestOptions): Promise<T> {
  const FAL_KEY = process.env.FAL_KEY
  
  if (!FAL_KEY) {
    throw new Error('FAL_KEY non configurée dans .env.local')
  }

  console.log(`[Fal.ai] POST ${FAL_API_URL}/${path}`)
  
  const response = await fetch(`${FAL_API_URL}/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error(`[Fal.ai] Error ${response.status}:`, error)
    throw new Error(`Fal.ai error (${response.status}): ${error}`)
  }

  const result = await response.json()
  console.log(`[Fal.ai] Queue response:`, result)
  return result
}

// Check status of a queued request (using the status_url from queue response)
async function checkStatusByUrl(statusUrl: string): Promise<FalStatusResponse> {
  const FAL_KEY = process.env.FAL_KEY!
  
  console.log(`[Fal.ai] Checking status: ${statusUrl}`)
  
  const response = await fetch(statusUrl, {
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error(`[Fal.ai] Status check failed (${response.status}):`, error)
    throw new Error(`Failed to check status (${response.status}): ${error}`)
  }

  const result = await response.json()
  console.log(`[Fal.ai] Status:`, result.status)
  return result
}

// Get result of a completed request (using the response_url from queue response)
async function getResultByUrl<T>(responseUrl: string): Promise<T> {
  const FAL_KEY = process.env.FAL_KEY!
  
  console.log(`[Fal.ai] Getting result: ${responseUrl}`)
  
  const response = await fetch(responseUrl, {
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error(`[Fal.ai] Get result failed (${response.status}):`, error)
    throw new Error(`Failed to get result (${response.status}): ${error}`)
  }

  return response.json()
}

// Poll until completion using URLs from queue response
async function pollUntilCompleteWithUrls<T>(
  statusUrl: string,
  responseUrl: string,
  maxAttempts = 120,
  intervalMs = 5000
): Promise<T> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await checkStatusByUrl(statusUrl)
    
    if (status.status === 'COMPLETED') {
      return getResultByUrl<T>(responseUrl)
    }
    
    if (status.status === 'FAILED') {
      throw new Error('Generation failed')
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  
  throw new Error('Timeout waiting for generation')
}

// ─────────────────────────────────────────────────────────────────
// NANO BANANA PRO - Image-to-Image with Character Consistency
// Docs: https://fal.ai/models/fal-ai/nano-banana-pro/edit
// ─────────────────────────────────────────────────────────────────

export async function generateFirstFrame(
  soulImageUrl: string,
  prompt: string // Full prompt (template already applied by API route)
): Promise<string> {
  const FAL_KEY = process.env.FAL_KEY
  
  if (!FAL_KEY) {
    throw new Error('FAL_KEY non configurée dans .env.local')
  }

  console.log('[NanoBanana Pro] Generating first frame:', { 
    soulImageUrl: soulImageUrl.slice(0, 80),
    prompt: prompt.slice(0, 150) + '...' 
  })

  // Using Nano Banana Pro edit endpoint (synchronous)
  // Docs: https://fal.ai/models/fal-ai/nano-banana-pro/edit
  const response = await fetch('https://fal.run/fal-ai/nano-banana-pro/edit', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: prompt, // Full prompt from API route (template already applied)
      image_urls: [soulImageUrl], // Array of image URLs
      aspect_ratio: '9:16', // Vertical portrait
      num_images: 1,
      output_format: 'jpeg',
      resolution: '1K',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[NanoBanana Pro] Error:', response.status, error)
    throw new Error(`Génération image échouée (${response.status}): ${error}`)
  }

  const result = await response.json() as { 
    images: Array<{ url: string; file_name: string; content_type: string }> 
    description?: string
  }
  
  console.log('[NanoBanana Pro] Result:', {
    imagesCount: result.images?.length,
    firstUrl: result.images?.[0]?.url?.slice(0, 80),
    description: result.description
  })
  
  if (!result.images?.[0]?.url) {
    throw new Error('Pas d\'image générée par NanoBanana Pro')
  }
  
  return result.images[0].url
}

// ─────────────────────────────────────────────────────────────────
// VEO 3.1 - Video Generation (Image to Video)
// Docs: https://fal.ai/models/fal-ai/veo3.1/image-to-video
// Fast: https://fal.ai/models/fal-ai/veo3.1/fast/image-to-video
// ─────────────────────────────────────────────────────────────────

export type VideoQuality = 'standard' | 'fast'

interface Veo31Input {
  prompt: string
  image_url: string      // First frame (required for image-to-video)
  duration?: string      // "5s" | "6s" | "8s"
  aspect_ratio?: string  // "9:16" for vertical
}

interface Veo31Output {
  video: { url: string }
}

// Pricing per second (with audio):
// - Standard: $0.40/sec
// - Fast: $0.15/sec
export const VEO31_PRICING = {
  standard: { perSecond: 40, label: 'Standard (Qualité max)' },  // 40 cents/sec
  fast: { perSecond: 15, label: 'Fast (Économique)' },           // 15 cents/sec
} as const

export function getVeo31Endpoint(quality: VideoQuality): string {
  return quality === 'fast' 
    ? 'fal-ai/veo3.1/fast/image-to-video'
    : 'fal-ai/veo3.1/image-to-video'
}

export async function generateVideoVeo31(
  prompt: string,
  firstFrameUrl: string,
  duration: 4 | 6 | 8 = 6,
  quality: VideoQuality = 'standard'
): Promise<string> {
  const path = getVeo31Endpoint(quality)
  
  const input: Veo31Input = {
    prompt,
    image_url: firstFrameUrl,
    duration: `${duration}s`,
    aspect_ratio: '9:16',
  }

  console.log(`[Veo3.1 ${quality.toUpperCase()}] Generating video:`, { 
    duration, 
    quality,
    endpoint: path,
    firstFrameUrl: firstFrameUrl?.slice(0, 80),
    prompt: prompt.slice(0, 100) + '...' 
  })

  if (!firstFrameUrl) {
    throw new Error('First frame URL is required for Veo3.1 image-to-video')
  }

  const queue = await falRequest<FalQueueResponse>({ path, input })
  const result = await pollUntilCompleteWithUrls<Veo31Output>(
    queue.status_url, 
    queue.response_url, 
    180, 
    10000
  )
  
  console.log(`[Veo3.1 ${quality.toUpperCase()}] Video generated:`, result.video?.url?.slice(0, 80))
  
  return result.video.url
}

// ─────────────────────────────────────────────────────────────────
// CHATTERBOX HD - Speech-to-Speech Voice Conversion
// Docs: https://fal.ai/models/resemble-ai/chatterboxhd/speech-to-speech
// ─────────────────────────────────────────────────────────────────
interface ChatterboxS2SInput {
  source_audio_url: string        // Audio extrait de la vidéo Veo3
  target_voice_audio_url?: string // Voix de référence de l'acteur
  high_quality_audio?: boolean    // true = 48kHz, false = 24kHz
}

interface ChatterboxS2SOutput {
  audio: { url: string }
}

export async function speechToSpeech(
  sourceAudioUrl: string,
  targetVoiceUrl: string
): Promise<string> {
  const path = 'resemble-ai/chatterboxhd/speech-to-speech'
  
  const input: ChatterboxS2SInput = {
    source_audio_url: sourceAudioUrl,
    target_voice_audio_url: targetVoiceUrl,
    high_quality_audio: true,
  }

  console.log('[Chatterbox S2S] Converting voice:', { 
    source: sourceAudioUrl.slice(0, 50) + '...',
    target: targetVoiceUrl.slice(0, 50) + '...'
  })

  const queue = await falRequest<FalQueueResponse>({ path, input })
  const result = await pollUntilCompleteWithUrls<ChatterboxS2SOutput>(queue.status_url, queue.response_url, 120, 5000)
  
  return result.audio.url
}

// ─────────────────────────────────────────────────────────────────
// ELEVENLABS v2 - Sound Effects / Ambient Audio
// Docs: https://fal.ai/models/fal-ai/elevenlabs/sound-effects/v2
// ─────────────────────────────────────────────────────────────────
interface ElevenLabsSFXInput {
  text: string
  duration_seconds?: number
  prompt_influence?: number  // 0-1, default 0.3
  output_format?: string     // default "mp3_44100_128"
}

interface ElevenLabsSFXOutput {
  audio: { url: string }
}

export async function generateAmbientAudio(
  description: string,
  durationSeconds: number = 10
): Promise<string> {
  const path = 'fal-ai/elevenlabs/sound-effects/v2'
  
  const input: ElevenLabsSFXInput = {
    text: description,
    duration_seconds: Math.min(durationSeconds, 22), // Max 22s selon la doc
    prompt_influence: 0.5, // Équilibre entre fidélité au prompt et variation
  }

  console.log('[ElevenLabs v2] Generating ambient audio:', { 
    description: description.slice(0, 50) + '...',
    duration: durationSeconds 
  })

  const queue = await falRequest<FalQueueResponse>({ path, input })
  const result = await pollUntilCompleteWithUrls<ElevenLabsSFXOutput>(queue.status_url, queue.response_url, 60, 3000)
  
  console.log('[ElevenLabs v2] Audio generated:', result.audio?.url?.slice(0, 80))
  
  return result.audio.url
}

// ─────────────────────────────────────────────────────────────────
// HELPER - Generate video (Veo3.1 uniquement)
// ─────────────────────────────────────────────────────────────────
export async function generateVideo(
  prompt: string,
  firstFrameUrl: string,
  _engine: 'veo3.1', // On garde le paramètre pour compatibilité mais on force Veo3.1
  duration: number,
  quality: VideoQuality = 'standard'
): Promise<string> {
  // Utiliser Veo3.1 avec la qualité choisie
  return generateVideoVeo31(prompt, firstFrameUrl, duration as 4 | 6 | 8, quality)
}
