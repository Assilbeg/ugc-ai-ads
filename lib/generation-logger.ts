// ═══════════════════════════════════════════════════════════════
// GENERATION LOGGER - Track every Fal.ai API call
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server'
import { GenerationType } from '@/lib/credits'

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface GenerationLog {
  id: string
  user_id: string
  generation_type: GenerationType
  model_path: string
  fal_request_id: string | null
  input_params: Record<string, unknown>
  output_url: string | null
  output_metadata: Record<string, unknown>
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  estimated_cost_cents: number | null
  actual_cost_cents: number | null
  billed_cost_cents: number | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message: string | null
  campaign_id: string | null
  clip_id: string | null
  credit_transaction_id: string | null
  created_at: string
}

export interface CreateLogParams {
  userId: string
  generationType: GenerationType
  modelPath: string
  inputParams?: Record<string, unknown>
  estimatedCostCents?: number
  campaignId?: string
  clipId?: string
}

export interface UpdateLogParams {
  falRequestId?: string
  outputUrl?: string
  outputMetadata?: Record<string, unknown>
  completedAt?: Date
  durationMs?: number
  actualCostCents?: number
  billedCostCents?: number
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage?: string
  creditTransactionId?: string
}

// ─────────────────────────────────────────────────────────────────
// ESTIMATED COSTS (based on Fal.ai pricing page)
// Updated: 2024-12
// ─────────────────────────────────────────────────────────────────

export const FAL_AI_COSTS = {
  // Images
  first_frame: {
    model: 'fal-ai/nano-banana-pro/edit',
    costPerUnit: 4, // $0.04 per image = 4 cents
    unit: 'image',
  },
  // Videos - Veo 3.1 (with audio)
  // Standard: $0.40/second, Fast: $0.15/second
  video_veo31: {
    model: 'fal-ai/veo3.1/image-to-video',
    costPerSecond: 40, // $0.40 per second = 40 cents (Standard)
    // 6s video = $2.40 = 240 cents
  },
  video_veo31_fast: {
    model: 'fal-ai/veo3.1/fast/image-to-video',
    costPerSecond: 15, // $0.15 per second = 15 cents (Fast)
    // 6s video = $0.90 = 90 cents
  },
  // Voice - estimate based on GPU time
  voice_chatterbox: {
    model: 'resemble-ai/chatterboxhd/speech-to-speech',
    costPerUnit: 15, // Estimated ~$0.15 per conversion
    unit: 'conversion',
  },
  // Audio SFX - estimate
  ambient_elevenlabs: {
    model: 'fal-ai/elevenlabs/sound-effects/v2',
    costPerUnit: 10, // Estimated ~$0.10 per generation
    unit: 'generation',
  },
} as const

// ─────────────────────────────────────────────────────────────────
// ESTIMATE COST
// ─────────────────────────────────────────────────────────────────

export type VideoQuality = 'standard' | 'fast'

export function estimateCost(
  generationType: GenerationType,
  params?: { durationSeconds?: number; quality?: VideoQuality }
): number {
  switch (generationType) {
    case 'first_frame':
      return FAL_AI_COSTS.first_frame.costPerUnit
    
    case 'video_veo31':
      const duration = params?.durationSeconds || 6
      const quality = params?.quality || 'standard'
      const costPerSecond = quality === 'fast' 
        ? FAL_AI_COSTS.video_veo31_fast.costPerSecond 
        : FAL_AI_COSTS.video_veo31.costPerSecond
      return costPerSecond * duration
    
    case 'voice_chatterbox':
      return FAL_AI_COSTS.voice_chatterbox.costPerUnit
    
    case 'ambient_elevenlabs':
      return FAL_AI_COSTS.ambient_elevenlabs.costPerUnit
    
    default:
      return 0
  }
}

// ─────────────────────────────────────────────────────────────────
// CREATE LOG (at start of generation)
// ─────────────────────────────────────────────────────────────────

