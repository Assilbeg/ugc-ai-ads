'use client'

import { useState, useCallback, useRef } from 'react'
import { CampaignClip, ClipStatus, Actor } from '@/types'

interface GenerationProgress {
  clipId: string
  status: ClipStatus
  progress: number
  message: string
}

export function useVideoGeneration() {
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<Record<string, GenerationProgress>>({})
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const generateClipAssets = useCallback(async (
    clip: CampaignClip,
    actor: Actor,
    campaignId: string,
    ambientPrompt: string,
    presetId?: string
  ): Promise<CampaignClip | null> => {
    const clipId = clip.id || `clip-${clip.order}`

    const updateProgress = (status: ClipStatus, progressValue: number, message: string) => {
      setProgress(prev => ({
        ...prev,
        [clipId]: { clipId, status, progress: progressValue, message },
      }))
    }

    try {
      // Step 1: Generate first frame (25%)
      updateProgress('generating_frame', 10, 'Génération de l\'image...')
      
      // Utiliser l'intention_media si disponible pour cette intention
      const intentionMedia = presetId && actor.intention_media?.[presetId]
      const intentionImageUrl = intentionMedia?.image_url
      
      const frameResponse = await fetch('/api/generate/first-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soulImageUrl: actor.soul_image_url,
          prompt: clip.first_frame.prompt,
          presetId: presetId,
          intentionImageUrl: intentionImageUrl, // Image de l'acteur dans cette intention
        }),
        signal: abortControllerRef.current?.signal,
      })

      if (!frameResponse.ok) throw new Error('Erreur génération image')
      const frameData = await frameResponse.json()
      
      updateProgress('generating_video', 25, 'Génération de la vidéo...')

      // Step 2: Generate video (50%)
      const videoResponse = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: clip.video.prompt,
          firstFrameUrl: frameData.imageUrl,
          engine: clip.video.engine,
          duration: clip.video.duration,
        }),
        signal: abortControllerRef.current?.signal,
      })

      if (!videoResponse.ok) throw new Error('Erreur génération vidéo')
      const videoData = await videoResponse.json()

      updateProgress('generating_voice', 60, 'Clonage de la voix...')

      // Step 3: Clone voice with Chatterbox (75%)
      const voiceResponse = await fetch('/api/generate/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoData.videoUrl,
          referenceVoiceUrl: actor.voice.reference_audio_url,
          text: clip.script.text,
        }),
        signal: abortControllerRef.current?.signal,
      })

      if (!voiceResponse.ok) throw new Error('Erreur clonage voix')
      const voiceData = await voiceResponse.json()

      updateProgress('generating_ambient', 85, 'Génération de l\'ambiance...')

      // Step 4: Generate ambient audio (100%)
      const ambientResponse = await fetch('/api/generate/ambient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: ambientPrompt,
          duration: clip.video.duration + 2, // Slightly longer for transitions
        }),
        signal: abortControllerRef.current?.signal,
      })

      if (!ambientResponse.ok) throw new Error('Erreur génération ambiance')
      const ambientData = await ambientResponse.json()

      updateProgress('completed', 100, 'Terminé !')

      // Return updated clip
      return {
        ...clip,
        first_frame: {
          ...clip.first_frame,
          image_url: frameData.imageUrl,
        },
        video: {
          ...clip.video,
          url: videoData.videoUrl,
        },
        audio: {
          voice_url: voiceData.audioUrl,
          ambient_url: ambientData.audioUrl,
        },
        status: 'completed',
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        updateProgress('failed', 0, 'Annulé')
        return null
      }
      updateProgress('failed', 0, err instanceof Error ? err.message : 'Erreur')
      return null
    }
  }, [])

  const generateAllClips = useCallback(async (
    clips: CampaignClip[],
    actor: Actor,
    campaignId: string,
    ambientPrompt: string,
    presetId?: string
  ): Promise<CampaignClip[]> => {
    setGenerating(true)
    setError(null)
    abortControllerRef.current = new AbortController()

    // Génération parallèle de tous les clips
    const promises = clips.map(clip => 
      generateClipAssets(clip, actor, campaignId, ambientPrompt, presetId)
        .then(result => result || { ...clip, status: 'failed' as const })
    )

    const results = await Promise.all(promises)

    setGenerating(false)
    return results
  }, [generateClipAssets])

  const regenerateSingleClip = useCallback(async (
    clip: CampaignClip,
    actor: Actor,
    campaignId: string,
    ambientPrompt: string,
    what: 'frame' | 'video' | 'voice' | 'ambient' | 'all',
    presetId?: string
  ): Promise<CampaignClip | null> => {
    setGenerating(true)
    setError(null)
    abortControllerRef.current = new AbortController()

    let result: CampaignClip | null = null

    if (what === 'all') {
      result = await generateClipAssets(clip, actor, campaignId, ambientPrompt, presetId)
    } else {
      // Partial regeneration - TODO: implement individual asset regeneration
      result = await generateClipAssets(clip, actor, campaignId, ambientPrompt, presetId)
    }

    setGenerating(false)
    return result
  }, [generateClipAssets])

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    setGenerating(false)
  }, [])

  const getOverallProgress = useCallback((): number => {
    const progressValues = Object.values(progress)
    if (progressValues.length === 0) return 0
    return progressValues.reduce((sum, p) => sum + p.progress, 0) / progressValues.length
  }, [progress])

  return {
    generating,
    progress,
    error,
    generateAllClips,
    regenerateSingleClip,
    cancel,
    getOverallProgress,
  }
}

