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

export type VideoEngine = "veo3.1" | "sora2";

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
export interface CampaignBrief {
  what_selling: string;
  target_audience?: string;
  key_benefits?: string[];
  target_duration: 15 | 30 | 45 | 60;
}

// ─────────────────────────────────────────────────────────────────
// CLIP (entité indépendante pour Director Mode)
// ─────────────────────────────────────────────────────────────────
export interface ClipFirstFrame {
  prompt: string;
  image_url?: string;
  expression: ExpressionType;
}

export interface ClipScript {
  text: string;
  word_count: number;
}

export interface ClipVideo {
  engine: VideoEngine;
  duration: 4 | 6 | 8 | 12;
  prompt: string;
  url?: string;
}

export interface ClipAudio {
  voice_url?: string;
  ambient_url?: string;
  final_url?: string;
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
export interface NewCampaignState {
  step: 1 | 2 | 3 | 4 | 5 | 6;
  actor_id?: string;
  product: ProductConfig;
  preset_id?: string;
  brief: Partial<CampaignBrief>;
  generated_clips?: CampaignClip[];
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

