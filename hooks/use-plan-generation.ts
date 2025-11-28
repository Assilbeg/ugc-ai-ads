'use client'

import { useState, useCallback } from 'react'
import { CampaignClip, Actor, IntentionPreset, CampaignBrief, ProductConfig } from '@/types'

interface GeneratePlanParams {
  actor: Actor
  preset: IntentionPreset
  brief: CampaignBrief
  product: ProductConfig
}

export function usePlanGeneration() {
  const [clips, setClips] = useState<CampaignClip[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generatePlan = useCallback(async (params: GeneratePlanParams) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/generate/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erreur de génération')
      }

      const data = await response.json()
      setClips(data.clips)
      return data.clips
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de génération'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const regenerateClip = useCallback(async (
    clipIndex: number, 
    preset: IntentionPreset,
    brief: CampaignBrief,
    feedback?: string
  ) => {
    const clip = clips[clipIndex]
    if (!clip) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/generate/regenerate-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip, preset, brief, feedback }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erreur de régénération')
      }

      const data = await response.json()
      
      // Update clip in array
      setClips(prev => prev.map((c, i) => 
        i === clipIndex ? { ...c, script: data.script } : c
      ))

      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de régénération'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [clips])

  const updateClipScript = useCallback((clipIndex: number, text: string) => {
    setClips(prev => prev.map((clip, i) => 
      i === clipIndex 
        ? { 
            ...clip, 
            script: { 
              ...clip.script, 
              text, 
              word_count: text.split(/\s+/).filter(Boolean).length 
            } 
          } 
        : clip
    ))
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return {
    clips,
    loading,
    error,
    generatePlan,
    regenerateClip,
    updateClipScript,
    clearError,
    setClips,
  }
}

