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

