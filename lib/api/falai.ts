// Fal.ai API Client
// Handles: NanoBanana (first frames), Veo 3.1, Sora 2, Chatterbox, ElevenLabs

const FAL_API_URL = 'https://queue.fal.run'
const FAL_KEY = process.env.FAL_KEY!

interface FalRequestOptions {
  path: string
  input: Record<string, unknown>
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
    throw new Error(`Fal.ai error: ${error}`)
  }

  return response.json()
}

// Check status of a queued request
async function checkStatus(requestId: string, path: string): Promise<FalStatusResponse> {
  const response = await fetch(`${FAL_API_URL}/${path}/requests/${requestId}/status`, {
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to check status')
  }

  return response.json()
}

// Get result of a completed request
async function getResult<T>(requestId: string, path: string): Promise<T> {
  const response = await fetch(`${FAL_API_URL}/${path}/requests/${requestId}`, {
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to get result')
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
// NANO BANANA PRO - First Frame Generation
// ─────────────────────────────────────────────────────────────────
interface NanoBananaInput {
  prompt: string
  image_url: string // SOUL actor reference image
  num_images?: number
  guidance_scale?: number
  num_inference_steps?: number
  seed?: number
}

interface NanoBananaOutput {
  images: Array<{ url: string }>
}

export async function generateFirstFrame(
  soulImageUrl: string,
  prompt: string,
  options?: Partial<NanoBananaInput>
): Promise<string> {
  const path = 'fal-ai/flux-pulid' // NanoBanana Pro model path
  
  const input: NanoBananaInput = {
    prompt: `UGC selfie video first frame. ${prompt}. Vertical 9:16 format, smartphone front camera, natural lighting, authentic look.`,
    image_url: soulImageUrl,
    num_images: 1,
    guidance_scale: 4,
    num_inference_steps: 30,
    ...options,
  }

  const queue = await falRequest<FalQueueResponse>({ path, input })
  const result = await pollUntilComplete<NanoBananaOutput>(queue.request_id, path)
  
  return result.images[0].url
}

// ─────────────────────────────────────────────────────────────────
// VEO 3.1 - Video Generation (for clips > 12s or multi-clip packs)
// ─────────────────────────────────────────────────────────────────
interface Veo31Input {
  prompt: string
  image_url?: string // First frame reference
  duration?: number // 4, 6, or 8 seconds
  aspect_ratio?: string
}

interface Veo31Output {
  video: { url: string }
}

export async function generateVideoVeo31(
  prompt: string,
  firstFrameUrl: string,
  duration: 4 | 6 | 8 = 6
): Promise<string> {
  const path = 'fal-ai/veo3' // Veo 3.1 model path on Fal.ai
  
  const input: Veo31Input = {
    prompt,
    image_url: firstFrameUrl,
    duration,
    aspect_ratio: '9:16',
  }

  const queue = await falRequest<FalQueueResponse>({ path, input })
  const result = await pollUntilComplete<Veo31Output>(queue.request_id, path, 180, 10000) // 30 min timeout for video
  
  return result.video.url
}

// ─────────────────────────────────────────────────────────────────
// SORA 2 - Video Generation (for single clips ≤ 12s)
// ─────────────────────────────────────────────────────────────────
interface Sora2Input {
  prompt: string
  image_url?: string
  duration?: number // 4, 8, or 12 seconds
  aspect_ratio?: string
}

interface Sora2Output {
  video: { url: string }
}

export async function generateVideoSora2(
  prompt: string,
  firstFrameUrl: string,
  duration: 4 | 8 | 12 = 8
): Promise<string> {
  const path = 'fal-ai/sora' // Sora 2 model path on Fal.ai
  
  const input: Sora2Input = {
    prompt,
    image_url: firstFrameUrl,
    duration,
    aspect_ratio: '9:16',
  }

  const queue = await falRequest<FalQueueResponse>({ path, input })
  const result = await pollUntilComplete<Sora2Output>(queue.request_id, path, 180, 10000)
  
  return result.video.url
}

// ─────────────────────────────────────────────────────────────────
// CHATTERBOX - Voice Cloning
// ─────────────────────────────────────────────────────────────────
interface ChatterboxInput {
  audio_url: string // Video audio to transform
  reference_audio_url: string // Voice reference sample
  text?: string // Optional: text for better sync
}

interface ChatterboxOutput {
  audio: { url: string }
}

export async function cloneVoice(
  videoAudioUrl: string,
  referenceVoiceUrl: string,
  text?: string
): Promise<string> {
  const path = 'fal-ai/chatterbox' // Chatterbox model path
  
  const input: ChatterboxInput = {
    audio_url: videoAudioUrl,
    reference_audio_url: referenceVoiceUrl,
    text,
  }

  const queue = await falRequest<FalQueueResponse>({ path, input })
  const result = await pollUntilComplete<ChatterboxOutput>(queue.request_id, path)
  
  return result.audio.url
}

// ─────────────────────────────────────────────────────────────────
// ELEVENLABS - Sound Effects / Ambient Audio
// ─────────────────────────────────────────────────────────────────
interface ElevenLabsSFXInput {
  text: string // Description of the sound effect
  duration_seconds?: number
}

interface ElevenLabsSFXOutput {
  audio: { url: string }
}

export async function generateAmbientAudio(
  description: string,
  durationSeconds: number = 10
): Promise<string> {
  const path = 'fal-ai/elevenlabs/sound-effects' // ElevenLabs SFX path
  
  const input: ElevenLabsSFXInput = {
    text: description,
    duration_seconds: durationSeconds,
  }

  const queue = await falRequest<FalQueueResponse>({ path, input })
  const result = await pollUntilComplete<ElevenLabsSFXOutput>(queue.request_id, path)
  
  return result.audio.url
}

// ─────────────────────────────────────────────────────────────────
// HELPER - Generate video based on engine choice
// ─────────────────────────────────────────────────────────────────
export async function generateVideo(
  prompt: string,
  firstFrameUrl: string,
  engine: 'veo3.1' | 'sora2',
  duration: number
): Promise<string> {
  if (engine === 'veo3.1') {
    return generateVideoVeo31(prompt, firstFrameUrl, duration as 4 | 6 | 8)
  } else {
    return generateVideoSora2(prompt, firstFrameUrl, duration as 4 | 8 | 12)
  }
}

