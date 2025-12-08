// ═══════════════════════════════════════════════════════════════
// CREDITS MANAGEMENT SYSTEM
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server'
import { ADMIN_EMAILS } from '@/lib/admin'

// Check if user email is admin (has unlimited credits)
export function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export type GenerationType = 
  | 'first_frame' 
  | 'video_veo31_standard'  // Veo 3.1 Standard - prix par seconde
  | 'video_veo31_fast'      // Veo 3.1 Fast - prix par seconde
  | 'voice_chatterbox' 
  | 'ambient_elevenlabs'

export interface UserCredits {
  id: string
  user_id: string
  balance: number
  stripe_customer_id: string | null
  subscription_tier: string
  subscription_stripe_id: string | null
  subscription_status: string
  subscription_current_period_end: string | null
  early_bird_eligible_until: string | null
  early_bird_used: boolean
  created_at: string
  updated_at: string
}

export interface GenerationCost {
  id: string
  name: string
  description: string | null
  cost_cents: number
  real_cost_cents: number | null
  is_active: boolean
}

export interface CreditTransaction {
  id: string
  user_id: string
  amount: number
  balance_after: number
  type: 'purchase' | 'usage' | 'bonus' | 'refund' | 'subscription_credit'
  description: string
  generation_type: GenerationType | null
  campaign_id: string | null
  clip_id: string | null
  stripe_payment_intent_id: string | null
  stripe_invoice_id: string | null
  created_at: string
}

export interface CreditsCheckResult {
  hasEnough: boolean
  currentBalance: number
  requiredAmount: number
  missingAmount: number
  isEarlyBirdEligible: boolean
  earlyBirdUsed: boolean
}

export interface DeductResult {
  success: boolean
  newBalance: number
  errorMessage: string | null
}

// ─────────────────────────────────────────────────────────────────
// GET USER CREDITS
// ─────────────────────────────────────────────────────────────────

export async function getUserCredits(userId: string): Promise<UserCredits | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  if (error) {
    console.error('Error fetching user credits:', error)
    return null
  }
  
  return data as UserCredits
}

// ─────────────────────────────────────────────────────────────────
// GET GENERATION COST
// ─────────────────────────────────────────────────────────────────

export async function getGenerationCost(
  generationType: GenerationType
): Promise<number> {
  const supabase = await createClient()
  
  const { data, error } = await (supabase
    .from('generation_costs') as any)
    .select('cost_cents')
    .eq('id', generationType)
    .eq('is_active', true)
    .single()
  
  if (error || !data) {
    // IMPORTANT: Tous les prix doivent être configurés dans l'admin
    // Si on arrive ici, c'est un problème de config
    console.error(`[Credits] Prix non trouvé pour ${generationType} - vérifier la table generation_costs`)
    throw new Error(`Prix non configuré pour ${generationType}. Configurer dans Admin > Billing.`)
  }
  
  return (data as { cost_cents: number }).cost_cents
}

// ─────────────────────────────────────────────────────────────────
// GET ALL GENERATION COSTS
// ─────────────────────────────────────────────────────────────────

export async function getAllGenerationCosts(): Promise<Record<string, number>> {
  const supabase = await createClient()
  
  const { data, error } = await (supabase
    .from('generation_costs') as any)
    .select('id, cost_cents')
    .eq('is_active', true)
  
  if (error || !data || data.length === 0) {
    // IMPORTANT: Tous les prix doivent être configurés dans l'admin
    console.error('[Credits] Aucun prix trouvé - vérifier la table generation_costs')
    throw new Error('Prix non configurés. Exécuter billing.sql ou configurer dans Admin > Billing.')
  }
  
  const costs: Record<string, number> = {}
  for (const item of data as { id: string; cost_cents: number }[]) {
    costs[item.id] = item.cost_cents
  }
  
  return costs
}

// ─────────────────────────────────────────────────────────────────
// CHECK IF USER HAS ENOUGH CREDITS
// ─────────────────────────────────────────────────────────────────

export async function checkCredits(
  userId: string,
  generationType: GenerationType,
  userEmail?: string
): Promise<CreditsCheckResult> {
  // Admin has unlimited credits
  if (userEmail && isAdminEmail(userEmail)) {
    return {
      hasEnough: true,
      currentBalance: Infinity,
      requiredAmount: 0,
      missingAmount: 0,
      isEarlyBirdEligible: false,
      earlyBirdUsed: false,
    }
  }

  const [userCredits, cost] = await Promise.all([
    getUserCredits(userId),
    getGenerationCost(generationType),
  ])
  
  if (!userCredits) {
    return {
      hasEnough: false,
      currentBalance: 0,
      requiredAmount: cost,
      missingAmount: cost,
      isEarlyBirdEligible: false,
      earlyBirdUsed: false,
    }
  }
  
  const hasEnough = userCredits.balance >= cost
  const missingAmount = hasEnough ? 0 : cost - userCredits.balance
  
  // Check Early Bird eligibility
  const now = new Date()
  const earlyBirdDeadline = userCredits.early_bird_eligible_until 
    ? new Date(userCredits.early_bird_eligible_until)
    : null
  const isEarlyBirdEligible = earlyBirdDeadline 
    ? now < earlyBirdDeadline && !userCredits.early_bird_used
    : false
  
  return {
    hasEnough,
    currentBalance: userCredits.balance,
    requiredAmount: cost,
    missingAmount,
    isEarlyBirdEligible,
    earlyBirdUsed: userCredits.early_bird_used,
  }
}

