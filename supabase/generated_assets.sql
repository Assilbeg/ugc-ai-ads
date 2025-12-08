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






