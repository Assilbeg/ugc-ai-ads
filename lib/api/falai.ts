// Fal.ai API Client
// Handles: NanoBanana Pro (first frames), Veo 3.1, Kling, Chatterbox, ElevenLabs

const FAL_API_URL = 'https://queue.fal.run'

interface FalRequestOptions {
  path: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any
}

interface FalQueueResponse {
  request_id: string
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  response_url?: string
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

// Check status of a queued request
async function checkStatus(requestId: string, path: string): Promise<FalStatusResponse> {
  const FAL_KEY = process.env.FAL_KEY!
  
  const statusUrl = `${FAL_API_URL}/${path}/requests/${requestId}/status`
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

// Get result of a completed request
async function getResult<T>(requestId: string, path: string): Promise<T> {
  const FAL_KEY = process.env.FAL_KEY!
  
  const resultUrl = `${FAL_API_URL}/${path}/requests/${requestId}`
  console.log(`[Fal.ai] Getting result: ${resultUrl}`)
  
  const response = await fetch(resultUrl, {
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

// Poll until completion
async function pollUntilComplete<T>(
  requestId: string, 
  path: string,
  maxAttempts = 120,
  intervalMs = 5000
): Promise<T> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await checkStatus(requestId, path)
    
    if (status.status === 'COMPLETED') {
      return getResult<T>(requestId, path)
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
// VEO 3 - Video Generation
// ─────────────────────────────────────────────────────────────────
interface Veo3Input {
  prompt: string
  image_url?: string
  duration?: string
  aspect_ratio?: string
}

interface Veo3Output {
  video: { url: string }
}

export async function generateVideoVeo31(
  prompt: string,
  firstFrameUrl: string,
  duration: 4 | 6 | 8 = 6
): Promise<string> {
  const path = 'fal-ai/veo3'
  
  const input: Veo3Input = {
    prompt,
    image_url: firstFrameUrl,
    duration: `${duration}s`,
    aspect_ratio: '9:16',
  }

  console.log('Generating video with Veo3:', { duration, prompt: prompt.slice(0, 100) + '...' })

  const queue = await falRequest<FalQueueResponse>({ path, input })
  const result = await pollUntilComplete<Veo3Output>(queue.request_id, path, 180, 10000)
  
  return result.video.url
}

// ─────────────────────────────────────────────────────────────────
// KLING - Video Generation 
// ─────────────────────────────────────────────────────────────────
interface KlingInput {
  prompt: string
  image_url?: string
  duration?: string
  aspect_ratio?: string
}

interface KlingOutput {
  video: { url: string }
}

export async function generateVideoKling(
  prompt: string,
  firstFrameUrl: string,
  duration: 5 | 10 = 5
): Promise<string> {
  const path = 'fal-ai/kling-video/v1.5/pro/image-to-video'
  
  const input: KlingInput = {
    prompt,
    image_url: firstFrameUrl,
    duration: `${duration}`,
    aspect_ratio: '9:16',
  }

  console.log('Generating video with Kling:', { duration, prompt: prompt.slice(0, 100) + '...' })

  const queue = await falRequest<FalQueueResponse>({ path, input })
  const result = await pollUntilComplete<KlingOutput>(queue.request_id, path, 180, 10000)
  
  return result.video.url
}

// ─────────────────────────────────────────────────────────────────
// MINIMAX - Video Generation
// ─────────────────────────────────────────────────────────────────
interface MinimaxInput {
  prompt: string
  first_frame_image?: string
}

interface MinimaxOutput {
  video: { url: string }
}

export async function generateVideoMinimax(
  prompt: string,
  firstFrameUrl: string
): Promise<string> {
  const path = 'fal-ai/minimax/video-01-live/image-to-video'
  
  const input: MinimaxInput = {
    prompt,
    first_frame_image: firstFrameUrl,
  }

  console.log('Generating video with Minimax:', { prompt: prompt.slice(0, 100) + '...' })

  const queue = await falRequest<FalQueueResponse>({ path, input })
  const result = await pollUntilComplete<MinimaxOutput>(queue.request_id, path, 180, 10000)
  
  return result.video.url
}

// ─────────────────────────────────────────────────────────────────
// CHATTERBOX - Voice Cloning / TTS
// ─────────────────────────────────────────────────────────────────
interface ChatterboxInput {
  text: string
  audio_url: string
  exaggeration?: number
  cfg_weight?: number
}

interface ChatterboxOutput {
  audio_url: string
}

export async function cloneVoice(
  text: string,
  referenceVoiceUrl: string
): Promise<string> {
  const path = 'fal-ai/chatterbox/tts'
  
  const input: ChatterboxInput = {
    text,
    audio_url: referenceVoiceUrl,
    exaggeration: 0.5,
    cfg_weight: 0.5,
  }

  console.log('Cloning voice with Chatterbox:', { text: text.slice(0, 50) + '...' })

  const queue = await falRequest<FalQueueResponse>({ path, input })
  const result = await pollUntilComplete<ChatterboxOutput>(queue.request_id, path, 60, 3000)
  
  return result.audio_url
}

// ─────────────────────────────────────────────────────────────────
// ELEVENLABS - Sound Effects / Ambient Audio
// ─────────────────────────────────────────────────────────────────
interface ElevenLabsSFXInput {
  text: string
  duration_seconds?: number
}

interface ElevenLabsSFXOutput {
  audio: { url: string }
}

export async function generateAmbientAudio(
  description: string,
  durationSeconds: number = 10
): Promise<string> {
  const path = 'fal-ai/elevenlabs/sound-effects'
  
  const input: ElevenLabsSFXInput = {
    text: description,
    duration_seconds: durationSeconds,
  }

  console.log('Generating ambient audio:', { description: description.slice(0, 50) + '...' })

  const queue = await falRequest<FalQueueResponse>({ path, input })
  const result = await pollUntilComplete<ElevenLabsSFXOutput>(queue.request_id, path, 60, 3000)
  
  return result.audio.url
}

// ─────────────────────────────────────────────────────────────────
// HELPER - Generate video based on engine choice
// ─────────────────────────────────────────────────────────────────
export async function generateVideo(
  prompt: string,
  firstFrameUrl: string,
  engine: 'veo3.1' | 'sora2' | 'kling' | 'minimax',
  duration: number
): Promise<string> {
  switch (engine) {
    case 'veo3.1':
      return generateVideoVeo31(prompt, firstFrameUrl, duration as 4 | 6 | 8)
    case 'kling':
      return generateVideoKling(prompt, firstFrameUrl, duration <= 5 ? 5 : 10)
    case 'minimax':
      return generateVideoMinimax(prompt, firstFrameUrl)
    default:
      // Fallback to Kling
      return generateVideoKling(prompt, firstFrameUrl, duration <= 5 ? 5 : 10)
  }
}
