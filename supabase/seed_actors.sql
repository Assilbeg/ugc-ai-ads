-- ═══════════════════════════════════════════════════════════════
-- SEED: Acteurs présets
-- À exécuter dans Supabase SQL Editor pour initialiser les acteurs
-- ═══════════════════════════════════════════════════════════════

-- Note: Remplacez les URLs par vos vraies images uploadées dans Supabase Storage

INSERT INTO actors (id, name, soul_image_url, thumbnail_video_url, voice, appearance, is_custom, user_id) VALUES
(
  'preset-luna',
  'Luna',
  'https://your-supabase-url.supabase.co/storage/v1/object/public/actors/luna-soul.jpg',
  'https://your-supabase-url.supabase.co/storage/v1/object/public/actors/luna-preview.mp4',
  '{"reference_audio_url": "https://your-supabase-url.supabase.co/storage/v1/object/public/audio/luna-voice.mp3", "voice_style": "warm, friendly"}',
  '{"gender": "female", "age_range": "25-30", "ethnicity": "European", "hair": "long brown wavy", "distinctive_features": "warm smile, freckles"}',
  false,
  NULL
),
(
  'preset-marc',
  'Marc',
  'https://your-supabase-url.supabase.co/storage/v1/object/public/actors/marc-soul.jpg',
  'https://your-supabase-url.supabase.co/storage/v1/object/public/actors/marc-preview.mp4',
  '{"reference_audio_url": "https://your-supabase-url.supabase.co/storage/v1/object/public/audio/marc-voice.mp3", "voice_style": "confident, energetic"}',
  '{"gender": "male", "age_range": "28-35", "ethnicity": "Mediterranean", "hair": "short dark", "distinctive_features": "defined jawline, stubble"}',
  false,
  NULL
),
(
  'preset-jade',
  'Jade',
  'https://your-supabase-url.supabase.co/storage/v1/object/public/actors/jade-soul.jpg',
  'https://your-supabase-url.supabase.co/storage/v1/object/public/actors/jade-preview.mp4',
  '{"reference_audio_url": "https://your-supabase-url.supabase.co/storage/v1/object/public/audio/jade-voice.mp3", "voice_style": "bright, youthful"}',
  '{"gender": "female", "age_range": "22-28", "ethnicity": "Asian", "hair": "medium black straight", "distinctive_features": "bright eyes, youthful"}',
  false,
  NULL
),
(
  'preset-alex',
  'Alex',
  'https://your-supabase-url.supabase.co/storage/v1/object/public/actors/alex-soul.jpg',
  'https://your-supabase-url.supabase.co/storage/v1/object/public/actors/alex-preview.mp4',
  '{"reference_audio_url": "https://your-supabase-url.supabase.co/storage/v1/object/public/audio/alex-voice.mp3", "voice_style": "calm, professional"}',
  '{"gender": "male", "age_range": "30-38", "ethnicity": "Mixed", "hair": "short curly dark", "distinctive_features": "friendly face, warm eyes"}',
  false,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  soul_image_url = EXCLUDED.soul_image_url,
  thumbnail_video_url = EXCLUDED.thumbnail_video_url,
  voice = EXCLUDED.voice,
  appearance = EXCLUDED.appearance;

