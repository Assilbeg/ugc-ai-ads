// ═══════════════════════════════════════════════════════════════
// CLOUDINARY - Video Transformations (Trim + Speed)
// Client-safe: pas d'import du SDK Node.js ici
// L'upload se fait via l'API route /api/cloudinary/upload
// ═══════════════════════════════════════════════════════════════

export interface VideoTransformOptions {
  trimStart?: number  // Secondes depuis le début
  trimEnd?: number    // Secondes depuis le début (fin du clip)
  speed?: number      // 0.8, 0.9, 1.0, 1.1, 1.2
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
  // ou: https://res.cloudinary.com/{cloud_name}/video/upload/{folder}/{public_id}.mp4
  const match = cloudinaryUrl.match(/cloudinary\.com\/([^/]+)\/video\/upload\/(.+)$/)
  
  if (!match) {
    console.warn('[Cloudinary] Invalid URL format:', cloudinaryUrl)
    return cloudinaryUrl
  }

  const [, cloudName, pathWithExtension] = match
  // Retirer SEULEMENT l'extension, garder le chemin complet (dossier inclus)
  const publicId = pathWithExtension.replace(/\.[^.]+$/, '')

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

