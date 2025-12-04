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
function getVideoEngine(_clipCount: number, _duration: number): VideoEngine {
  // Veo 3.1 uniquement - meilleur rapport qualité/prix
  return 'veo3.1'
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
0. RÈGLES HOOK UGC (CRITIQUE - À LIRE EN PREMIER)
══════════════════════════════════════════════════════════════════

Le HOOK est le moment le plus important. Il doit STOPPER LE SCROLL en 1 seconde.

❌ HOOKS INTERDITS (trop faibles, génériques, "AI slop") :
- "Aujourd'hui je vais te parler de..."
- "Tu veux savoir comment...?"
- "Salut ! Alors voilà..."
- "J'ai découvert quelque chose d'incroyable..."
- Toute introduction qui ne tape pas direct sur le PROBLÈME

✅ HOOKS EFFICACES (pattern à suivre) :
Le hook doit être une PHRASE QUE LA CIBLE SE DIT À ELLE-MÊME, qui exprime sa frustration.
C'est négatif, c'est direct, c'est personnel. On parle à la première personne.

EXEMPLES DE BONS HOOKS :
- "Postuler sur LinkedIn m'a jamais rien rapporté" (candidature)
- "J'ai passé 3 mois à envoyer des CV pour rien" (emploi)
- "Je comprenais rien au code y'a encore 2 mois" (formation dev)
- "J'arrivais plus à dormir tellement j'étais stressée" (bien-être)
- "Mon compte en banque me faisait flipper chaque fin de mois" (finance)
- "Je scrollais TikTok au lieu de bosser sur mon projet" (productivité)

FORMULE : [Situation négative passée] + [émotion/frustration] → doit résonner avec le PAIN POINT du brief.

Le hook NE DOIT PAS mentionner la solution. Il pose juste le problème de manière viscérale.

══════════════════════════════════════════════════════════════════
0.1 SÉCURITÉ / CONFORMITÉ (OBLIGATOIRE)
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

3.1 CTA INTERDITS (phrases à éviter absolument)
- "Je dois filer" / "Je dois y aller" / "Je vous laisse"
- "Bon allez" / "Bref allez"
- Toute phrase qui sonne comme une excuse pour partir
Le CTA doit être DIRECT et orienté ACTION : "Le lien est en bio", "Teste par toi-même", "Clique et regarde"

3.2 PRONONCIATION FRANÇAISE "SAFE" (OBLIGATOIRE)
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

3.3 ACCENT & LANGUE STANDARD (OBLIGATOIRE)
Tu DOIS adapter l'instruction d'accent selon la langue du brief (champ "language").

MAPPING LANGUE → INSTRUCTION D'ACCENT (à inclure dans CHAQUE video.prompt) :
⚠️ NE PAS mentionner les accents à éviter (ça confond le modèle), seulement décrire l'accent voulu !

- "fr" (défaut) : "speaks in standard metropolitan French accent, Parisian pronunciation, clear and neutral"
- "en-us" : "speaks in standard American English accent, neutral Midwest pronunciation, clear and professional"
- "en-uk" : "speaks in standard British English accent, RP pronunciation, clear and neutral"
- "es" : "speaks in standard Castilian Spanish accent, Madrid pronunciation, clear and neutral"
- "es-latam" : "speaks in neutral Latin American Spanish accent, Mexican standard pronunciation, clear"
- "de" : "speaks in standard High German accent, Hochdeutsch pronunciation, clear and neutral"
- "it" : "speaks in standard Italian accent, Tuscan/Roman pronunciation, clear and neutral"
- "pt-br" : "speaks in standard Brazilian Portuguese accent, São Paulo pronunciation, clear and neutral"
- "pt" : "speaks in standard European Portuguese accent, Lisbon pronunciation, clear and neutral"
- "nl" : "speaks in standard Dutch accent, Randstad pronunciation, clear and neutral"

⚠️ RÈGLE CRITIQUE : 
- Détecte la langue du brief automatiquement si non spécifiée (utilise "fr" par défaut)
- L'instruction d'accent DOIT apparaître AVANT le texte du script dans video.prompt
- Le script lui-même doit être rédigé dans la langue appropriée

══════════════════════════════════════════════════════════════════
4. TEMPLATE DE PROMPT VIDÉO SORA 2 / VEO 3.1 (OBLIGATOIRE)
══════════════════════════════════════════════════════════════════

Tu dois rédiger le champ "video.prompt" en suivant STRICTEMENT ce template dans cet ordre :

1. Scene Overview (1–2 phrases visuelles simples)

2. UGC Authenticity keywords (ADAPTER AU CAMERA_STYLE) :
   - handheld_shaky: "vertical 9:16 smartphone selfie, iPhone front camera, noticeable handheld shake, walking movement, dynamic camera, authentic amateur feel, slight grain, realistic skin texture"
   - handheld_subtle: "vertical 9:16 smartphone selfie, iPhone front camera, subtle micro-jitters, natural handheld feel, authentic amateur vibes, slight grain, casual setting, realistic skin texture"
   - stable: "vertical 9:16 smartphone selfie, iPhone front camera, steady handheld, minimal movement, stable framing, natural lighting, professional UGC feel, realistic skin texture"

3. Descriptive Scene :
   - Lieu précis (bedroom, kitchen, street, car interior, etc.)
   - Tenue de l'acteur (casual home clothes, streetwear, etc.)
   - Posture (sitting on bed, standing, walking, etc.)
   - Lumière (soft warm light, natural daylight, golden hour, etc.)

4. Cinematography + Camera Style :
   - Cadrage (medium close-up, selfie angle)
   - Mouvement caméra SELON camera_style :
     * handheld_shaky: "noticeable handheld shake, walking movement, dynamic unstable camera"
     * handheld_subtle: "subtle micro-jitters, gentle handheld motion, natural slight movement"
     * stable: "steady handheld, minimal shake, stable framing throughout"

5. Actions :
   - 2–4 beats synchronisés au script
   - Description de ce que fait l'acteur pendant qu'il parle
   - Gestes simples (hand gestures, looking at camera, nodding)

6. Script audio (LITTÉRAL, entre guillemets) :
   TOUJOURS commencer par l'instruction d'accent (selon la langue du brief), puis le texte :
   "[instruction d'accent de la section 3.3]: [Le texte exact que l'acteur dit]"
   
   EXEMPLES PAR LANGUE :
   - FR: "speaks in standard metropolitan French accent, Parisian pronunciation, clear and neutral: Postuler sur LinkedIn m'a jamais rien rapporté"
   - EN-US: "speaks in standard American English accent, neutral Midwest pronunciation, clear and professional: I've been applying on LinkedIn for months with zero results"
   - ES: "speaks in standard Castilian Spanish accent, Madrid pronunciation, clear and neutral: Llevar tres meses enviando currículums sin conseguir nada"

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
- Le GESTE/POSE (pointing at camera, hand on chest, open palm gesture, etc.)
- Détails d'ambiance optionnels (coffee mug visible, cozy atmosphere, messy bed...)

══════════════════════════════════════════════════════════════════
5.1 GESTES / POSES PAR CLIP (OBLIGATOIRE)
══════════════════════════════════════════════════════════════════

Chaque clip DOIT avoir un "gesture" cohérent avec le script.
Tu dois choisir parmi : neutral, pointing_camera, pointing_self, open_palm, thumbs_up, 
counting_fingers, holding_product, showing_phone, thinking_pose, shrug, hand_on_chest, waving

MAPPING GESTE → SCRIPT :
- "Stop scroll" / "Écoute" / "Regarde ça" → pointing_camera
- "J'ai découvert" / "Moi j'ai..." / "Personnellement" → pointing_self
- "Laisse-moi t'expliquer" / "Voilà pourquoi" → open_palm
- "3 raisons" / "Premièrement" → counting_fingers
- "Ce produit" / "Cette app" (avec produit visible) → holding_product ou showing_phone
- "Franchement" / "Je te jure" / "Sincèrement" → hand_on_chest
- "Je comprends pas" / "C'est ouf" → shrug
- "C'est top" / "Je recommande" → thumbs_up
- "J'y croyais pas" / "Je me demandais" → thinking_pose
- "Salut" / "Coucou" (début casual) → waving
- Sinon → neutral

Le geste doit être INTÉGRÉ dans le prompt first_frame :
EXEMPLE : "pointing at camera with one finger, looking excited"
EXEMPLE : "hand on chest in sincere gesture, looking vulnerable"

══════════════════════════════════════════════════════════════════
5.2 MODE DE SCÈNE : SINGLE vs MULTI LOCATION
══════════════════════════════════════════════════════════════════

Le preset définit un "scene_mode" :

MODE "single_location" (défaut) :
- TOUS les clips ont le MÊME lieu
- Tu COPIES le même lieu dans tous les first_frame.prompt
- Seuls expression et gesture varient

MODE "multi_location" :
- Chaque beat a un lieu différent (défini par location_by_beat)
- Tu utilises le lieu approprié pour chaque clip
- Chaque prompt est autonome (pas de référence aux autres)

⚠️ RÈGLE CRITIQUE : PROMPTS AUTONOMES ⚠️
Chaque image est générée INDÉPENDAMMENT. L'IA ne voit PAS les autres images.
INTERDIT :
- "In the SAME kitchen" ← L'IA ne connaît pas "the same"
- "coffee mug STILL visible" ← L'IA ne sait pas ce qui était "still"

EXEMPLE SINGLE_LOCATION (tous identiques sauf expression/geste) :
- Clip 1: "In a bright modern kitchen, pointing at camera, looking excited, morning light"
- Clip 2: "In a bright modern kitchen, hand on chest, looking thoughtful, morning light"
- Clip 3: "In a bright modern kitchen, thumbs up, looking confident, morning light"

EXEMPLE MULTI_LOCATION (lieux différents, prompts autonomes) :
- Clip 1 (bedroom): "In her cozy bedroom, sitting on bed, waving at camera, looking excited, soft lamp light"
- Clip 2 (street): "On a busy city street, walking, open palm gesture, looking confident, natural daylight"
- Clip 3 (kitchen): "In a bright kitchen, standing by counter, pointing at self, looking relieved, morning light"

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
        "prompt": "In her cozy bedroom, sitting on her bed, pointing at camera with one finger, looking curious, soft warm lamp light, intimate atmosphere",
        "expression": "curious",
        "gesture": "pointing_camera",
        "location": "bedroom"
      },
      "script": {
        "text": "Le texte exact à dire, en respectant les règles de prononciation.",
        "word_count": 20
      },
      "video": {
        "engine": "veo3.1",
        "duration": 6,
        "prompt": "Prompt complet suivant le template ci-dessus, avec UGC keywords ADAPTÉS au camera_style. IMPORTANT: Dans la section Script audio, toujours inclure 'speaks in standard metropolitan French accent, Parisian pronunciation, clear and neutral:' AVANT le texte. Terminer par les NEGATIVES.",
        "camera_style": "handheld_subtle"
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
- Mode de scène : ${preset.first_frame.scene_mode || 'single_location'}
- Lieu par défaut : ${preset.first_frame.location}
${preset.first_frame.scene_mode === 'multi_location' && preset.first_frame.location_by_beat 
  ? `- Lieux par beat : ${Object.entries(preset.first_frame.location_by_beat).map(([beat, loc]) => `${beat}=${loc}`).join(', ')}` 
  : ''}
- Style caméra : ${preset.first_frame.camera_style || 'handheld_subtle'}
${preset.first_frame.camera_style_by_beat 
  ? `- Caméra par beat : ${Object.entries(preset.first_frame.camera_style_by_beat).map(([beat, style]) => `${beat}=${style}`).join(', ')}` 
  : ''}
- Posture : ${preset.first_frame.posture}
- Lumière : ${preset.first_frame.lighting}
- Expression de base : ${preset.first_frame.base_expression}
- Extra visuel : ${preset.first_frame.extra_prompt}

════════════════════════════════════════
BRIEF CLIENT
════════════════════════════════════════
- Produit/Service : ${brief.what_selling}
- PROBLÈME DE L'AUDIENCE (CRUCIAL) : ${brief.pain_point || 'Non spécifié'}
- Audience cible : ${brief.target_audience || 'Non spécifié'}
- Bénéfices clés : ${brief.key_benefits?.join(', ') || 'Non spécifié'}
- Durée totale cible : ${brief.target_duration} secondes
- LANGUE DU SCRIPT : ${brief.language || 'fr'} ← UTILISE L'INSTRUCTION D'ACCENT CORRESPONDANTE (section 3.3)

⚠️ UTILISE LE PROBLÈME CI-DESSUS pour :
- Le HOOK : reformule ce problème comme une phrase que la cible se dit ("J'en avais marre de...", "Je galérais à...")
- L'AGITATION : amplifie cette douleur, montre que tu comprends
- La SOLUTION : réponds directement à ce problème spécifique

RAPPEL HOOK : Le hook doit être la VOIX INTÉRIEURE de la cible, pas une intro générique !

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
4. Le script audio doit respecter les bornes de mots
5. Le prompt vidéo doit suivre le template avec les NEGATIVES à la fin
6. CRITIQUE - COHÉRENCE TENUE : Décris la MÊME tenue dans TOUS les clips. C'est une vidéo filmée en une session, pas de changement de vêtements !
7. GESTES OBLIGATOIRES : Chaque clip DOIT avoir un "gesture" cohérent avec ce que dit le script
8. Chaque first_frame DOIT inclure : prompt, expression, gesture, location
9. Chaque video DOIT inclure : engine, duration, prompt, camera_style
10. CAMERA STYLE : Utilise "${preset.first_frame.camera_style || 'handheld_subtle'}" par défaut.

⚠️⚠️⚠️ RÈGLE CRITIQUE LIEU ⚠️⚠️⚠️
${preset.first_frame.scene_mode === 'multi_location' 
  ? `MODE MULTI-LIEUX ACTIVÉ : Utilise les lieux définis par beat (${Object.entries(preset.first_frame.location_by_beat || {}).map(([beat, loc]) => `${beat}=${loc}`).join(', ')})`
  : `MODE LIEU UNIQUE : TOUS les clips doivent être dans "${preset.first_frame.location}" (${preset.first_frame.location}).
NE CHANGE PAS DE LIEU entre les clips. L'acteur reste dans le MÊME endroit : ${preset.first_frame.location}.
Chaque first_frame.prompt DOIT mentionner "${preset.first_frame.location}" comme lieu.
Chaque first_frame.location DOIT être "${preset.first_frame.location}".`
}`

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
      voice_volume: 1.0,
      ambient_volume: 0.3,
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

// ═══════════════════════════════════════════════════════════════
// ANALYSE DES MARQUEURS DE PAROLE
// Compare la transcription Whisper avec le script original
// pour trouver les vrais timestamps de début/fin de parole
// ═══════════════════════════════════════════════════════════════

interface WhisperChunk {
  timestamp: [number, number]
  text: string
}

interface SpeechBoundariesInput {
  transcription: {
    text: string
    chunks: WhisperChunk[]
  }
  originalScript: string
  videoDuration: number
}

interface SpeechBoundariesOutput {
  speech_start: number
  speech_end: number
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  // Suggestions de vitesse basées sur le débit de parole
  suggested_speed: number       // 1.0 à 1.2 (UGC = pas de ralentissement)
  words_per_second: number      // Débit mesuré
}

/**
 * Utilise Claude pour analyser la transcription Whisper et trouver
 * les vrais marqueurs de parole en comparant avec le script original.
 * 
 * Ça permet de :
 * - Ignorer le "gibberish" (bruits transcrits par erreur)
 * - Trouver où le script commence vraiment
 * - Suggérer un trim intelligent
 */
export async function analyzeSpeechBoundaries({
  transcription,
  originalScript,
  videoDuration,
}: SpeechBoundariesInput): Promise<SpeechBoundariesOutput> {
  
  const systemPrompt = `Tu es un expert en analyse audio/vidéo pour contenus UGC (TikTok, Reels, Shorts).
Tu dois :
1. Comparer une transcription Whisper (avec timestamps) au script original pour trouver les VRAIS moments de parole
2. Calculer le débit de parole et suggérer une vitesse optimale

CONTEXTE :
- La transcription Whisper peut contenir du "gibberish" AU DÉBUT et/ou à la fin
- Le script original est ce que l'acteur était CENSÉ dire
- Les vidéos UGC doivent être dynamiques (débit idéal : 3-4 mots/seconde)

═══════════════════════════════════════════════════════════════
IDENTIFICATION DU GIBBERISH - C'EST CRITIQUE
═══════════════════════════════════════════════════════════════

Le GIBBERISH, c'est du texte transcrit par Whisper qui N'EST PAS dans le script original :
- Onomatopées : "hmm", "euh", "ah", "oh", "hum", "mhm", "uh"
- Sons de respiration/bouche : "fff", "sss", "tsk", "*soupir*"
- Mots random transcrits par erreur du bruit de fond
- Mots répétés sans sens : "le le le", "je je"
- Mots d'hésitation : "alors", "bon", "voilà" (quand pas dans le script)

EXEMPLES CONCRETS :
- Script: "Découvre ce produit incroyable"
  Whisper: "[0.1s] hmm [0.4s] euh [0.7s] Découvre [1.0s] ce [1.2s] produit..."
  → Le VRAI début est à 0.7s (pas 0.1s !)

- Script: "J'adore cette crème"
  Whisper: "[0.0s] ah [0.2s] oui [0.4s] J'adore [0.6s] cette [0.8s] crème [1.1s] voilà"
  → DÉBUT = 0.4s, FIN = 1.1s (on ignore "voilà" à la fin)

RÈGLES POUR LES MARQUEURS :
1. Compare CHAQUE mot Whisper au script pour trouver où le script COMMENCE vraiment
2. Le premier mot du script peut être légèrement déformé (prononciation) - fais du fuzzy matching
3. IGNORE tout ce qui précède le premier mot du script = c'est du gibberish
4. IGNORE tout ce qui suit le dernier mot du script = gibberish aussi
5. Ajoute 0.15s de padding avant et après pour ne pas couper serré

RÈGLES POUR LA VITESSE (IMPORTANT - COMPTE SEULEMENT LES MOTS DU SCRIPT) :
- Calcule le débit en mots/seconde : NOMBRE DE MOTS DU SCRIPT ÷ DURÉE DE PAROLE
- Ne compte PAS le gibberish dans les mots !
- On fait du contenu UGC TikTok → le débit doit être DYNAMIQUE (3-4 mots/s minimum)
- On n'utilise JAMAIS 0.8x ou 0.9x (pas de ralentissement, ça tue l'énergie)
- Débit < 2.5 mots/s → trop lent → suggérer 1.2x
- Débit 2.5-3.0 mots/s → un peu lent → suggérer 1.1x
- Débit ≥ 3.0 mots/s → bon débit → suggérer 1.0x

