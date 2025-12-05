import { IntentionPreset } from '@/types'

export const INTENTION_PRESETS: IntentionPreset[] = [
  {
    id: 'confession-intime',
    name: 'Confession intime',
    slug: 'confession-intime',
    description: 'Partage personnel et vulnérable, comme si tu parlais à un ami proche',
    thumbnail_url: '/presets/confession-intime.jpg',
  filming_type: 'handheld',
    first_frame: {
      location: 'bedroom',
      posture: 'sitting_bed',
      lighting: 'moody_low',
      base_expression: 'thoughtful',
      camera_angle: 'selfie_front',
      extra_prompt: 'cozy atmosphere, soft shadows, intimate setting, casual home clothes, warm tones',
      scene_mode: 'single_location',
      camera_style: 'handheld_subtle',
    },
    script: {
      tone: 'vulnerable',
      structure: ['hook', 'problem', 'solution', 'cta'],
      hook_templates: [
        'Franchement j\'aurais jamais cru dire ça mais...',
        'Ok faut que je vous avoue un truc...',
        'Je sais pas pourquoi j\'ai attendu si longtemps pour en parler...',
      ],
      cta_templates: [
        'Le lien est en bio, sérieux testez',
        'Clique sur le lien, tu me remercieras',
      ],
    },
    ambient_audio: {
      prompt: 'quiet bedroom at night, soft distant traffic, occasional AC hum, very subtle',
      intensity: 'subtle',
    },
    suggested_total_duration: 30,
    suggested_clip_count: 4,
  },
  {
    id: 'morning-discovery',
    name: 'Morning discovery',
    slug: 'morning-discovery',
    description: 'Tu viens de découvrir un truc génial et tu partages ton enthousiasme',
    thumbnail_url: '/presets/morning-discovery.jpg',
  filming_type: 'handheld',
    first_frame: {
      location: 'kitchen',
      posture: 'standing_casual',
      lighting: 'bright_natural',
      base_expression: 'excited',
      camera_angle: 'selfie_front',
      extra_prompt: 'morning light through window, coffee mug visible, fresh awake look, casual morning outfit',
      scene_mode: 'single_location',
      camera_style: 'handheld_subtle',
    },
    script: {
      tone: 'energetic',
      structure: ['hook', 'solution', 'proof', 'cta'],
      hook_templates: [
        'Attendez j\'ai découvert un truc ce matin...',
        'Ok donc je viens de tomber sur ça et...',
        'Vous connaissez ce moment où tu trouves LA solution ?',
      ],
      cta_templates: [
        'Foncez le lien est en bio',
        'Allez checker ça maintenant',
      ],
    },
    ambient_audio: {
      prompt: 'morning kitchen sounds, birds outside, coffee machine distant, bright atmosphere',
      intensity: 'moderate',
    },
    suggested_total_duration: 25,
    suggested_clip_count: 3,
  },
  {
    id: 'street-hype',
    name: 'Street hype',
    slug: 'street-hype',
    description: 'Tu marches en ville et tu partages un tip en mode FOMO',
    thumbnail_url: '/presets/street-hype.jpg',
  filming_type: 'filmed_by_other',
    first_frame: {
      location: 'street_urban',
      posture: 'walking',
      lighting: 'neutral_daylight',
      base_expression: 'confident',
      camera_angle: 'selfie_slight_angle',
      extra_prompt: 'urban background blurred, casual streetwear, dynamic movement feel, city vibes',
      scene_mode: 'single_location',
      camera_style: 'handheld_shaky',
    },
    script: {
      tone: 'urgent',
      structure: ['hook', 'agitation', 'solution', 'cta'],
      hook_templates: [
        'Stop scroll faut que je te dise un truc',
        'Écoute-moi bien j\'ai pas beaucoup de temps',
        'Tu fais encore ça ? Arrête tout de suite',
      ],
      cta_templates: [
        'Le lien est là, bouge',
        'Clique maintenant avant que ça disparaisse',
      ],
    },
    ambient_audio: {
      prompt: 'city street ambient, distant traffic, footsteps, urban atmosphere, moderate noise',
      intensity: 'moderate',
    },
    suggested_total_duration: 20,
    suggested_clip_count: 3,
  },
  {
    id: 'chill-testimonial',
    name: 'Chill testimonial',
    slug: 'chill-testimonial',
    description: 'Témoignage détendu sur ton canapé, authentique et sincère',
    thumbnail_url: '/presets/chill-testimonial.jpg',
  filming_type: 'handheld',
    first_frame: {
      location: 'living_room',
      posture: 'sitting_couch',
      lighting: 'soft_warm',
      base_expression: 'neutral_relaxed',
      camera_angle: 'selfie_front',
      extra_prompt: 'comfortable couch, relaxed posture, home interior visible, casual vibes, cozy lighting',
      scene_mode: 'single_location',
      camera_style: 'handheld_subtle',
    },
    script: {
      tone: 'conversational',
      structure: ['hook', 'problem', 'solution', 'proof', 'cta'],
      hook_templates: [
        'Ok donc je voulais vous faire un retour rapide sur...',
        'Ça fait plusieurs semaines que j\'utilise ça et...',
        'Je sais que vous êtes beaucoup à demander mon avis sur...',
      ],
      cta_templates: [
        'Honnêtement allez voir par vous-même',
        'Le lien est en bio si ça vous intéresse',
      ],
    },
    ambient_audio: {
      prompt: 'quiet living room, very subtle room tone, occasional distant sounds, peaceful',
      intensity: 'subtle',
    },
    suggested_total_duration: 40,
    suggested_clip_count: 5,
  },
  {
    id: 'car-confession',
    name: 'Car confession',
    slug: 'car-confession',
    description: 'Dans ta voiture, moment de vérité entre deux trajets',
    thumbnail_url: '/presets/car-confession.jpg',
  filming_type: 'handheld',
    first_frame: {
      location: 'car',
      posture: 'sitting_car',
      lighting: 'neutral_daylight',
      base_expression: 'thoughtful',
      camera_angle: 'selfie_slight_angle',
      extra_prompt: 'car interior visible, seatbelt on, parked car, natural light through windows',
      scene_mode: 'single_location',
      camera_style: 'handheld_subtle',
    },
    script: {
      tone: 'conversational',
      structure: ['hook', 'problem', 'solution', 'cta'],
      hook_templates: [
        'Bon je suis dans ma voiture et faut qu\'on parle',
        'J\'ai pas pu attendre d\'être rentré pour vous dire ça',
        'Ok petit message rapide avant de partir...',
      ],
      cta_templates: [
        'Bref le lien est en bio',
        'Teste par toi-même, le lien est juste là',
      ],
    },
    ambient_audio: {
      prompt: 'car interior ambient, very subtle engine idle or silence, muffled outside traffic',
      intensity: 'subtle',
    },
    suggested_total_duration: 25,
    suggested_clip_count: 4,
  },
  {
    id: 'unboxing-product',
    name: 'Unboxing / Product',
    slug: 'unboxing-product',
    description: 'Focus produit avec démonstration, mains visibles',
    thumbnail_url: '/presets/unboxing-product.jpg',
  filming_type: 'setup_phone',
    first_frame: {
      location: 'neutral_background',
      posture: 'sitting_desk',
      lighting: 'ring_light',
      base_expression: 'excited',
      camera_angle: 'selfie_front',
      extra_prompt: 'clean background, product packaging visible, good lighting on face and hands, professional setup',
      scene_mode: 'single_location',
      camera_style: 'stable',
    },
    script: {
      tone: 'energetic',
      structure: ['hook', 'solution', 'proof', 'cta'],
      hook_templates: [
        'Ok j\'ai enfin reçu ça et...',
        'Vous m\'avez demandé de tester ce produit alors...',
        'First impressions sur ce truc dont tout le monde parle...',
      ],
      cta_templates: [
        'Le lien est en bio avec un code promo',
        'Foncez avant la rupture de stock',
      ],
    },
    ambient_audio: {
      prompt: 'quiet room, minimal ambient, focus on voice, very subtle room tone',
      intensity: 'subtle',
    },
    suggested_total_duration: 30,
    suggested_clip_count: 4,
  },
  {
    id: 'story-journey',
    name: 'Story Journey',
    slug: 'story-journey',
    description: 'Narration multi-lieux : tu racontes ton parcours avec le produit à travers différents moments de ta journée',
    thumbnail_url: '/presets/story-journey.jpg',
  filming_type: 'handheld',
    first_frame: {
      location: 'bedroom', // Lieu par défaut / premier clip
      posture: 'sitting_bed',
      lighting: 'soft_warm',
      base_expression: 'thoughtful',
      camera_angle: 'selfie_front',
      extra_prompt: 'authentic UGC vibes, different locations throughout the day',
      scene_mode: 'multi_location',
      location_by_beat: {
        hook: 'bedroom',           // Réveil, confession matinale
        problem: 'street_urban',   // En déplacement, stress quotidien
        solution: 'kitchen',       // Moment de découverte
        proof: 'living_room',      // Chill, résultats
        cta: 'bedroom',            // Retour intimité, sincérité
      },
      camera_style: 'handheld_subtle',
      camera_style_by_beat: {
        hook: 'handheld_subtle',   // Intimité
        problem: 'handheld_shaky', // Stress, urgence en déplacement
        solution: 'handheld_subtle',
        proof: 'stable',           // Crédibilité, résultats
        cta: 'handheld_subtle',    // Retour sincérité
      },
    },
    script: {
      tone: 'conversational',
      structure: ['hook', 'problem', 'solution', 'proof', 'cta'],
      hook_templates: [
        'Je dois vous raconter un truc qui m\'est arrivé...',
        'Laissez-moi vous partager mon parcours avec...',
        'Avant je galérais vraiment avec ça...',
      ],
      cta_templates: [
        'Si t\'es comme moi, le lien est en bio',
        'Franchement teste, tu verras la différence',
      ],
    },
    ambient_audio: {
      prompt: 'varied ambient sounds matching location changes, subtle transitions',
      intensity: 'moderate',
    },
    suggested_total_duration: 45,
    suggested_clip_count: 5,
  },
]

export function getPresetBySlug(slug: string): IntentionPreset | undefined {
  return INTENTION_PRESETS.find(p => p.slug === slug)
}

export function getPresetById(id: string): IntentionPreset | undefined {
  return INTENTION_PRESETS.find(p => p.id === id)
}

