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







