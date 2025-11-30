'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  NewCampaignState, 
  ProductConfig, 
  CampaignBrief, 
  CampaignClip,
  Actor,
  IntentionPreset 
} from '@/types'
import { getPresetById } from '@/lib/presets'

const INITIAL_STATE: NewCampaignState = {
  step: 1,
  product: { has_product: false },
  brief: {},
}

export function useCampaignCreation() {
  const router = useRouter()
  const supabase = createClient()
  const [state, setState] = useState<NewCampaignState>(INITIAL_STATE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Navigation
  const nextStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      step: Math.min(prev.step + 1, 6) as 1 | 2 | 3 | 4 | 5 | 6,
    }))
  }, [])

  const prevStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      step: Math.max(prev.step - 1, 1) as 1 | 2 | 3 | 4 | 5 | 6,
    }))
  }, [])

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= state.step) {
      setState(prev => ({ ...prev, step: step as 1 | 2 | 3 | 4 | 5 | 6 }))
    }
  }, [state.step])

  // Updates
  const setActorId = useCallback((actor_id: string) => {
    setState(prev => ({ ...prev, actor_id }))
  }, [])

  const setProduct = useCallback((product: ProductConfig) => {
    setState(prev => ({ ...prev, product }))
  }, [])

  const setPresetId = useCallback((preset_id: string) => {
    setState(prev => ({ ...prev, preset_id }))
  }, [])

  const setBrief = useCallback((brief: Partial<CampaignBrief>) => {
    setState(prev => ({ ...prev, brief }))
  }, [])

  const setGeneratedClips = useCallback((clips: CampaignClip[]) => {
    setState(prev => ({ ...prev, generated_clips: clips }))
  }, [])

  // Get current preset
  const getCurrentPreset = useCallback((): IntentionPreset | undefined => {
    return state.preset_id ? getPresetById(state.preset_id) : undefined
  }, [state.preset_id])

  // Save campaign to database
  const saveCampaign = useCallback(async (): Promise<string | null> => {
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      // Create campaign
      const { data: campaign, error: campaignError } = await (supabase
        .from('campaigns') as any)
        .insert({
          user_id: user.id,
          actor_id: state.actor_id,
          preset_id: state.preset_id,
          product: state.product,
          brief: state.brief,
          status: 'draft',
        })
        .select()
        .single()

      if (campaignError) throw campaignError

      // Save clips if generated
      if (state.generated_clips && state.generated_clips.length > 0) {
        const clipsToInsert = state.generated_clips.map(clip => ({
          campaign_id: campaign.id,
          order: clip.order,
          beat: clip.beat,
          first_frame: clip.first_frame,
          script: clip.script,
          video: clip.video,
          audio: clip.audio || {},
          status: 'pending',
        }))

        const { error: clipsError } = await (supabase
          .from('campaign_clips') as any)
          .insert(clipsToInsert)

        if (clipsError) throw clipsError
      }

      return campaign.id
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de sauvegarde')
      return null
    } finally {
      setSaving(false)
    }
  }, [state, supabase])

  // Validation
  const canProceed = useCallback((step: number): boolean => {
    switch (step) {
      case 1: return !!state.actor_id
      case 2: return true // Product is optional
      case 3: return !!state.preset_id
      case 4: return !!(state.brief.what_selling && state.brief.what_selling.length > 10 && state.brief.target_duration)
      case 5: return !!(state.generated_clips && state.generated_clips.length > 0)
      default: return false
    }
  }, [state])

  // Reset
  const reset = useCallback(() => {
    setState(INITIAL_STATE)
    setError(null)
  }, [])

  return {
    state,
    saving,
    error,
    // Navigation
    nextStep,
    prevStep,
    goToStep,
    // Updates
    setActorId,
    setProduct,
    setPresetId,
    setBrief,
    setGeneratedClips,
    // Helpers
    getCurrentPreset,
    canProceed,
    saveCampaign,
    reset,
  }
}

