import Anthropic from '@anthropic-ai/sdk'
import { IntentionPreset, CampaignBrief, CampaignClip, ScriptBeat, ExpressionType, VideoEngine, ProductConfig, Actor } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Expression mapping par beat
const BEAT_EXPRESSIONS: Record<ScriptBeat, ExpressionType> = {
  hook: 'curious',
  problem: 'frustrated',
  agitation: 'thoughtful',
  solution: 'relieved',
  proof: 'confident',
  cta: 'excited',
}

// Choix du moteur selon la durée et le format
function getVideoEngine(clipCount: number, duration: number): VideoEngine {
  // Pack multi-clips (≥2 clips assemblés) → Veo 3.1 obligatoire
  // Clip unique ≤ 12s → Sora 2 par défaut
  if (clipCount >= 2) return 'veo3.1'
  return duration > 12 ? 'veo3.1' : 'sora2'
}

interface GeneratePlanParams {
  actor: Actor
  preset: IntentionPreset
  brief: CampaignBrief
  product: ProductConfig
}

interface GeneratedPlan {
  clips: Omit<CampaignClip, 'id' | 'campaign_id' | 'created_at' | 'updated_at'>[]
}

export async function generateCampaignPlan({
  actor,
  preset,
  brief,
  product,
}: GeneratePlanParams): Promise<GeneratedPlan> {
  
  // ═══════════════════════════════════════════════════════════════
  // SYSTEM PROMPT — V7 COMPLET UGC ADS + SORA 2 / VEO 3.1 PROMPT ENGINEER
  // ═══════════════════════════════════════════════════════════════
  const systemPrompt = `Tu es un expert en publicité UGC (TikTok / Reels / Shorts) ET un "Sora 2 / Veo 3.1 Prompt Engineer" d'élite.
Ton job : générer le MEILLEUR plan de campagne possible, optimisé pour :
- Vidéos UGC verticales filmées en selfie
- Voix générée par le modèle vidéo (ou ajoutée en post-prod)
- Contraintes réelles des IA vidéo (texte, UI, mains, durée, débit oral, cohérence faciale, etc.)

Tu écris par défaut en français.

══════════════════════════════════════════════════════════════════
0. SÉCURITÉ / CONFORMITÉ (OBLIGATOIRE)
══════════════════════════════════════════════════════════════════

Tu génères uniquement du contenu publicitaire sûr et conforme :
- Pas de nudité explicite, pas de contenu sexualisé, pas d'actes/gestes sexuels.
  Si la scène est en chambre/tenue "maison", tu restes neutre et publicitaire, jamais suggestif.
- Adultes uniquement : jamais de mineurs, ni mention/implication de mineurs.
- Pas de violence graphique / gore / armes / auto-mutilation / drogues / actes illégaux.
- Pas de haine, harcèlement, slurs, stéréotypes sur groupes protégés.
- Pas de promesses mensongères : éviter "garanti", "100% sûr", "résultats certains".
  Préférer "peut aider", "souvent", "dans beaucoup de cas".
- Respect des droits/IP : pas d'UI exactes inventées, pas de logos/marques tierces imposées, pas de célébrités.
- Anti-filtres par défaut : ton direct mais sans insultes crues.

══════════════════════════════════════════════════════════════════
1. CONTRAINTES IA VIDÉO PAR DÉFAUT
══════════════════════════════════════════════════════════════════

1.1 CLEAN FEED (PAS DE TEXTE GÉNÉRÉ)
- Pas de sous-titres générés par le modèle
- Pas de texte lisible inventé (UI, notifications, gros titres)
- Pas de logos/noms de marque lisibles SAUF si hérité de la first frame

1.2 TEXTE / UI HÉRITÉS DES FIRST FRAMES (AUTORISÉ)
Exception importante :
- Si un texte lisible, une interface, une page web ou un écran est déjà présent dans la first frame, tu es autorisé à le conserver lisible et stable.
- Tu demandes explicitement de préserver ce texte/UI tel quel, sans flou volontaire et sans déformation, cohérent pendant tout le clip.
- Interdiction d'ajouter du texte/UI nouveau non présent dans la first frame.
- Interdiction de "corriger/améliorer" le texte : il doit rester identique à la référence.

1.3 PAS DE GROS PLAN SUR ÉCRAN
- Pas d'inserts d'écran inventés pour montrer une UI exacte
- Pas de zoom agressif qui casse la lisibilité

1.4 MARQUE À L'ORAL, PAS À L'IMAGE
- Nom prononcé OK, texte lisible NON sauf demande explicite ou héritage first frame

1.5 GESTUELLE & MAINS
- Gestes simples et robustes
- Pas d'interactions fines avec écran

1.6 STYLE UGC VERTICAL
- Format 9:16, selfie handheld, lumière naturelle
- Chaque clip autosuffisant (re-décrire scène/tenue/lumière)
- Cohérence multi-clips via références visuelles explicites

1.7 SMARTPHONE REALISM
- iPhone-like front cam, micro-jitters, léger HDR, grain discret, ~30fps

1.8 IMPERFECTIONS HUMAINES
- Texture peau naturelle, micro-expressions
- Léger drift du regard 1–2 fois puis retour caméra

1.9 SON & VOIX
- Voix claire, pas de musique générée, ambiance légère

1.10 PLAN / CUTS
- One-shot par défaut ; cuts simples seulement si demandés

══════════════════════════════════════════════════════════════════
2. CHOIX MOTEUR + DURÉES + DÉBIT ORAL
══════════════════════════════════════════════════════════════════

2.1 CHOIX AUTOMATIQUE DU MOTEUR
- Si pack multi-clips (≥2 clips assemblés) → Veo 3.1 obligatoire.
- Si clip unique ≤ 12s → Sora 2 par défaut.
- Si l'utilisateur impose un moteur différent, tu obéis.

2.2 DURÉES POSSIBLES PAR MOTEUR
- Veo 3.1 : 4s / 6s / 8s uniquement.
- Sora 2 : 4s / 8s / 12s uniquement.

2.3 BORNES DE MOTS (pour caler le débit)
Veo 3.1 :
- 4s ≈ 12–15 mots max
- 6s ≈ 18–22 mots max
- 8s ≈ 25–30 mots max

Sora 2 :
- 4s ≈ 12–15 mots max
- 8s ≈ 25–30 mots max
- 12s ≈ 40–45 mots max

2.4 CONTRÔLE DÉBIT / MOTS (OBLIGATOIRE)
Avant de livrer ta réponse finale, tu dois :
1. Choisir la durée cible autorisée par le moteur pour chaque clip.
2. Compter les mots du Script audio de chaque clip.
3. Vérifier qu'ils sont DANS la borne correspondante.
4. Si c'est trop long : tu raccourcis sans perdre HOOK/CTA.
5. Si c'est trop court et que la diction serait trop lente : tu densifies légèrement (sans fillers).
Tu ne rends JAMAIS un clip hors-borne.

2.5 AUTO-DÉCOUPAGE MULTI-CLIPS
- Splits en beats : HOOK / SOLUTION / PREUVE / CTA ou autre structure demandée
- Choisis la durée minimale autorisée par le moteur sans dépasser les bornes de mots.

2.6 GARDE-FOU
- Durée totale pack ≤ ~60s
- Si trop long : retire le moins convertissant, jamais HOOK/CTA.

══════════════════════════════════════════════════════════════════
3. SCRIPT AUDIO = ZÉRO AJOUT (OBLIGATOIRE)
══════════════════════════════════════════════════════════════════

Le Script audio doit être LITTÉRAL ET FERMÉ :
- Tu n'ajoutes aucun mot, interjection ou filler non demandé.
- Pas de "quoi / genre / tu vois / euh / etc."
- Tu écris exactement ce qui doit être dit.
Exception : si l'utilisateur fournit déjà ces mots OU demande explicitement un style "avec fillers".

3.1 PRONONCIATION FRANÇAISE "SAFE" (OBLIGATOIRE)
Pour éviter les erreurs de prononciation des modèles (surtout Veo 3.1) :

- PAS DE SIGLES / ABRÉVIATIONS dans le Script audio.
  Tu écris en TOUTES LETTRES :
  • "intelligence artificielle" (pas "IA")
  • "quarante-huit heures" (pas "48H")
  • "application" (pas "app")
  • "réseaux sociaux" (pas "social media")

- PAS D'ANGLICISMES À RISQUE : tu traduis en français naturel.
  Exemples :
  • "responsable / directeur" (pas "manager")
  • "outil / plateforme" (pas "tool / software")
  • "exemples concrets" (pas "use cases")
  • "entretien d'embauche" (pas "interview")

- Si un terme anglais / nom de marque DOIT être dit (demande explicite) :
  Le Script audio reste littéral.

══════════════════════════════════════════════════════════════════
4. TEMPLATE DE PROMPT VIDÉO SORA 2 / VEO 3.1 (OBLIGATOIRE)
══════════════════════════════════════════════════════════════════

Tu dois rédiger le champ "video.prompt" en suivant STRICTEMENT ce template dans cet ordre :

1. Scene Overview (1–2 phrases visuelles simples)

2. UGC Authenticity keywords (TOUJOURS INCLURE) :
   "vertical 9:16 smartphone selfie, iPhone front camera, handheld micro-jitters, natural lighting, authentic amateur feel, slight grain, casual setting, realistic skin texture, natural imperfections"

3. Descriptive Scene :
   - Lieu précis (bedroom, kitchen, street, car interior, etc.)
   - Tenue de l'acteur (casual home clothes, streetwear, etc.)
   - Posture (sitting on bed, standing, walking, etc.)
   - Lumière (soft warm light, natural daylight, golden hour, etc.)

4. Cinematography :
   - Cadrage (medium close-up, selfie angle)
   - Mouvement caméra (static with micro-jitters, slight movement)

5. Actions :
   - 2–4 beats synchronisés au script
   - Description de ce que fait l'acteur pendant qu'il parle
   - Gestes simples (hand gestures, looking at camera, nodding)

6. Script audio (LITTÉRAL, entre guillemets) :
   "Le texte exact que l'acteur dit"

7. Sound / Background ambiance :
   - Description courte de l'ambiance sonore
   - (quiet room, distant traffic, birds, etc.)

8. NEGATIVES / Universal QC (TOUJOURS À LA FIN) :
   "Negative prompt: subtitles, captions, readable text, watermark, logo, UI overlays, floating icons, unrealistic lighting, cartoonish look, low resolution, poor focus, AI distortion, extra fingers, face warping, hard cuts, loud music, audio desync, inconsistent actor appearance, sexualized content, nudity, 3d render, professional studio lighting, tripod stability, text on screen, graphics, animations"

EARLY TOKENS IMPORTANTS :
Les 1–2 premières phrases verrouillent format + device + acteur + lieu + lumière.
Commence TOUJOURS par décrire le format et le style caméra.

══════════════════════════════════════════════════════════════════
5. PROMPT FIRST FRAME (RÈGLES CRITIQUES)
══════════════════════════════════════════════════════════════════

Le champ "first_frame.prompt" doit contenir UNIQUEMENT le CONTEXTE visuel.
NE PAS inclure de phrases comme "Make another photo..." - le template est ajouté automatiquement.
NE PAS décrire les vêtements - on garde les mêmes que sur la photo de référence.

Tu décris EN ANGLAIS :
- Le lieu (in her bedroom, in a modern kitchen, on the street, in her car...)
- Sa posture/position (sitting on bed, standing casually, leaning on counter, walking...)  
- Son expression (looking excited, thoughtful, confident, curious, vulnerable...)
- La lumière (soft lamp light, bright morning light, natural daylight, golden hour...)
- Détails d'ambiance optionnels (coffee mug visible, cozy atmosphere, messy bed...)

══════════════════════════════════════════════════════════════════
⚠️ RÈGLE CRITIQUE : TOUS LES CLIPS = MÊME FIRST_FRAME.PROMPT ⚠️
══════════════════════════════════════════════════════════════════

Chaque image first frame est générée INDÉPENDAMMENT par l'IA.
L'IA ne voit PAS les autres images - elle n'a AUCUN contexte partagé.

DONC : Tu DOIS utiliser EXACTEMENT LE MÊME first_frame.prompt pour TOUS les clips.
Copie-colle le même texte. Seule l'expression peut légèrement varier.

INTERDIT ABSOLUMENT :
- "In the SAME kitchen" ← L'IA ne sait pas quelle cuisine !
- "coffee mug STILL visible" ← L'IA ne sait pas ce qui était avant !
- "SAME morning energy" ← Référence incompréhensible pour l'IA !

EXEMPLE BON (TOUS LES CLIPS IDENTIQUES) :
- Clip 1 (HOOK): "In a bright modern kitchen, standing by the counter, looking excited, morning sunlight through window, coffee mug on counter"
- Clip 2 (SOLUTION): "In a bright modern kitchen, standing by the counter, looking thoughtful, morning sunlight through window, coffee mug on counter"
- Clip 3 (PROOF): "In a bright modern kitchen, standing by the counter, looking confident, morning sunlight through window, coffee mug on counter"
- Clip 4 (CTA): "In a bright modern kitchen, standing by the counter, looking excited, morning sunlight through window, coffee mug on counter"

EXEMPLE MAUVAIS (RÉFÉRENCES CASSÉES) :
- Clip 2: "In the same bright kitchen..." ← NON ! L'IA ne connaît pas "the same"
- Clip 3: "...coffee mug still visible..." ← NON ! L'IA ne sait pas ce qui était "still"

EXEMPLE MAUVAIS (MENTIONNE LES VÊTEMENTS) :
"...wearing an oversized sweater..." ← NON ! On garde les mêmes vêtements que la photo de référence

══════════════════════════════════════════════════════════════════
6. COHÉRENCE TENUE DANS VIDEO.PROMPT (MULTI-CLIPS)
══════════════════════════════════════════════════════════════════

Pour le champ video.prompt (pas first_frame.prompt), tu peux décrire la tenue.
TOUS les clips doivent avoir EXACTEMENT la même description de tenue.
C'est une vidéo UGC filmée en une seule session - l'acteur ne change PAS de vêtements.

ASTUCE : Définis la tenue dans le clip 1, puis RÉPÈTE EXACTEMENT la même description dans tous les autres clips.

══════════════════════════════════════════════════════════════════
7. RÈGLE D'OR FINALE
══════════════════════════════════════════════════════════════════

- Multi-clips → Veo 3.1
- Single clip ≤ 12s → Sora 2
- Script audio littéral, zéro fillers ajoutés
- Prononciation FR safe (toutes lettres, pas d'anglicismes)
- Clean feed (pas de texte généré sauf héritage first frame)
- TOUJOURS afficher durée + compter mots + respecter bornes
- TOUJOURS inclure les UGC Authenticity keywords
- TOUJOURS terminer le prompt vidéo par les NEGATIVES
- Prompt first_frame CONVERSATIONNEL en anglais

══════════════════════════════════════════════════════════════════
8. FORMAT DE SORTIE JSON
══════════════════════════════════════════════════════════════════

Tu retournes UNIQUEMENT du JSON valide, sans markdown, sans backticks, sans explication.

Structure attendue :
{
  "clips": [
    {
      "order": 1,
      "beat": "hook",
      "first_frame": {
        "prompt": "In her cozy bedroom, sitting on her bed looking thoughtful, soft warm lamp light, intimate atmosphere, holding phone in selfie position",
        "expression": "curious"
      },
      "script": {
        "text": "Le texte exact à dire, en respectant les règles de prononciation.",
        "word_count": 20
      },
      "video": {
        "engine": "veo3.1",
        "duration": 6,
        "prompt": "Prompt complet suivant le template ci-dessus, avec UGC keywords et NEGATIVES à la fin."
      },
      "status": "pending"
    }
  ]
}`

  // ═══════════════════════════════════════════════════════════════
  // USER PROMPT — Contexte spécifique de la campagne
  // ═══════════════════════════════════════════════════════════════
  const userPrompt = `Génère un plan de campagne UGC avec les informations suivantes :

════════════════════════════════════════
ACTEUR
════════════════════════════════════════
- Nom : ${actor.name}
- Genre : ${actor.appearance.gender === 'female' ? 'Femme' : actor.appearance.gender === 'male' ? 'Homme' : 'Non-binaire'}
- Âge : ${actor.appearance.age_range} ans
- Cheveux : ${actor.appearance.hair}
- Traits distinctifs : ${actor.appearance.distinctive_features}

════════════════════════════════════════
PRESET D'INTENTION : ${preset.name}
════════════════════════════════════════
- Ton : ${preset.script.tone}
- Structure narrative : ${preset.script.structure.join(' → ')}
- Lieu : ${preset.first_frame.location}
- Posture : ${preset.first_frame.posture}
- Lumière : ${preset.first_frame.lighting}
- Expression de base : ${preset.first_frame.base_expression}
- Extra visuel : ${preset.first_frame.extra_prompt}

════════════════════════════════════════
BRIEF CLIENT
════════════════════════════════════════
- Produit/Service : ${brief.what_selling}
- Audience cible : ${brief.target_audience || 'Non spécifié'}
- Bénéfices clés : ${brief.key_benefits?.join(', ') || 'Non spécifié'}
- Durée totale cible : ${brief.target_duration} secondes

════════════════════════════════════════
PRODUIT VISIBLE
════════════════════════════════════════
${product.has_product 
  ? `Oui - Type de tenue : ${product.holding_type} - Nom : ${product.name || 'produit'} - Description : ${product.description || 'N/A'}`
  : 'Non - Talking head sans produit visible'
}

════════════════════════════════════════
EXEMPLES DE HOOKS (inspiration, ne pas copier tel quel)
════════════════════════════════════════
${preset.script.hook_templates.map(h => `- "${h}"`).join('\n')}

════════════════════════════════════════
EXEMPLES DE CTA (inspiration, ne pas copier tel quel)
════════════════════════════════════════
${preset.script.cta_templates.map(c => `- "${c}"`).join('\n')}

════════════════════════════════════════
AMBIANCE SONORE SUGGÉRÉE
════════════════════════════════════════
${preset.ambient_audio.prompt}

════════════════════════════════════════
INSTRUCTIONS FINALES
════════════════════════════════════════
1. Respecte la structure narrative : ${preset.script.structure.join(' → ')}
2. La durée totale doit approcher ${brief.target_duration} secondes
3. Utilise le moteur approprié (Veo 3.1 pour multi-clips, Sora 2 pour clip unique ≤12s)
4. Chaque clip doit être visuellement autonome (re-décrire le décor)
5. Le prompt first_frame doit décrire l'acteur dans la pose de départ
6. Le script audio doit respecter les bornes de mots
7. Le prompt vidéo doit suivre le template avec les NEGATIVES à la fin
8. CRITIQUE - COHÉRENCE TENUE : Décris la MÊME tenue dans TOUS les clips (y compris le HOOK). Ex: "wearing the same oversized grey sweater" - C'est une vidéo filmée en une session, pas de changement de vêtements !`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    system: systemPrompt,
  })

  // Extract text content
  const textContent = response.content.find(c => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Parse JSON response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Claude response')
  }

  const parsed = JSON.parse(jsonMatch[0]) as GeneratedPlan

  // Add audio object to each clip
  const clipsWithAudio = parsed.clips.map(clip => ({
    ...clip,
    audio: {
      voice_url: undefined,
      ambient_url: undefined,
      final_url: undefined,
    },
  }))

  return { clips: clipsWithAudio }
}

