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

-- ═══════════════════════════════════════════════════════════════
-- BILLING SYSTEM - SUPABASE SCHEMA
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- TABLE: user_credits
-- Solde et infos billing par utilisateur
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  -- Solde en centimes (1 crédit = 0.01€)
  balance INTEGER NOT NULL DEFAULT 0,
  -- Stripe
  stripe_customer_id VARCHAR(255),
  -- Abonnement actif
  subscription_tier VARCHAR(50) DEFAULT 'free', -- free, early_bird, starter, pro, business
  subscription_stripe_id VARCHAR(255),
  subscription_status VARCHAR(50) DEFAULT 'none', -- none, active, canceled, past_due
  subscription_current_period_end TIMESTAMP WITH TIME ZONE,
  -- Early Bird eligibility (24h après inscription)
  early_bird_eligible_until TIMESTAMP WITH TIME ZONE,
  early_bird_used BOOLEAN DEFAULT false,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche rapide par user_id et stripe_customer_id
CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX idx_user_credits_stripe_customer_id ON user_credits(stripe_customer_id);

-- ─────────────────────────────────────────────────────────────────
-- TABLE: credit_transactions
-- Historique de chaque mouvement de crédits
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Montant en centimes (positif = ajout, négatif = dépense)
  amount INTEGER NOT NULL,
  -- Solde après transaction
  balance_after INTEGER NOT NULL,
  -- Type de transaction
  type VARCHAR(50) NOT NULL CHECK (type IN ('purchase', 'usage', 'bonus', 'refund', 'subscription_credit')),
  -- Description lisible
  description TEXT NOT NULL,
  -- Détails pour les usages
  generation_type VARCHAR(50), -- first_frame, video_veo31, voice_chatterbox, ambient_elevenlabs
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  clip_id UUID,
  -- Référence Stripe pour les achats
  stripe_payment_intent_id VARCHAR(255),
  stripe_invoice_id VARCHAR(255),
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche par user et date
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(type);

