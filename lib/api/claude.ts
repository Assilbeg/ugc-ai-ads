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

// Durées par beat (en secondes)
const BEAT_DURATIONS: Record<ScriptBeat, number> = {
  hook: 6,
  problem: 8,
  agitation: 6,
  solution: 8,
  proof: 8,
  cta: 6,
}

// Choix du moteur selon la durée
function getVideoEngine(duration: number): VideoEngine {
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
  const systemPrompt = `Tu es un expert en publicité UGC (TikTok / Reels / Shorts).

Tu dois générer un plan de clips vidéo pour une campagne publicitaire.

RÈGLES STRICTES :
1. Le script audio doit être LITTÉRAL - pas de fillers (euh, genre, quoi, etc.) sauf si explicitement demandé
2. Pas de sigles/abréviations - écris en toutes lettres
3. Pas d'anglicismes - utilise le français naturel
4. Compte les mots et respecte les limites par durée :
   - 4s = 12-15 mots max
   - 6s = 18-22 mots max  
   - 8s = 25-30 mots max
   - 12s = 40-45 mots max

STRUCTURE DU SCRIPT :
- HOOK : Accroche percutante qui capte l'attention immédiatement
- PROBLEM : Description du problème que la cible rencontre
- AGITATION (optionnel) : Amplifier le problème
- SOLUTION : Présenter le produit/service comme solution
- PROOF (optionnel) : Preuve sociale ou résultat concret
- CTA : Appel à l'action clair

Tu retournes UNIQUEMENT du JSON valide, pas de markdown.`

  const userPrompt = `Génère un plan de campagne UGC avec les informations suivantes :

ACTEUR :
- Nom : ${actor.name}
- Apparence : ${actor.appearance.gender}, ${actor.appearance.age_range} ans, ${actor.appearance.hair}

PRESET D'INTENTION : ${preset.name}
- Ton : ${preset.script.tone}
- Structure : ${preset.script.structure.join(' → ')}
- Lieu : ${preset.first_frame.location}
- Posture : ${preset.first_frame.posture}
- Lumière : ${preset.first_frame.lighting}

BRIEF :
- Produit/Service : ${brief.what_selling}
- Audience cible : ${brief.target_audience || 'Non spécifié'}
- Bénéfices clés : ${brief.key_benefits?.join(', ') || 'Non spécifié'}
- Durée totale cible : ${brief.target_duration} secondes

PRODUIT VISIBLE : ${product.has_product ? `Oui - ${product.holding_type} - ${product.name || 'produit'}` : 'Non'}

EXEMPLES DE HOOKS DU PRESET :
${preset.script.hook_templates.map(h => `- "${h}"`).join('\n')}

EXEMPLES DE CTA DU PRESET :
${preset.script.cta_templates.map(c => `- "${c}"`).join('\n')}

Génère le plan en JSON avec cette structure exacte :
{
  "clips": [
    {
      "order": 1,
      "beat": "hook",
      "first_frame": {
        "prompt": "Description détaillée pour NanoBanana (selfie, lieu, posture, expression, tenue, lumière)",
        "expression": "curious"
      },
      "script": {
        "text": "Le texte exact à dire",
        "word_count": 20
      },
      "video": {
        "engine": "veo3.1",
        "duration": 6,
        "prompt": "Prompt complet pour Veo 3.1 / Sora 2"
      },
      "status": "pending"
    }
  ]
}

Important : 
- Respecte la structure ${preset.script.structure.join(' → ')}
- La durée totale doit approcher ${brief.target_duration}s
- Chaque clip doit être autonome visuellement`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
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

export async function regenerateClipScript(
  clip: CampaignClip,
  preset: IntentionPreset,
  brief: CampaignBrief,
  feedback?: string
): Promise<{ text: string; word_count: number }> {
  const systemPrompt = `Tu es un expert en copywriting UGC. 
Tu dois régénérer UNIQUEMENT le script d'un clip.
Retourne UNIQUEMENT le JSON, pas de markdown.`

  const userPrompt = `Régénère le script pour ce clip :

BEAT : ${clip.beat}
DURÉE : ${clip.video.duration}s (${clip.video.duration === 4 ? '12-15' : clip.video.duration === 6 ? '18-22' : clip.video.duration === 8 ? '25-30' : '40-45'} mots max)
TON : ${preset.script.tone}
PRODUIT : ${brief.what_selling}

SCRIPT ACTUEL : "${clip.script.text}"

${feedback ? `FEEDBACK UTILISATEUR : ${feedback}` : ''}

Retourne en JSON : { "text": "nouveau script", "word_count": X }`

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