export async function createGenerationLog(
  params: CreateLogParams
): Promise<string | null> {
  const supabase = await createClient()
  
  const modelPath = getModelPath(params.generationType)
  const estimatedCost = params.estimatedCostCents ?? estimateCost(
    params.generationType,
    { durationSeconds: (params.inputParams?.duration as number) }
  )
  
  const { data, error } = await (supabase
    .from('generation_logs') as any)
    .insert({
      user_id: params.userId,
      generation_type: params.generationType,
      model_path: modelPath,
      input_params: params.inputParams || {},
      estimated_cost_cents: estimatedCost,
      campaign_id: params.campaignId || null,
      clip_id: params.clipId || null,
      status: 'pending',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  
  if (error) {
    console.error('[GenerationLogger] Error creating log:', error)
    return null
  }
  
  console.log(`[GenerationLogger] Created log ${data.id} for ${params.generationType}`)
  return data.id
}

// ─────────────────────────────────────────────────────────────────
// UPDATE LOG (during/after generation)
// ─────────────────────────────────────────────────────────────────

export async function updateGenerationLog(
  logId: string,
  updates: UpdateLogParams
): Promise<boolean> {
  const supabase = await createClient()
  
  const updateData: Record<string, unknown> = {}
  
  if (updates.falRequestId !== undefined) updateData.fal_request_id = updates.falRequestId
  if (updates.outputUrl !== undefined) updateData.output_url = updates.outputUrl
  if (updates.outputMetadata !== undefined) updateData.output_metadata = updates.outputMetadata
  if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt.toISOString()
  if (updates.durationMs !== undefined) updateData.duration_ms = updates.durationMs
  if (updates.actualCostCents !== undefined) updateData.actual_cost_cents = updates.actualCostCents
  if (updates.billedCostCents !== undefined) updateData.billed_cost_cents = updates.billedCostCents
  if (updates.status !== undefined) updateData.status = updates.status
  if (updates.errorMessage !== undefined) updateData.error_message = updates.errorMessage
  if (updates.creditTransactionId !== undefined) updateData.credit_transaction_id = updates.creditTransactionId
  
  const { error } = await (supabase
    .from('generation_logs') as any)
    .update(updateData)
    .eq('id', logId)
  
  if (error) {
    console.error('[GenerationLogger] Error updating log:', error)
    return false
  }
  
  console.log(`[GenerationLogger] Updated log ${logId}`)
  return true
}

// ─────────────────────────────────────────────────────────────────
// MARK AS COMPLETED
// ─────────────────────────────────────────────────────────────────

export async function markGenerationCompleted(
  logId: string,
  outputUrl: string,
  startTime: number,
  billedCostCents?: number,
  outputMetadata?: Record<string, unknown>
): Promise<boolean> {
  const durationMs = Date.now() - startTime
  
  return updateGenerationLog(logId, {
    outputUrl,
    outputMetadata,
    completedAt: new Date(),
    durationMs,
    billedCostCents,
    status: 'completed',
  })
}

// ─────────────────────────────────────────────────────────────────
// MARK AS FAILED
// ─────────────────────────────────────────────────────────────────

export async function markGenerationFailed(
  logId: string,
  errorMessage: string,
  startTime?: number
): Promise<boolean> {
  const durationMs = startTime ? Date.now() - startTime : undefined
  
  return updateGenerationLog(logId, {
    completedAt: new Date(),
    durationMs,
    status: 'failed',
    errorMessage,
  })
}

// ─────────────────────────────────────────────────────────────────
// GET USER LOGS
// ─────────────────────────────────────────────────────────────────

export async function getUserGenerationLogs(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<GenerationLog[]> {
  const supabase = await createClient()
  
  const { data, error } = await (supabase
    .from('generation_logs') as any)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  if (error) {
    console.error('[GenerationLogger] Error fetching logs:', error)
    return []
  }
  
  return data as GenerationLog[]
}

// ─────────────────────────────────────────────────────────────────
// GET STATS
// ─────────────────────────────────────────────────────────────────

export async function getGenerationStats(
  userId?: string,
  days: number = 30
): Promise<{
  totalGenerations: number
  totalEstimatedCost: number
  totalActualCost: number
  totalBilled: number
  byType: Record<GenerationType, {
    count: number
    avgDurationMs: number
    totalCost: number
  }>
}> {
  const supabase = await createClient()
  
  let query = (supabase.from('generation_logs') as any)
    .select('generation_type, duration_ms, estimated_cost_cents, actual_cost_cents, billed_cost_cents, status')
    .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
  
  if (userId) {
    query = query.eq('user_id', userId)
  }
  
  const { data, error } = await query
  
  if (error || !data) {
    console.error('[GenerationLogger] Error fetching stats:', error)
    return {
      totalGenerations: 0,
      totalEstimatedCost: 0,
      totalActualCost: 0,
      totalBilled: 0,
      byType: {} as any,
    }
  }
  
  const logs = data as GenerationLog[]
  
  const byType: Record<string, { count: number; totalDuration: number; totalCost: number }> = {}
  let totalEstimated = 0
  let totalActual = 0
  let totalBilled = 0
  
  for (const log of logs) {
    if (!byType[log.generation_type]) {
      byType[log.generation_type] = { count: 0, totalDuration: 0, totalCost: 0 }
    }
    
    byType[log.generation_type].count++
    byType[log.generation_type].totalDuration += log.duration_ms || 0
    byType[log.generation_type].totalCost += log.actual_cost_cents || log.estimated_cost_cents || 0
    
    totalEstimated += log.estimated_cost_cents || 0
    totalActual += log.actual_cost_cents || 0
    totalBilled += log.billed_cost_cents || 0
  }
  
  const result: Record<GenerationType, { count: number; avgDurationMs: number; totalCost: number }> = {} as any
  
  for (const [type, stats] of Object.entries(byType)) {
    result[type as GenerationType] = {
      count: stats.count,
      avgDurationMs: stats.count > 0 ? Math.round(stats.totalDuration / stats.count) : 0,
      totalCost: stats.totalCost,
    }
  }
  
  return {
    totalGenerations: logs.length,
    totalEstimatedCost: totalEstimated,
    totalActualCost: totalActual,
    totalBilled: totalBilled,
    byType: result,
  }
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Get model path
// ─────────────────────────────────────────────────────────────────

function getModelPath(generationType: GenerationType): string {
  switch (generationType) {
    case 'first_frame':
      return FAL_AI_COSTS.first_frame.model
    case 'video_veo31':
      return FAL_AI_COSTS.video_veo31.model
    case 'video_veo31_fast':
      return FAL_AI_COSTS.video_veo31_fast.model
    case 'voice_chatterbox':
      return FAL_AI_COSTS.voice_chatterbox.model
    case 'ambient_elevenlabs':
      return FAL_AI_COSTS.ambient_elevenlabs.model
    default:
      return 'unknown'
  }
}