-- ─────────────────────────────────────────────────────────────────
-- TABLE: subscription_plans
-- Plans d'abonnement configurables (admin)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE subscription_plans (
  id VARCHAR(50) PRIMARY KEY, -- early_bird, starter, pro, business
  name VARCHAR(100) NOT NULL,
  description TEXT,
  -- Prix en centimes
  price_cents INTEGER NOT NULL,
  -- Crédits inclus par mois (en centimes)
  monthly_credits INTEGER NOT NULL,
  -- Stripe Price ID
  stripe_price_id VARCHAR(255),
  -- Flags
  is_early_bird BOOLEAN DEFAULT false,
  is_one_time BOOLEAN DEFAULT false, -- true pour Early Bird
  is_active BOOLEAN DEFAULT true,
  -- Ordre d'affichage
  display_order INTEGER DEFAULT 0,
  -- Features pour l'affichage
  features JSONB DEFAULT '[]',
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- TABLE: generation_costs
-- Coûts par type de génération (configurable admin)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE generation_costs (
  id VARCHAR(50) PRIMARY KEY, -- first_frame, video_veo31, voice_chatterbox, ambient_elevenlabs
  name VARCHAR(100) NOT NULL,
  description TEXT,
  -- Coût en centimes (ce qu'on facture au user)
  cost_cents INTEGER NOT NULL,
  -- Coût réel Fal.ai en centimes (pour référence)
  real_cost_cents INTEGER,
  -- Actif
  is_active BOOLEAN DEFAULT true,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- TRIGGERS: Update updated_at
-- ─────────────────────────────────────────────────────────────────
CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generation_costs_updated_at
  BEFORE UPDATE ON generation_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────
-- FUNCTION: Create user_credits on signup
-- Appelée automatiquement quand un user s'inscrit
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_user_credits_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_credits (
    user_id,
    balance,
    early_bird_eligible_until
  ) VALUES (
    NEW.id,
    100, -- 100 centimes = 1€ de crédits offerts (~5-6 first frames)
    NOW() + INTERVAL '24 hours' -- Early Bird pendant 24h
  );
  
  -- Log la transaction bonus
  INSERT INTO public.credit_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description
  ) VALUES (
    NEW.id,
    100,
    100,
    'bonus',
    'Crédits de bienvenue'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur inscription
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_credits_on_signup();

-- ─────────────────────────────────────────────────────────────────
-- FUNCTION: Deduct credits (appelée par l'API)
-- NOTE: Autorise les balances négatives pour éviter les pertes
-- sur race conditions (génération déjà payée côté API externe)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_generation_type VARCHAR(50) DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL,
  p_clip_id UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT balance INTO v_current_balance
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_current_balance IS NULL THEN
    RETURN QUERY SELECT false, 0, 'User credits not found'::TEXT;
    RETURN;
  END IF;
  
  -- NOTE: On autorise les balances négatives intentionnellement
  -- Le check côté app bloque les nouvelles générations si balance < coût
  -- Mais si une génération est déjà lancée (et payée côté Fal.ai),
  -- on doit pouvoir la facturer même si ça passe en négatif
  
  -- Deduct credits (peut passer en négatif)
  v_new_balance := v_current_balance - p_amount;
  
  UPDATE user_credits
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Log transaction
  INSERT INTO credit_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    generation_type,
    campaign_id,
    clip_id
  ) VALUES (
    p_user_id,
    -p_amount,
    v_new_balance,
    'usage',
    p_description,
    p_generation_type,
    p_campaign_id,
    p_clip_id
  );
  
  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────
-- FUNCTION: Add credits (appelée par webhook Stripe)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_type VARCHAR(50) DEFAULT 'purchase',
  p_stripe_payment_intent_id VARCHAR(255) DEFAULT NULL,
  p_stripe_invoice_id VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Lock the row
  SELECT balance INTO v_current_balance
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_current_balance IS NULL THEN
    RETURN QUERY SELECT false, 0, 'User credits not found'::TEXT;
    RETURN;
  END IF;
  
  -- Add credits
  v_new_balance := v_current_balance + p_amount;
  
  UPDATE user_credits
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Log transaction
  INSERT INTO credit_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    stripe_payment_intent_id,
    stripe_invoice_id
  ) VALUES (
    p_user_id,
    p_amount,
    v_new_balance,
    p_type,
    p_description,
    p_stripe_payment_intent_id,
    p_stripe_invoice_id
  );
  
  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- user_credits: users can only see their own
CREATE POLICY "Users can view their own credits" ON user_credits
  FOR SELECT
  USING (user_id = auth.uid());

-- credit_transactions: users can only see their own
CREATE POLICY "Users can view their own transactions" ON credit_transactions
  FOR SELECT
  USING (user_id = auth.uid());

-- subscription_plans: public read (no RLS needed, managed by admin)
-- generation_costs: public read (no RLS needed, managed by admin)

-- ─────────────────────────────────────────────────────────────────
-- SEED DATA: Default plans and costs
-- ─────────────────────────────────────────────────────────────────

-- Plans par défaut
INSERT INTO subscription_plans (id, name, description, price_cents, monthly_credits, is_early_bird, is_one_time, display_order, features) VALUES
  ('early_bird', 'Early Bird', 'Offre spéciale 24h - Première campagne', 2500, 700, true, true, 0, 
   '["6-7 vidéos Veo 3.1", "Valable à vie", "Offre limitée 24h"]'::jsonb),
  ('starter', 'Starter', 'Idéal pour démarrer', 10000, 10000, false, false, 1,
   '["~14 vidéos complètes/mois", "Support email", "Accès à tous les acteurs"]'::jsonb),
  ('pro', 'Pro', 'Pour les créateurs réguliers', 25000, 30000, false, false, 2,
   '["~42 vidéos complètes/mois", "Support prioritaire", "Acteurs personnalisés"]'::jsonb),
  ('business', 'Business', 'Pour les agences', 50000, 75000, false, false, 3,
   '["~107 vidéos complètes/mois", "Support dédié", "API access", "Multi-users"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  monthly_credits = EXCLUDED.monthly_credits,
  features = EXCLUDED.features,
  updated_at = NOW();

-- Coûts de génération par défaut
-- ═══════════════════════════════════════════════════════════════
-- PRIX VÉRIFIÉS SUR FAL.AI - Décembre 2024
-- ═══════════════════════════════════════════════════════════════
-- 
-- IMAGES:
--   Nano Banana Pro Edit: $0.15/image
--
-- VIDÉO VEO 3.1 (avec audio):
--   Standard: $0.40/seconde
--   Fast: $0.15/seconde
--
-- AUDIO:
--   Chatterbox Speech-to-Speech: $0.02/minute (~$0.01 pour 30s)
--   ElevenLabs Sound Effects v2: $0.002/seconde (~$0.02 pour 10s)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO generation_costs (id, name, description, cost_cents, real_cost_cents) VALUES
  -- Image (par image)
  ('first_frame', 'First Frame', 'Image Nano Banana Pro Edit - $0.15/image', 25, 15),
  
  -- Vidéo Veo 3.1 Standard (par seconde) - $0.40/s avec audio
  ('video_veo31_standard', 'Vidéo Veo 3.1 Standard', 'Prix PAR SECONDE - $0.40/s avec audio', 60, 40),
  
  -- Vidéo Veo 3.1 Fast (par seconde) - $0.15/s avec audio  
  ('video_veo31_fast', 'Vidéo Veo 3.1 Fast', 'Prix PAR SECONDE - $0.15/s avec audio', 25, 15),
  
  -- Voice Conversion (par conversion ~30s)
  ('voice_chatterbox', 'Voice Conversion', 'Chatterbox HD S2S - $0.02/min', 20, 1),
  
  -- Ambient Audio (par génération ~10s)
  ('ambient_elevenlabs', 'Ambient Audio', 'ElevenLabs Sound Effects v2 - $0.002/s', 15, 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  cost_cents = EXCLUDED.cost_cents,
  real_cost_cents = EXCLUDED.real_cost_cents,
  updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- TABLE: campaign_assemblies
-- Historique des assemblages pour chaque campagne (versioning)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE campaign_assemblies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  final_video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds NUMERIC(6,2),
  -- Ajustements appliqués à chaque clip lors de l'assemblage
  clip_adjustments JSONB NOT NULL DEFAULT '[]',
  -- clip_adjustments: [{ clip_order: 1, trim_start: 0, trim_end: 6, speed: 1.0, cloudinary_id: "..." }, ...]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour récupérer rapidement les assemblages d'une campagne
CREATE INDEX idx_campaign_assemblies_campaign_id ON campaign_assemblies(campaign_id);

-- Index pour récupérer le dernier assemblage
CREATE INDEX idx_campaign_assemblies_latest ON campaign_assemblies(campaign_id, created_at DESC);

-- Trigger pour auto-incrémenter la version par campagne
CREATE OR REPLACE FUNCTION set_assembly_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := COALESCE(
    (SELECT MAX(version) + 1 FROM campaign_assemblies WHERE campaign_id = NEW.campaign_id),
    1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_increment_assembly_version
  BEFORE INSERT ON campaign_assemblies
  FOR EACH ROW
  EXECUTE FUNCTION set_assembly_version();

-- ─────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE campaign_assemblies ENABLE ROW LEVEL SECURITY;

-- Users can view assemblies of their campaigns
CREATE POLICY "Users can view assemblies of their campaigns" ON campaign_assemblies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_assemblies.campaign_id 
      AND campaigns.user_id = auth.uid()
    )
  );

-- Users can create assemblies for their campaigns
CREATE POLICY "Users can create assemblies for their campaigns" ON campaign_assemblies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_assemblies.campaign_id 
      AND campaigns.user_id = auth.uid()
    )
  );