// ─────────────────────────────────────────────────────────────────
// CHECK CREDITS FOR MULTIPLE GENERATIONS
// ─────────────────────────────────────────────────────────────────

export async function checkCreditsForMultiple(
  userId: string,
  generations: { type: GenerationType; count: number }[],
  userEmail?: string
): Promise<CreditsCheckResult> {
  // Admin has unlimited credits
  if (userEmail && isAdminEmail(userEmail)) {
    return {
      hasEnough: true,
      currentBalance: Infinity,
      requiredAmount: 0,
      missingAmount: 0,
      isEarlyBirdEligible: false,
      earlyBirdUsed: false,
    }
  }

  const [userCredits, costs] = await Promise.all([
    getUserCredits(userId),
    getAllGenerationCosts(),
  ])
  
  // Calculate total required
  const totalRequired = generations.reduce((sum, gen) => {
    return sum + (costs[gen.type] * gen.count)
  }, 0)
  
  if (!userCredits) {
    return {
      hasEnough: false,
      currentBalance: 0,
      requiredAmount: totalRequired,
      missingAmount: totalRequired,
      isEarlyBirdEligible: false,
      earlyBirdUsed: false,
    }
  }
  
  const hasEnough = userCredits.balance >= totalRequired
  const missingAmount = hasEnough ? 0 : totalRequired - userCredits.balance
  
  // Check Early Bird eligibility
  const now = new Date()
  const earlyBirdDeadline = userCredits.early_bird_eligible_until 
    ? new Date(userCredits.early_bird_eligible_until)
    : null
  const isEarlyBirdEligible = earlyBirdDeadline 
    ? now < earlyBirdDeadline && !userCredits.early_bird_used
    : false
  
  return {
    hasEnough,
    currentBalance: userCredits.balance,
    requiredAmount: totalRequired,
    missingAmount,
    isEarlyBirdEligible,
    earlyBirdUsed: userCredits.early_bird_used,
  }
}

// ─────────────────────────────────────────────────────────────────
// ESTIMATE CAMPAIGN COST
// ─────────────────────────────────────────────────────────────────

export async function estimateCampaignCost(clipCount: number): Promise<{
  totalCost: number
  breakdown: {
    firstFrames: number
    videos: number
    voices: number
    ambients: number
  }
}> {
  const costs = await getAllGenerationCosts()
  
  // Each clip = 1 first frame + 1 video + 1 voice conversion + 1 ambient
  // NOTE: On utilise video_veo31_fast par défaut (le plus courant)
  const breakdown = {
    firstFrames: costs.first_frame * clipCount,
    videos: (costs.video_veo31_fast || costs.video_veo31_standard) * clipCount,
    voices: costs.voice_chatterbox * clipCount,
    ambients: costs.ambient_elevenlabs * clipCount,
  }
  
  const totalCost = breakdown.firstFrames + breakdown.videos + breakdown.voices + breakdown.ambients
  
  return { totalCost, breakdown }
}

// ─────────────────────────────────────────────────────────────────
// DEDUCT CREDITS (after successful generation)
// ─────────────────────────────────────────────────────────────────

