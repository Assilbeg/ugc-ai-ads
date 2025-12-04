// ═══════════════════════════════════════════════════════════════
// UTILITAIRES VIDÉO - Calculs de durée
// ═══════════════════════════════════════════════════════════════

/**
 * Calcule la nouvelle durée après ajustements (trim + speed)
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




