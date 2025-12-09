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

// ═══════════════════════════════════════════════════════════════
// COMPTAGE DE SYLLABES MULTILINGUE
// ═══════════════════════════════════════════════════════════════

/**
 * Compte les syllabes dans un texte (multilingue)
 * 
 * Approche universelle basée sur les groupes vocaliques.
 * Fonctionne pour : français, anglais, espagnol, portugais, 
 * italien, allemand, néerlandais et autres langues latines/germaniques.
 * 
 * Règles :
 * - Une voyelle ou groupe de voyelles = 1 syllabe
 * - Les diphtongues courantes comptent comme 1 syllabe
 * - Les "e" muets en fin de mot sont ajustés
 * - Minimum 1 syllabe par mot
 */
export function countSyllables(text: string): number {
  if (!text || typeof text !== 'string') return 0
  
  // Nettoyer le texte : retirer ponctuation, convertir en minuscules
  // Garder les caractères accentués de plusieurs langues
  const cleanText = text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\s'-]/gu, ' ')  // Unicode-aware: garde lettres et marques
    .trim()
  
  if (!cleanText) return 0
  
  // Voyelles universelles (incluant accentuées de plusieurs langues)
  // Français: àâäéèêëïîôùûüÿœæ
  // Espagnol: áéíóúüñ
  // Portugais: ãõ
  // Allemand: äöüß (ß est une consonne)
  // Italien: àèéìòù
  const vowelPattern = /[aeiouyàâäéèêëïîôùûüÿœæáíóúãõìò]/gi
  
  // Diphtongues courantes (multilingues) - comptent comme 1 syllabe
  // Français: ai, au, eau, eu, oi, ou, oui
  // Anglais: ea, ee, oo, ou, ow, oi, oy, ay, ey, ie
  // Espagnol: ai, au, ei, eu, ia, ie, io, iu, oi, ou, ua, ue, ui, uo
  // Allemand: au, äu, eu, ei, ie
  const diphtongPattern = /(?:eau|eaux|oeu|œu|aie|oie|oue|iou|ieu|iau|uoi|oui|ai|ei|oi|ui|au|ou|eu|œ|æ|ea|ee|oo|ow|oy|ay|ey|ie|ia|io|iu|ua|ue|uo|äu)/gi
  
  let totalSyllables = 0
  const words = cleanText.split(/\s+/)
  
  for (const word of words) {
    if (!word || word.length === 0) continue
    
    // Remplacer les diphtongues par un marqueur pour les compter comme 1
    const simplified = word.replace(diphtongPattern, 'V')
    
    // Compter les voyelles restantes + marqueurs de diphtongues (V)
    const vowelMatches = simplified.match(/[aeiouyàâäéèêëïîôùûüÿœæáíóúãõìòV]/gi)
    let syllableCount = vowelMatches ? vowelMatches.length : 0
    
    // Règle du "e" muet en fin de mot (français, anglais, allemand)
    // Ne pas compter si le mot finit par "e" non accentué ET a plus d'une syllabe
    // Exceptions : mots courts (le, de, je, etc.)
    if (word.length > 2 && word.endsWith('e') && syllableCount > 1) {
      // Vérifier que ce n'est pas un "e" accentué
      if (!word.match(/[éèêëế]$/)) {
        syllableCount--
      }
    }
    
    // Règle spéciale anglais : -ed final souvent muet sauf après t/d
    if (word.endsWith('ed') && syllableCount > 1) {
      const beforeEd = word.slice(-3, -2)
      if (beforeEd !== 't' && beforeEd !== 'd') {
        syllableCount--
      }
    }
    
    // Règle : -es final souvent muet en anglais/français (sauf après s, x, z, ch, sh)
    if (word.endsWith('es') && syllableCount > 1) {
      if (!word.match(/[sxz]es$/) && !word.match(/(ch|sh)es$/)) {
        syllableCount--
      }
    }
    
    // Règle : -le final en anglais forme souvent une syllabe (apple, table)
    // Mais on l'a déjà compté si précédé d'une consonne
    
    // Chaque mot a au minimum 1 syllabe
    totalSyllables += Math.max(syllableCount, 1)
  }
  
  return totalSyllables
}

/**
 * Calcule le débit en syllabes par seconde
 * Prend en compte les ajustements de trim et de vitesse actuels
 * 
 * @param text - Le texte du script (ce qui est prononcé)
 * @param trimStart - Début du trim en secondes
 * @param trimEnd - Fin du trim en secondes
 * @param speed - Facteur de vitesse (1.0, 1.1, 1.2)
 * @returns Le débit en syllabes/seconde
 */
export function calculateSyllablesPerSecond(
  text: string,
  trimStart: number,
  trimEnd: number,
  speed: number
): number {
  const syllables = countSyllables(text)
  const adjustedDuration = calculateAdjustedDuration(0, trimStart, trimEnd, speed)
  
  if (adjustedDuration <= 0 || syllables === 0) return 0
  
  // La vitesse accélère le débit : si speed = 1.2, le débit perçu est 1.2x plus rapide
  return (syllables / adjustedDuration) * speed
}