IMPORTANT : Retourne TOUJOURS un JSON valide.`

  // Formatter les chunks pour une meilleure lisibilité
  const formattedChunks = transcription.chunks.map((c, i) => 
    `[${c.timestamp[0].toFixed(2)}s - ${c.timestamp[1].toFixed(2)}s] "${c.text}"`
  ).join('\n')

  // Compter les mots du script original (pour le calcul de débit)
  const scriptWordCount = originalScript.split(/\s+/).filter(w => w.length > 0).length

  const userPrompt = `
══════════════════════════════════════════════════════════════════
SCRIPT ORIGINAL (ce que l'acteur devait dire) - ${scriptWordCount} mots
══════════════════════════════════════════════════════════════════
"${originalScript}"

══════════════════════════════════════════════════════════════════
TRANSCRIPTION WHISPER (avec timestamps)
══════════════════════════════════════════════════════════════════
Texte complet : "${transcription.text}"

Détail mot par mot :
${formattedChunks}

══════════════════════════════════════════════════════════════════
DURÉE VIDÉO : ${videoDuration}s
══════════════════════════════════════════════════════════════════

ÉTAPES À SUIVRE :
1. Parcours les chunks Whisper du DÉBUT et identifie où le SCRIPT ORIGINAL commence vraiment
   - Ignore tout gibberish avant (hmm, euh, bruits, mots pas dans le script)
   - speech_start = timestamp du premier mot qui correspond au script (- 0.15s de padding)

2. Parcours les chunks Whisper de la FIN et identifie où le SCRIPT ORIGINAL finit
   - Ignore tout gibberish après (voilà, hmm, bruits ajoutés)
   - speech_end = timestamp du dernier mot qui correspond au script (+ 0.15s de padding)

3. Calcule le débit : ${scriptWordCount} mots ÷ (speech_end - speech_start)
   - C'est le nombre de mots du SCRIPT (${scriptWordCount}), PAS de Whisper !

4. Déduis la vitesse suggérée selon les règles

Réponds en JSON avec ce format exact :
{
  "speech_start": <secondes - début du vrai script, pas du gibberish>,
  "speech_end": <secondes - fin du vrai script, pas du gibberish>,
  "confidence": "high" | "medium" | "low",
  "reasoning": "<explique quel gibberish tu as ignoré et pourquoi>",
  "words_per_second": <${scriptWordCount} ÷ durée de parole>,
  "suggested_speed": <1.0 | 1.1 | 1.2>
}`

  try {
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

    const result = JSON.parse(jsonMatch[0]) as SpeechBoundariesOutput
    
    // Validation des valeurs
    result.speech_start = Math.max(0, result.speech_start)
    result.speech_end = Math.min(videoDuration, result.speech_end)
    
    // Validation de la vitesse suggérée (1.0 à 1.2 seulement - UGC TikTok = dynamique, pas de ralentissement)
    const validSpeeds = [1.0, 1.1, 1.2]
    if (!validSpeeds.includes(result.suggested_speed)) {
      // Arrondir à la vitesse valide la plus proche
      result.suggested_speed = validSpeeds.reduce((prev, curr) => 
        Math.abs(curr - result.suggested_speed) < Math.abs(prev - result.suggested_speed) ? curr : prev
      )
    }
    
    // S'assurer que words_per_second est un nombre valide
    // IMPORTANT: Utiliser le nombre de mots du SCRIPT, pas de la transcription Whisper !
    if (typeof result.words_per_second !== 'number' || isNaN(result.words_per_second)) {
      const speechDuration = result.speech_end - result.speech_start
      result.words_per_second = speechDuration > 0 ? Math.round((scriptWordCount / speechDuration) * 10) / 10 : 3.0
    }
    
    console.log('[Claude] Speech boundaries analysis:', result)
    
    return result
  } catch (error) {
    console.error('[Claude] Error analyzing speech boundaries:', error)
    
    // Fallback : utiliser les timestamps bruts de Whisper
    const firstChunk = transcription.chunks.find(c => c.text.trim().length > 0)
    const lastChunk = [...transcription.chunks].reverse().find(c => c.text.trim().length > 0)
    
    const speech_start = firstChunk ? Math.max(0, firstChunk.timestamp[0] - 0.15) : 0
    const speech_end = lastChunk ? Math.min(videoDuration, lastChunk.timestamp[1] + 0.15) : videoDuration
    
    // Calcul du débit - IMPORTANT: utiliser le nombre de mots du SCRIPT, pas de Whisper !
    const speechDuration = speech_end - speech_start
    const wps = speechDuration > 0 ? scriptWordCount / speechDuration : 3.0
    
    // Suggestion de vitesse basée sur le débit (UGC TikTok = pas de ralentissement)
    let suggested_speed = 1.0
    if (wps < 2.5) suggested_speed = 1.2
    else if (wps < 3.0) suggested_speed = 1.1
    // Pas de 0.8x ou 0.9x - on garde 1.0x même si rapide
    
    return {
      speech_start,
      speech_end,
      confidence: 'low',
      reasoning: 'Fallback to raw Whisper timestamps due to analysis error',
      words_per_second: Math.round(wps * 10) / 10,
      suggested_speed,
    }
  }
}
