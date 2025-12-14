-- ═══════════════════════════════════════════════════════════════
-- CURRENCY CONFIGURATION - SUPABASE SCHEMA
-- ═══════════════════════════════════════════════════════════════
-- Ce script crée la table pour gérer les devises par langue
-- et les taux de change pour adapter les prix

-- ─────────────────────────────────────────────────────────────────
-- TABLE: currency_config
-- Configuration des devises par langue
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS currency_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Code de langue (fr, en, es, de, etc.)
  language_code VARCHAR(10) NOT NULL UNIQUE,
  -- Code ISO de la devise (EUR, USD, GBP, etc.)
  currency_code VARCHAR(3) NOT NULL,
  -- Symbole de la devise (€, $, £, etc.)
  currency_symbol VARCHAR(5) NOT NULL,
  -- Taux de change par rapport à EUR (EUR = 1.0)
  -- Ex: USD = 1.10 signifie 1€ = 1.10$
  exchange_rate DECIMAL(10, 4) NOT NULL DEFAULT 1.0,
  -- Devise par défaut (pour le fallback)
  is_default BOOLEAN DEFAULT false,
  -- Active ou non
  is_active BOOLEAN DEFAULT true,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche rapide par langue
CREATE INDEX IF NOT EXISTS idx_currency_config_language ON currency_config(language_code);
CREATE INDEX IF NOT EXISTS idx_currency_config_active ON currency_config(is_active);

-- ─────────────────────────────────────────────────────────────────
-- TRIGGER: Update updated_at
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_currency_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_currency_config_updated_at ON currency_config;
CREATE TRIGGER update_currency_config_updated_at
  BEFORE UPDATE ON currency_config
  FOR EACH ROW
  EXECUTE FUNCTION update_currency_config_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- SEED DATA: Default currency configurations
-- ─────────────────────────────────────────────────────────────────
-- Taux de change approximatifs (à mettre à jour régulièrement dans l'admin)
-- Base: 1 EUR = X devise

INSERT INTO currency_config (language_code, currency_code, currency_symbol, exchange_rate, is_default, is_active) VALUES
  -- Français (France) - EUR (devise de base)
  ('fr', 'EUR', '€', 1.0000, true, true),
  
  -- Anglais - USD (taux approximatif: 1€ ≈ 1.10$)
  ('en', 'USD', '$', 1.1000, false, true),
  
  -- Espagnol (Espagne) - EUR
  ('es', 'EUR', '€', 1.0000, false, true),
  
  -- Allemand - EUR
  ('de', 'EUR', '€', 1.0000, false, true),
  
  -- Italien - EUR
  ('it', 'EUR', '€', 1.0000, false, true),
  
  -- Portugais - EUR
  ('pt', 'EUR', '€', 1.0000, false, true),
  
  -- Néerlandais - EUR
  ('nl', 'EUR', '€', 1.0000, false, true)
ON CONFLICT (language_code) DO UPDATE SET
  currency_code = EXCLUDED.currency_code,
  currency_symbol = EXCLUDED.currency_symbol,
  exchange_rate = EXCLUDED.exchange_rate,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ─────────────────────────────────────────────────────────────────
-- NOTES:
-- ─────────────────────────────────────────────────────────────────
-- 
-- TAUX DE CHANGE:
-- - L'EUR est la devise de base (rate = 1.0)
-- - Les autres devises ont un taux par rapport à l'EUR
-- - Ex: USD à 1.10 signifie que 1€ = 1.10$
-- - Un produit à 10€ sera affiché à $11 pour les anglophones
--
-- COMPORTEMENT:
-- - Tous les prix en base de données restent en EUR (centimes)
-- - La conversion est faite à l'affichage côté client
-- - Le taux de change peut être modifié dans l'admin
--
-- POUR STRIPE:
-- - Les paiements Stripe se font toujours en EUR
-- - Le prix affiché au client est converti mais le paiement reste en EUR
-- ═══════════════════════════════════════════════════════════════