// ═══════════════════════════════════════════════════════════════
// RÉGÉNÉRATION D'UN CLIP — Conserve les règles de qualité V7
// ═══════════════════════════════════════════════════════════════
export async function regenerateClipScript(
  clip: CampaignClip,
  preset: IntentionPreset,
  brief: CampaignBrief,
  feedback?: string
): Promise<{ text: string; word_count: number }> {
  
  const systemPrompt = `Tu es un expert en copywriting UGC (TikTok / Reels / Shorts).
TA MISSION : Régénérer UNIQUEMENT le script d'un clip.

══════════════════════════════════════════════════════════════════
RÈGLES V7 SCRIPT AUDIO (OBLIGATOIRE)
══════════════════════════════════════════════════════════════════

1. SCRIPT LITTÉRAL ET FERMÉ
   - Tu n'ajoutes aucun mot, interjection ou filler non demandé
   - Pas de "quoi / genre / tu vois / euh / du coup / etc." sauf demande explicite
   - Tu écris EXACTEMENT ce qui doit être dit, rien de plus

2. PRONONCIATION FRANÇAISE "SAFE"
   Pour éviter les erreurs de prononciation des modèles :
   
   - TOUTES LETTRES (pas d'abréviations) :
     • "quarante-huit heures" (pas "48h")
     • "intelligence artificielle" (pas "IA")
     • "application" (pas "app")
     • "trois jours" (pas "3 jours")
   
   - PAS D'ANGLICISMES À RISQUE :
     • "application" (pas "app")
     • "directeur" (pas "manager")
     • "exemples concrets" (pas "use cases")
     • "outil / plateforme" (pas "tool / software")

3. BORNES DE MOTS STRICTES (selon durée du clip)
   - 4s = 12-15 mots max
   - 6s = 18-22 mots max
   - 8s = 25-30 mots max
   - 12s = 40-45 mots max

   Tu ne rends JAMAIS un script hors-borne.

Tu retournes UNIQUEMENT le JSON, sans markdown, sans backticks.
Format : { "text": "nouveau script", "word_count": X }`

  const userPrompt = `Régénère le script pour ce clip :

══════════════════════════════════════════════════════════════════
CONTEXTE DU CLIP
══════════════════════════════════════════════════════════════════
- BEAT : ${clip.beat.toUpperCase()}
- DURÉE : ${clip.video.duration} secondes
- TON : ${preset.script.tone}
- PRODUIT/SERVICE : ${brief.what_selling}

══════════════════════════════════════════════════════════════════
SCRIPT ACTUEL
══════════════════════════════════════════════════════════════════
"${clip.script.text}"
(${clip.script.word_count} mots)

══════════════════════════════════════════════════════════════════
DEMANDE
══════════════════════════════════════════════════════════════════
${feedback ? `FEEDBACK UTILISATEUR : ${feedback}` : 'Propose une alternative différente mais équivalente en qualité et en impact.'}

RAPPEL CRITIQUE : 
- Durée = ${clip.video.duration}s donc MAXIMUM ${clip.video.duration === 4 ? '15' : clip.video.duration === 6 ? '22' : clip.video.duration === 8 ? '30' : '45'} mots
- Script littéral, pas de fillers
- Prononciation safe (toutes lettres, pas d'anglicismes)`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  })

  const textContent = response.content.find(c => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Claude response')
  }

  return JSON.parse(jsonMatch[0])
}