-- Users can delete assemblies of their campaigns
CREATE POLICY "Users can delete assemblies of their campaigns" ON campaign_assemblies
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_assemblies.campaign_id 
      AND campaigns.user_id = auth.uid()
    )
  );





-- ═══════════════════════════════════════════════════════════════
-- TABLE: generated_assets
-- Stocke toutes les images/assets générées pour réutilisation
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE generated_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identification de l'asset
  asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('first_frame', 'video', 'audio', 'ambient')),
  
  -- Contexte de génération
  actor_id UUID REFERENCES actors(id) ON DELETE SET NULL,
  preset_id VARCHAR(100),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Prompt utilisé (pour matching exact)
  prompt TEXT NOT NULL,
  prompt_hash VARCHAR(64) NOT NULL, -- SHA256 du prompt pour recherche rapide
  
  -- Résultat
  url TEXT NOT NULL,
  
  -- Métadonnées
  generation_cost DECIMAL(10, 4), -- Coût en euros
  generation_time_ms INTEGER, -- Temps de génération
  model_used VARCHAR(100), -- ex: "fal-ai/flux-pro"
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  use_count INTEGER DEFAULT 1
);

-- Index pour recherche rapide par hash du prompt
CREATE INDEX idx_generated_assets_prompt_hash ON generated_assets(prompt_hash);

-- Index pour recherche par acteur
CREATE INDEX idx_generated_assets_actor_id ON generated_assets(actor_id);

-- Index pour recherche par type + acteur
CREATE INDEX idx_generated_assets_type_actor ON generated_assets(asset_type, actor_id);

