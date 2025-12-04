// ═══════════════════════════════════════════════════════════════
// TYPES PRINCIPAUX - UGC AI GENERATOR
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// ENUMS / TYPES UTILITAIRES
// ─────────────────────────────────────────────────────────────────
export type LocationType = 
  | "bedroom" 
  | "living_room" 
  | "kitchen" 
  | "bathroom" 
  | "office_desk"
  | "car"
  | "street_urban"
  | "cafe"
  | "park_outdoor"
  | "neutral_background";

export type PostureType =
  | "sitting_bed"
  | "sitting_couch"
  | "sitting_desk"
  | "sitting_car"
  | "standing_casual"
  | "standing_mirror"
  | "walking"
  | "leaning";

export type LightingType =
  | "soft_warm"
  | "bright_natural"
  | "golden_hour"
  | "neutral_daylight"
  | "moody_low"
  | "ring_light";

export type ExpressionType =
  | "neutral_relaxed"
  | "thoughtful"
  | "excited"
  | "curious"
  | "frustrated"
  | "relieved"
  | "confident"
  | "surprised";

export type GestureType =
  | "neutral"           // Mains naturelles, pas de geste particulier
  | "pointing_camera"   // Pointe vers la caméra / spectateur
  | "pointing_self"     // Se pointe elle-même
  | "open_palm"         // Main ouverte, geste d'explication
  | "thumbs_up"         // Pouce levé
  | "counting_fingers"  // Compte sur ses doigts
  | "holding_product"   // Tient/montre un produit
  | "showing_phone"     // Montre son téléphone
  | "thinking_pose"     // Menton sur main, réflexive
  | "shrug"             // Hausse les épaules (confusion/surprise)
  | "hand_on_chest"     // Main sur le coeur (sincérité)
  | "waving";           // Fait coucou

export type SceneModeType = "single_location" | "multi_location";

export type CameraStyleType =
  | "handheld_shaky"    // Très dynamique, mouvement visible (street hype, FOMO)
  | "handheld_subtle"   // Légères micro-vibrations naturelles (confession, authentique)
  | "stable";           // Stable, peu de mouvement (product focus, professionnel)

export type ToneType =
  | "vulnerable"
  | "energetic"
  | "conversational"
  | "authoritative"
  | "playful"
  | "urgent";

export type ScriptBeat = "hook" | "problem" | "agitation" | "solution" | "proof" | "cta";

export type ProductHoldingType = 
  | "holding_box"
  | "holding_bottle"
  | "showing_phone_screen"
  | "pointing_at"
  | "none";

export type VideoEngine = "veo3.1"; // Uniquement Veo3.1 - le meilleur rapport qualité/prix

export type CampaignStatus = "draft" | "generating" | "completed" | "failed";

export type ClipStatus = "pending" | "generating_frame" | "generating_video" | "generating_voice" | "generating_ambient" | "completed" | "failed";

// ─────────────────────────────────────────────────────────────────
// ACTEUR IA
// ─────────────────────────────────────────────────────────────────
export interface ActorAppearance {
  gender: "female" | "male" | "non-binary";
  age_range: string;
  ethnicity: string;
  hair: string;
  distinctive_features: string;
}

export interface ActorVoice {
  reference_audio_url: string;
  voice_style: string;
}

export interface ActorIntentionMedia {
  image_url?: string;   // Image de l'acteur dans cette intention
  video_url?: string;   // Vidéo preview de l'acteur dans cette intention
  custom_frame_prompt?: string; // Prompt personnalisé pour la génération du first frame
}

export interface Actor {
  id: string;
  user_id: string;
  name: string;
  thumbnail_video_url: string;
  soul_image_url: string;
  voice: ActorVoice;
  appearance: ActorAppearance;
  is_custom: boolean;
  created_at: string;
  // Médias de l'acteur par intention/preset (image + vidéo)
  intention_media?: Record<string, ActorIntentionMedia>; // clé = preset_id
}

// ─────────────────────────────────────────────────────────────────
// PRESET D'INTENTION (Template Campagne)
// ─────────────────────────────────────────────────────────────────
export interface FirstFrameConfig {
  location: LocationType;
  posture: PostureType;
  lighting: LightingType;
  base_expression: ExpressionType;
  camera_angle: "selfie_front" | "selfie_slight_angle";
  extra_prompt: string;
  // Configuration multi-lieux
  scene_mode: SceneModeType;
  location_by_beat?: Partial<Record<ScriptBeat, LocationType>>; // Si multi_location
  // Style de caméra
  camera_style: CameraStyleType;
  camera_style_by_beat?: Partial<Record<ScriptBeat, CameraStyleType>>; // Override par beat
}

export interface ScriptConfig {
  tone: ToneType;
  structure: ScriptBeat[];
  hook_templates: string[];
  cta_templates: string[];
}

export interface AmbientConfig {
  prompt: string;
  intensity: "subtle" | "moderate" | "prominent";
}

export interface IntentionPreset {
  id: string;
  name: string;
  slug: string;
  description: string;
  thumbnail_url: string;
  first_frame: FirstFrameConfig;
  script: ScriptConfig;
  ambient_audio: AmbientConfig;
  suggested_total_duration: number;
  suggested_clip_count: number;
}

// ─────────────────────────────────────────────────────────────────
// PRODUIT (optionnel dans la campagne)
// ─────────────────────────────────────────────────────────────────
export interface ProductConfig {
  has_product: boolean;
  image_url?: string;
  holding_type?: ProductHoldingType;
  name?: string;
  description?: string;
}

