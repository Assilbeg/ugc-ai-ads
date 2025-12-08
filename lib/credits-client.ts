// Client-side credits utilities (can be imported in client components)

// Format en euros (legacy)
export function formatCredits(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

// Format en crédits (user-facing)
export function formatAsCredits(credits: number): string {
  const formatted = new Intl.NumberFormat('fr-FR').format(credits)
  return `${formatted} crédit${credits !== 1 ? 's' : ''}`
}

// Coûts par défaut (utilisés côté client quand on n'a pas accès à la BDD)
// Ces valeurs sont mises à jour dynamiquement via l'API
export const DEFAULT_GENERATION_COSTS = {
  first_frame: 25,
  video_veo31_fast: 25, // par seconde
  video_veo31_standard: 60, // par seconde
  voice_chatterbox: 20,
  ambient_elevenlabs: 15,
}

const DEFAULT_VIDEO_DURATION = 6 // secondes
const DEFAULT_CLIP_COUNT = 5

// Estimer le nombre de vidéos à partir des crédits (côté client)
export function estimateVideosFromCreditsSync(
  credits: number,
  costs: Record<string, number> = DEFAULT_GENERATION_COSTS,
  clipCount: number = DEFAULT_CLIP_COUNT
): number {
  const videoCost = costs.video_veo31_fast || costs.video_veo31_standard || 25
  const costPerClip = 
    (costs.first_frame || 25) + 
    (videoCost * DEFAULT_VIDEO_DURATION) + 
    (costs.voice_chatterbox || 20) + 
    (costs.ambient_elevenlabs || 15)
  
  const costPerCampaign = costPerClip * clipCount
  
  return Math.floor(credits / costPerCampaign)
}

// Coût par vidéo complète (côté client)
export function getCostPerVideoSync(
  costs: Record<string, number> = DEFAULT_GENERATION_COSTS,
  clipCount: number = DEFAULT_CLIP_COUNT
): number {
  const videoCost = costs.video_veo31_fast || costs.video_veo31_standard || 25
  const costPerClip = 
    (costs.first_frame || 25) + 
    (videoCost * DEFAULT_VIDEO_DURATION) + 
    (costs.voice_chatterbox || 20) + 
    (costs.ambient_elevenlabs || 15)
  
  return costPerClip * clipCount
}