-- Index composé pour le matching exact
CREATE INDEX idx_generated_assets_match ON generated_assets(asset_type, actor_id, prompt_hash);

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: Incrémenter le compteur d'utilisation
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION increment_asset_use_count(asset_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE generated_assets 
  SET 
    use_count = use_count + 1,
    last_used_at = NOW()
  WHERE id = asset_id;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE generated_assets ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les assets (pour réutilisation)
CREATE POLICY "Anyone can read assets" ON generated_assets
  FOR SELECT USING (true);

-- Seuls les utilisateurs authentifiés peuvent créer des assets
CREATE POLICY "Authenticated users can create assets" ON generated_assets
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Pas de suppression directe (nettoyage par job scheduled)





-- ═══════════════════════════════════════════════════════════════
-- GENERATION LOGS - Track every Fal.ai API call
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- TABLE: generation_logs
-- Logs each individual generation with costs and timing
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE generation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- What was generated
  generation_type VARCHAR(50) NOT NULL, -- first_frame, video_veo31, voice_chatterbox, ambient_elevenlabs
  model_path VARCHAR(255) NOT NULL, -- e.g., fal-ai/veo3.1/image-to-video
  
  -- Fal.ai request tracking
  fal_request_id VARCHAR(255), -- The request_id from Fal.ai queue response
  
  -- Input parameters (for debugging/auditing)
  input_params JSONB DEFAULT '{}',
  -- { prompt, duration, image_url, etc. }
  
  -- Output
  output_url TEXT, -- URL of the generated asset
  output_metadata JSONB DEFAULT '{}',
  -- { file_size, dimensions, duration_seconds, etc. }
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER, -- How long the generation took
  
  -- Costs
  estimated_cost_cents INTEGER, -- What we estimated before
  actual_cost_cents INTEGER, -- Actual cost from Fal.ai (if available)
  billed_cost_cents INTEGER, -- What we billed the user
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  
  -- Links
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  clip_id UUID,
  credit_transaction_id UUID, -- Link to credit_transactions for reconciliation
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_generation_logs_user_id ON generation_logs(user_id);
CREATE INDEX idx_generation_logs_created_at ON generation_logs(created_at DESC);
CREATE INDEX idx_generation_logs_generation_type ON generation_logs(generation_type);
CREATE INDEX idx_generation_logs_status ON generation_logs(status);
CREATE INDEX idx_generation_logs_campaign_id ON generation_logs(campaign_id);
CREATE INDEX idx_generation_logs_fal_request_id ON generation_logs(fal_request_id);

-- ─────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE generation_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own logs
CREATE POLICY "Users can view their own generation logs" ON generation_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────
-- VIEWS for Admin Dashboard
-- ─────────────────────────────────────────────────────────────────

-- Daily generation stats
CREATE OR REPLACE VIEW generation_stats_daily AS
SELECT 
  DATE(created_at) as date,
  generation_type,
  COUNT(*) as count,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  AVG(duration_ms) as avg_duration_ms,
  SUM(estimated_cost_cents) as total_estimated_cost,
  SUM(actual_cost_cents) as total_actual_cost,
  SUM(billed_cost_cents) as total_billed
FROM generation_logs
GROUP BY DATE(created_at), generation_type
ORDER BY date DESC, generation_type;

-- Cost comparison per type
CREATE OR REPLACE VIEW generation_cost_analysis AS
SELECT 
  generation_type,
  COUNT(*) as total_generations,
  AVG(estimated_cost_cents) as avg_estimated_cost,
  AVG(actual_cost_cents) as avg_actual_cost,
  AVG(billed_cost_cents) as avg_billed_cost,
  AVG(duration_ms) / 1000.0 as avg_duration_seconds,
  SUM(actual_cost_cents) as total_actual_cost,
  SUM(billed_cost_cents) as total_billed,
  SUM(billed_cost_cents) - SUM(actual_cost_cents) as total_margin
FROM generation_logs
WHERE status = 'completed' AND actual_cost_cents IS NOT NULL
GROUP BY generation_type;




-- ═══════════════════════════════════════════════════════════════
-- TABLE: system_prompts
-- Stores editable system prompts (Claude, NanoBanana, etc.)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS system_prompts (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger for updated_at
CREATE TRIGGER update_system_prompts_updated_at
  BEFORE UPDATE ON system_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default prompts
INSERT INTO system_prompts (id, name, description, prompt) VALUES
(
  'claude_script',
  'Claude - Génération Script',
  'System prompt pour la génération du plan et des scripts avec Claude',
  'Tu es un expert en publicité UGC (TikTok / Reels / Shorts) ET un "Sora 2 / Veo 3.1 Prompt Engineer" d''élite.

TA MISSION :
Générer un plan de campagne complet au format JSON, avec des prompts vidéo optimisés pour Sora 2 / Veo 3.1.

════════════════════════════════════════
0. SÉCURITÉ / CONFORMITÉ (OBLIGATOIRE)
════════════════════════════════════════

Tu génères uniquement du contenu publicitaire sûr et conforme :
- Pas de nudité explicite, pas de contenu sexualisé, pas d''actes/gestes sexuels.
- Adultes uniquement : jamais de mineurs, ni mention/implication de mineurs.
- Pas de violence graphique / gore / armes / auto-mutilation / drogues / actes illégaux.
- Pas de haine, harcèlement, slurs, stéréotypes sur groupes protégés.
- Pas de promesses mensongères : éviter "garanti", "100% sûr", "résultats certains".
  Préférer "peut aider", "souvent", "dans beaucoup de cas".
- Respect des droits/IP : pas d''UI exactes inventées, pas de logos/marques tierces imposées, pas de célébrités.

════════════════════════════════════════
1. RÈGLES D''OR DU SCRIPT AUDIO (CRITIQUE)
════════════════════════════════════════

Le Script audio doit être LITTÉRAL ET FERMÉ :
- Tu n''ajoutes aucun mot, interjection ou filler non demandé.
- Pas de "quoi / genre / tu vois / euh / etc." sauf demande explicite.
- Tu écris exactement ce qui doit être dit.

PRONONCIATION FRANÇAISE "SAFE" (OBLIGATOIRE) :
- PAS DE SIGLES / ABRÉVIATIONS dans le Script audio.
  Tu écris en TOUTES LETTRES :
  • "intelligence artificielle" (pas "IA")
  • "quarante-huit heures" (pas "48H")
  • "application" (pas "app")
  • "réseaux sociaux" (pas "social media")

- PAS D''ANGLICISMES À RISQUE : tu traduis en français naturel.
  • "responsable / directeur" (pas "manager")
  • "outil / plateforme" (pas "tool / software")
  • "exemples concrets" (pas "use cases")
  • "entretien d''embauche" (pas "interview")

════════════════════════════════════════
2. CONTRAINTES DE TEMPS STRICTES
════════════════════════════════════════

DURÉES POSSIBLES PAR MOTEUR :
- Veo 3.1 : 4s / 6s / 8s uniquement.
- Sora 2 : 4s / 8s / 12s uniquement.

BORNES DE MOTS :
- 4s ≈ 12–15 mots max
- 6s ≈ 18–22 mots max
- 8s ≈ 25–30 mots max
- 12s ≈ 40–45 mots max

Tu ne rends JAMAIS un clip hors-borne.

════════════════════════════════════════
3. RÈGLES D''OR DU PROMPT VIDÉO
════════════════════════════════════════

- Clean Feed : pas de texte/sous-titres générés
- Style UGC : 9:16, selfie handheld, lumière naturelle
- Smartphone Realism : iPhone-like front cam, micro-jitters, grain discret
- Imperfections humaines : texture peau naturelle, micro-expressions

════════════════════════════════════════
4. TEMPLATE DU PROMPT VIDÉO (OBLIGATOIRE)
════════════════════════════════════════

1. Scene Overview (1–2 phrases)
2. UGC Authenticity keywords
3. Descriptive Scene
4. Cinematography
5. Actions
6. Script audio (entre guillemets)
7. Sound / Background
8. NEGATIVES : "subtitles, captions, readable text, watermark, logo, UI overlays, floating icons, unrealistic lighting, cartoonish look, low resolution, poor focus, AI distortion, extra fingers, face warping, hard cuts, loud music, audio desync, inconsistent actor appearance, sexualized content, nudity, 3d render, professional studio lighting, tripod stability"

Tu retournes UNIQUEMENT du JSON valide.'
),
(
  'nanobanana_frame',
  'NanoBanana - First Frame',
  'Prompt template pour la génération des first frames avec NanoBanana Pro',
  'Make me another photo like this as if it was another first frame of the same TikTok UGC but in a different position since she''s talking to the camera. WEARING THE EXACT SAME CLOTHES AND OUTFIT as in the reference photo - do NOT change clothing. {PROMPT}. Vertical portrait format, natural lighting, authentic casual look, person looking at camera as if starting to record a TikTok video, realistic skin texture, high quality photograph, same person as reference, same clothing.'
),
(
  'negatives_default',
  'Negatives - Défaut',
  'Liste des negatives par défaut pour les prompts vidéo',
  'subtitles, captions, readable text, watermark, logo, UI overlays, floating icons, unrealistic lighting, cartoonish look, low resolution, poor focus, AI distortion, extra fingers, face warping, hard cuts, loud music, audio desync, inconsistent actor appearance, sexualized content, nudity, 3d render, professional studio lighting, tripod stability'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  prompt = EXCLUDED.prompt,
  updated_at = NOW();

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