// ─────────────────────────────────────────────────────────────────
// BRIEF UTILISATEUR
// ─────────────────────────────────────────────────────────────────
export type ScriptLanguage = 
  | "fr"      // Français (France métropolitaine)
  | "en-us"   // English (American)
  | "en-uk"   // English (British)
  | "es"      // Español (España)
  | "es-latam" // Español (Latinoamérica)
  | "de"      // Deutsch
  | "it"      // Italiano
  | "pt-br"   // Português (Brasil)
  | "pt"      // Português (Portugal)
  | "nl";     // Nederlands

export interface CampaignBrief {
  what_selling: string;
  pain_point: string;              // Le problème/frustration de l'audience
  target_audience?: string;
  key_benefits?: string[];
  target_duration: 15 | 30 | 45 | 60;
  language?: ScriptLanguage;       // Langue du script (défaut: fr)
}

// ─────────────────────────────────────────────────────────────────
// CLIP (entité indépendante pour Director Mode)
// ─────────────────────────────────────────────────────────────────
export interface ClipFirstFrame {
  prompt: string;
  image_url?: string;
  expression: ExpressionType;
  gesture: GestureType;           // Geste/pose de l'actrice pour ce clip
  location: LocationType;         // Lieu spécifique à ce clip
}

export interface ClipScript {
  text: string;
  word_count: number;
}

export interface ClipVideo {
  engine: VideoEngine;
  duration: 4 | 6 | 8;
  prompt: string;
  // Vidéo brute générée par Veo3 (avec audio original)
  raw_url?: string;
  // Vidéo finale avec audio mixé
  final_url?: string;
  camera_style: CameraStyleType;
}

export interface ClipAudio {
  // Audio source (extrait de la vidéo Veo3)
  source_audio_url?: string;
  // Audio transformé par Chatterbox S2S
  transformed_voice_url?: string;
  // Ambiance générée (ElevenLabs SFX)
  ambient_url?: string;
  // Volumes (0-100)
  voice_volume: number;    // Défaut: 100
  ambient_volume: number;  // Défaut: 20
  // Audio final mixé (voix + ambiance)
  final_audio_url?: string;
}

// ─────────────────────────────────────────────────────────────────
// TRANSCRIPTION (Whisper)
// ─────────────────────────────────────────────────────────────────
export interface WhisperChunk {
  timestamp: [number, number];  // [start, end] en secondes
  text: string;
}

export interface ClipTranscription {
  text: string;                 // Texte complet transcrit
  chunks: WhisperChunk[];       // Timestamps mot par mot
  speech_start?: number;        // Début de la parole détecté (secondes)
  speech_end?: number;          // Fin de la parole détectée (secondes)
  confidence?: 'high' | 'medium' | 'low';  // Confiance de l'analyse
  words_per_second?: number;    // Débit de parole mesuré
  suggested_speed?: number;     // Vitesse suggérée (1.0 - 1.2, UGC = pas de ralentissement)
}

export interface CampaignClip {
  id: string;
  campaign_id: string;
  order: number;
  beat: ScriptBeat;
  first_frame: ClipFirstFrame;
  script: ClipScript;
  video: ClipVideo;
  audio: ClipAudio;
  transcription?: ClipTranscription;  // Transcription Whisper avec timestamps
  status: ClipStatus;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────
// CAMPAGNE (Projet utilisateur)
// ─────────────────────────────────────────────────────────────────
export interface Campaign {
  id: string;
  user_id: string;
  actor_id: string;
  preset_id: string;
  product: ProductConfig;
  brief: CampaignBrief;
  status: CampaignStatus;
  clips?: CampaignClip[];
  final_video_url?: string;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────
// TYPES POUR L'UI (Flow de création)
// ─────────────────────────────────────────────────────────────────
// First frames générés (pour éviter de regénérer)
export interface GeneratedFirstFrames {
  [clipIndex: number]: {
    url: string;
    generatedAt: number; // timestamp
  };
}

// Ajustements vidéo (trim + vitesse) par clip
export interface ClipAdjustments {
  trimStart: number;      // Secondes depuis le début
  trimEnd: number;        // Secondes depuis le début (fin du clip)
  speed: number;          // 0.8, 0.9, 1.0, 1.1, 1.2
}

export interface NewCampaignState {
  step: 1 | 2 | 3 | 4 | 5 | 6;
  campaign_id?: string; // ID de la campagne une fois créée (pour persistance URL)
  actor_id?: string;
  product: ProductConfig;
  preset_id?: string;
  brief: Partial<CampaignBrief>;
  generated_clips?: CampaignClip[];
  generated_first_frames?: GeneratedFirstFrames; // Cache des first frames
}

// ─────────────────────────────────────────────────────────────────
// DATABASE TYPES (pour Supabase)
// ─────────────────────────────────────────────────────────────────
export interface Database {
  public: {
    Tables: {
      actors: {
        Row: Actor;
        Insert: Omit<Actor, 'id' | 'created_at'>;
        Update: Partial<Omit<Actor, 'id' | 'created_at'>>;
      };
      intention_presets: {
        Row: IntentionPreset;
        Insert: Omit<IntentionPreset, 'id'>;
        Update: Partial<Omit<IntentionPreset, 'id'>>;
      };
      campaigns: {
        Row: Campaign;
        Insert: Omit<Campaign, 'id' | 'created_at' | 'updated_at' | 'clips'>;
        Update: Partial<Omit<Campaign, 'id' | 'created_at' | 'updated_at' | 'clips'>>;
      };
      campaign_clips: {
        Row: CampaignClip;
        Insert: Omit<CampaignClip, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CampaignClip, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
  };
}