export async function deductCredits(
  userId: string,
  generationType: GenerationType,
  description: string,
  campaignId?: string,
  clipId?: string,
  userEmail?: string
): Promise<DeductResult> {
  // Admin has unlimited credits - skip deduction
  if (userEmail && isAdminEmail(userEmail)) {
    console.log(`[Credits] Skipping deduction for admin: ${userEmail}`)
    return {
      success: true,
      newBalance: Infinity,
      errorMessage: null,
    }
  }

  const supabase = await createClient()
  const cost = await getGenerationCost(generationType)
  
  // Call the database function
  const { data, error } = await (supabase.rpc as any)('deduct_credits', {
    p_user_id: userId,
    p_amount: cost,
    p_description: description,
    p_generation_type: generationType,
    p_campaign_id: campaignId || null,
    p_clip_id: clipId || null,
  })
  
  if (error) {
    console.error('Error deducting credits:', error)
    return {
      success: false,
      newBalance: 0,
      errorMessage: error.message,
    }
  }
  
  const result = data?.[0]
  return {
    success: result?.success ?? false,
    newBalance: result?.new_balance ?? 0,
    errorMessage: result?.error_message ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────
// ADD CREDITS (called by Stripe webhook)
// ─────────────────────────────────────────────────────────────────

export async function addCredits(
  userId: string,
  amount: number,
  description: string,
  type: 'purchase' | 'bonus' | 'refund' | 'subscription_credit' = 'purchase',
  stripePaymentIntentId?: string,
  stripeInvoiceId?: string
): Promise<DeductResult> {
  const supabase = await createClient()
  
  // Call the database function
  const { data, error } = await (supabase.rpc as any)('add_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
    p_type: type,
    p_stripe_payment_intent_id: stripePaymentIntentId || null,
    p_stripe_invoice_id: stripeInvoiceId || null,
  })
  
  if (error) {
    console.error('Error adding credits:', error)
    return {
      success: false,
      newBalance: 0,
      errorMessage: error.message,
    }
  }
  
  const result = data?.[0]
  return {
    success: result?.success ?? false,
    newBalance: result?.new_balance ?? 0,
    errorMessage: result?.error_message ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────
// GET TRANSACTION HISTORY
// ─────────────────────────────────────────────────────────────────

export async function getTransactionHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<CreditTransaction[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  if (error) {
    console.error('Error fetching transaction history:', error)
    return []
  }
  
  return data as CreditTransaction[]
}

// ─────────────────────────────────────────────────────────────────
// UPDATE SUBSCRIPTION INFO
// ─────────────────────────────────────────────────────────────────

export async function updateSubscription(
  userId: string,
  updates: {
    subscription_tier?: string
    subscription_stripe_id?: string | null
    subscription_status?: string
    subscription_current_period_end?: string | null
    stripe_customer_id?: string
    early_bird_used?: boolean
  }
): Promise<boolean> {
  const supabase = await createClient()
  
  const { error } = await (supabase
    .from('user_credits') as any)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  
  if (error) {
    console.error('Error updating subscription:', error)
    return false
  }
  
  return true
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Format credits for display (en euros - legacy)
// ─────────────────────────────────────────────────────────────────

export function formatCredits(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Format credits as "X crédits" (user-facing)
// ─────────────────────────────────────────────────────────────────

export function formatAsCredits(credits: number): string {
  const formatted = new Intl.NumberFormat('fr-FR').format(credits)
  return `${formatted} crédit${credits !== 1 ? 's' : ''}`
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Estimate number of videos from credits (dynamic)
// ─────────────────────────────────────────────────────────────────

const DEFAULT_VIDEO_DURATION = 6 // secondes

export async function estimateVideosFromCredits(
  credits: number,
  clipCount: number = 5
): Promise<number> {
  const costs = await getAllGenerationCosts()
  
  // Coût par clip complet (first_frame + vidéo 6s + voice + ambient)
  const videoCost = costs.video_veo31_fast || costs.video_veo31_standard || 25
  const costPerClip = 
    (costs.first_frame || 25) + 
    (videoCost * DEFAULT_VIDEO_DURATION) + 
    (costs.voice_chatterbox || 20) + 
    (costs.ambient_elevenlabs || 15)
  
  // Coût d'une campagne complète
  const costPerCampaign = costPerClip * clipCount
  
  return Math.floor(credits / costPerCampaign)
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Get cost per video (for dynamic display)
// ─────────────────────────────────────────────────────────────────

export async function getCostPerVideo(clipCount: number = 5): Promise<number> {
  const costs = await getAllGenerationCosts()
  
  const videoCost = costs.video_veo31_fast || costs.video_veo31_standard || 25
  const costPerClip = 
    (costs.first_frame || 25) + 
    (videoCost * DEFAULT_VIDEO_DURATION) + 
    (costs.voice_chatterbox || 20) + 
    (costs.ambient_elevenlabs || 15)
  
  return costPerClip * clipCount
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Get remaining generations estimate
// ─────────────────────────────────────────────────────────────────

export async function getRemainingGenerations(balance: number): Promise<{
  firstFrames: number
  videos: number
  fullCampaigns: number
}> {
  const costs = await getAllGenerationCosts()
  
  // NOTE: On utilise video_veo31_fast par défaut (le plus courant)
  const videoCost = costs.video_veo31_fast || costs.video_veo31_standard
  
  // Cost per full campaign (4 clips)
  const campaignCost = 
    (costs.first_frame + videoCost + costs.voice_chatterbox + costs.ambient_elevenlabs) * 4
  
  return {
    firstFrames: Math.floor(balance / costs.first_frame),
    videos: Math.floor(balance / videoCost),
    fullCampaigns: Math.floor(balance / campaignCost),
  }
}

