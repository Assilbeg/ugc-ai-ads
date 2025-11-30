-- ═══════════════════════════════════════════════════════════════
-- UGC AI GENERATOR - SUPABASE SCHEMA
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────
-- TABLE: actors
-- Stores AI actors (preset + custom generated)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE actors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  thumbnail_video_url TEXT,
  soul_image_url TEXT NOT NULL,
  voice JSONB NOT NULL DEFAULT '{}',
  -- voice: { reference_audio_url: string, voice_style: string }
  appearance JSONB NOT NULL DEFAULT '{}',
  -- appearance: { gender, age_range, ethnicity, hair, distinctive_features }
  intention_media JSONB DEFAULT '{}',
  -- intention_media: { "preset-id": { image_url: "url", video_url: "url" }, ... }
  -- Médias de l'acteur pré-générés pour chaque intention/preset
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster user queries
CREATE INDEX idx_actors_user_id ON actors(user_id);

-- ─────────────────────────────────────────────────────────────────
-- TABLE: intention_presets
-- Stores campaign intention presets (templates)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE intention_presets (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  first_frame JSONB NOT NULL DEFAULT '{}',
  -- first_frame: { location, posture, lighting, base_expression, camera_angle, extra_prompt }
  script JSONB NOT NULL DEFAULT '{}',
  -- script: { tone, structure, hook_templates, cta_templates }
  ambient_audio JSONB NOT NULL DEFAULT '{}',
  -- ambient_audio: { prompt, intensity }
  suggested_total_duration INTEGER DEFAULT 30,
  suggested_clip_count INTEGER DEFAULT 4
);

-- ─────────────────────────────────────────────────────────────────
-- TABLE: campaigns
-- Main campaign/project table
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES actors(id) ON DELETE SET NULL,
  preset_id VARCHAR(100) REFERENCES intention_presets(id) ON DELETE SET NULL,
  product JSONB NOT NULL DEFAULT '{"has_product": false}',
  -- product: { has_product, image_url?, holding_type?, name?, description? }
  brief JSONB NOT NULL DEFAULT '{}',
  -- brief: { what_selling, target_audience?, key_benefits?, target_duration }
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'completed', 'failed')),
  final_video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- ─────────────────────────────────────────────────────────────────
-- TABLE: campaign_clips
-- Individual clips (Director Mode - each clip is independent)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE campaign_clips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  beat VARCHAR(20) NOT NULL CHECK (beat IN ('hook', 'problem', 'agitation', 'solution', 'proof', 'cta')),
  first_frame JSONB NOT NULL DEFAULT '{}',
  -- first_frame: { prompt, image_url?, expression }
  script JSONB NOT NULL DEFAULT '{}',
  -- script: { text, word_count }
  video JSONB NOT NULL DEFAULT '{}',
  -- video: { engine, duration, prompt, url? }
  audio JSONB NOT NULL DEFAULT '{}',
  -- audio: { voice_url?, ambient_url?, final_url? }
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
    'pending', 
    'generating_frame', 
    'generating_video', 
    'generating_voice', 
    'generating_ambient', 
    'completed', 
    'failed'
  )),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_campaign_clips_campaign_id ON campaign_clips(campaign_id);
CREATE INDEX idx_campaign_clips_order ON campaign_clips(campaign_id, "order");

-- ─────────────────────────────────────────────────────────────────
-- FUNCTION: Update updated_at timestamp
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_clips_updated_at
  BEFORE UPDATE ON campaign_clips
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ─────────────────────────────────────────────────────────────────

-- Enable RLS
ALTER TABLE actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_clips ENABLE ROW LEVEL SECURITY;

-- Actors policies
CREATE POLICY "Users can view preset actors" ON actors
  FOR SELECT
  USING (is_custom = false OR user_id = auth.uid());

CREATE POLICY "Users can create their own actors" ON actors
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own actors" ON actors
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own actors" ON actors
  FOR DELETE
  USING (user_id = auth.uid());

-- Campaigns policies
CREATE POLICY "Users can view their own campaigns" ON campaigns
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own campaigns" ON campaigns
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own campaigns" ON campaigns
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own campaigns" ON campaigns
  FOR DELETE
  USING (user_id = auth.uid());

-- Campaign clips policies (inherit from campaign ownership)
CREATE POLICY "Users can view clips of their campaigns" ON campaign_clips
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_clips.campaign_id 
      AND campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create clips for their campaigns" ON campaign_clips
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_clips.campaign_id 
      AND campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update clips of their campaigns" ON campaign_clips
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_clips.campaign_id 
      AND campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete clips of their campaigns" ON campaign_clips
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_clips.campaign_id 
      AND campaigns.user_id = auth.uid()
    )
  );

-- Presets are public (read-only for everyone)
-- No RLS needed as they're managed by admin

-- ─────────────────────────────────────────────────────────────────
-- STORAGE BUCKETS
-- ─────────────────────────────────────────────────────────────────
-- Run these in the Supabase dashboard > Storage

-- INSERT INTO storage.buckets (id, name, public) VALUES 
--   ('actors', 'actors', true),
--   ('products', 'products', true),
--   ('frames', 'frames', true),
--   ('videos', 'videos', true),
--   ('audio', 'audio', true);

-- Storage policies would be:
-- Actors bucket: public read, authenticated upload
-- Products bucket: public read, authenticated upload  
-- Frames/Videos/Audio: public read, authenticated upload

