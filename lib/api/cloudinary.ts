// ═══════════════════════════════════════════════════════════════
// CLOUDINARY API - Video Transformations (Trim + Speed)
// ═══════════════════════════════════════════════════════════════

import { v2 as cloudinary } from 'cloudinary'

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export interface VideoTransformOptions {
  trimStart?: number  // Secondes depuis le début
  trimEnd?: number    // Secondes depuis le début (fin du clip)
  speed?: number      // 0.8, 0.9, 1.0, 1.1, 1.2
}

/**
 * Upload une vidéo depuis une URL vers Cloudinary
 * @param videoUrl URL de la vidéo source
 * @param folder Dossier de destination (optionnel)
 * @returns public_id de la vidéo uploadée
 */
export async function uploadVideoToCloudinary(
  videoUrl: string,
  folder: string = 'ugc-clips'
): Promise<{ publicId: string; url: string }> {
  try {
    const result = await cloudinary.uploader.upload(videoUrl, {
      resource_type: 'video',
      folder,
      // Génère un ID unique
      public_id: `clip_${Date.now()}`,
    })

    console.log('[Cloudinary] Video uploaded:', result.public_id)
    
    return {
      publicId: result.public_id,
      url: result.secure_url,
    }
  } catch (error) {
    console.error('[Cloudinary] Upload error:', error)
    throw new Error('Erreur upload Cloudinary')
  }
}

/**
 * Génère une URL Cloudinary avec transformations (trim + vitesse)
 * Les transformations sont appliquées à la volée, pas de processing requis
 * 
 * @param publicId Public ID de la vidéo sur Cloudinary
 * @param options Options de transformation
 * @returns URL avec transformations
 */
export function getTransformedVideoUrl(
  publicId: string,
  options: VideoTransformOptions
): string {
  const transformations: string[] = []

  // Trim : so_ (start offset) et eo_ (end offset)
  if (options.trimStart !== undefined && options.trimStart > 0) {
    transformations.push(`so_${options.trimStart}`)
  }
  if (options.trimEnd !== undefined) {
    transformations.push(`eo_${options.trimEnd}`)
  }

  // Vitesse : e_accelerate:N où N est le pourcentage
  // 1.2x = +20%, 0.8x = -20%
  if (options.speed !== undefined && options.speed !== 1.0) {
    const acceleratePercent = Math.round((options.speed - 1) * 100)
    transformations.push(`e_accelerate:${acceleratePercent}`)
  }

  // Construire l'URL
  const transformString = transformations.length > 0 
    ? transformations.join(',') + '/'
    : ''

  // URL format: https://res.cloudinary.com/{cloud_name}/video/upload/{transformations}/{public_id}.mp4
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  return `https://res.cloudinary.com/${cloudName}/video/upload/${transformString}${publicId}.mp4`
}

/**
 * Génère une URL de prévisualisation avec transformations
 * Identique à getTransformedVideoUrl mais pour preview côté client
 */
export function buildPreviewUrl(
  cloudinaryUrl: string,
  options: VideoTransformOptions
): string {
  // Extraire le cloud_name et public_id de l'URL existante
  // Format: https://res.cloudinary.com/{cloud_name}/video/upload/{public_id}.mp4
  const match = cloudinaryUrl.match(/cloudinary\.com\/([^/]+)\/video\/upload\/(.+)$/)
  
  if (!match) {
    console.warn('[Cloudinary] Invalid URL format:', cloudinaryUrl)
    return cloudinaryUrl
  }

  const [, cloudName, pathWithExtension] = match
  // Retirer l'extension et les transformations existantes
  const publicId = pathWithExtension.replace(/\.[^.]+$/, '').split('/').pop()

  const transformations: string[] = []

  if (options.trimStart !== undefined && options.trimStart > 0) {
    transformations.push(`so_${options.trimStart.toFixed(1)}`)
  }
  if (options.trimEnd !== undefined) {
    transformations.push(`eo_${options.trimEnd.toFixed(1)}`)
  }
  if (options.speed !== undefined && options.speed !== 1.0) {
    const acceleratePercent = Math.round((options.speed - 1) * 100)
    transformations.push(`e_accelerate:${acceleratePercent}`)
  }

  const transformString = transformations.length > 0 
    ? transformations.join(',') + '/'
    : ''

  return `https://res.cloudinary.com/${cloudName}/video/upload/${transformString}${publicId}.mp4`
}

/**
 * Calcule la nouvelle durée après ajustements
 */
export function calculateAdjustedDuration(
  originalDuration: number,
  trimStart: number,
  trimEnd: number,
  speed: number
): number {
  const trimmedDuration = trimEnd - trimStart
  return trimmedDuration / speed
}

