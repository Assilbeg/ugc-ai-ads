'use client'

import { useState, useCallback, useRef } from 'react'
import { CampaignClip, ClipStatus, Actor } from '@/types'

interface GenerationProgress {
  clipId: string
  status: ClipStatus
  progress: number
  message: string
}

// Type pour spécifier quel asset régénérer
export type RegenerateWhat = 'frame' | 'video' | 'voice' | 'ambient' | 'all'

export function useVideoGeneration() {
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<Record<string, GenerationProgress>>({})
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // ══════════════════════════════════════════════════════════════
  // GÉNÉRATION COMPLÈTE D'UN CLIP
  // ══════════════════════════════════════════════════════════════
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
      // ────────────────────────────────────────────────────────────
      // ÉTAPE 1 : First Frame - RÉUTILISER SI DÉJÀ GÉNÉRÉ
      // ────────────────────────────────────────────────────────────
      let frameUrl = clip.first_frame.image_url
      
      if (frameUrl) {
        // First frame déjà généré à l'étape du plan, on le réutilise !
        console.log('[Generation] ✓ Réutilisation du first frame existant:', frameUrl.slice(0, 50))
        updateProgress('generating_frame', 15, 'First frame existant ✓')
      } else {
        // Pas de first frame, on le génère
        updateProgress('generating_frame', 10, 'Création du premier plan...')
        
        const intentionMedia = presetId && actor.intention_media?.[presetId]
        const intentionImageUrl = intentionMedia?.image_url
        
        const frameResponse = await fetch('/api/generate/first-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            soulImageUrl: actor.soul_image_url,
            prompt: clip.first_frame.prompt,
            presetId: presetId,
            intentionImageUrl: intentionImageUrl,
            actorId: actor.id,
          }),
          signal: abortControllerRef.current?.signal,
        })

        if (!frameResponse.ok) {
          const err = await frameResponse.json()
          throw new Error(err.error || 'Erreur génération image')
        }
        const frameData = await frameResponse.json()
        frameUrl = frameData.url || frameData.imageUrl
      }
      
      // ────────────────────────────────────────────────────────────
      // ÉTAPE 2 : Vidéo - LE PLUS COÛTEUX
      // ────────────────────────────────────────────────────────────
      updateProgress('generating_video', 25, 'Génération de la vidéo...')

      console.log('[Generation] Video params:', {
        frameUrl: frameUrl?.slice(0, 80),
        prompt: clip.video.prompt?.slice(0, 50),
        duration: clip.video.duration,
      })

      if (!frameUrl) {
        throw new Error('First frame URL manquant pour la génération vidéo')
      }

      const videoResponse = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: clip.video.prompt,
          firstFrameUrl: frameUrl,
          engine: 'veo3.1',
          duration: clip.video.duration,
        }),
        signal: abortControllerRef.current?.signal,
      })

      if (!videoResponse.ok) {
        const err = await videoResponse.json()
        throw new Error(err.error || 'Erreur génération vidéo')
      }
      const videoData = await videoResponse.json()
      const rawVideoUrl = videoData.videoUrl

      // ────────────────────────────────────────────────────────────
      // ÉTAPE 3 : Speech-to-Speech (Chatterbox HD)
      // On passe l'URL de la vidéo comme source audio
      // ────────────────────────────────────────────────────────────
      updateProgress('generating_voice', 60, 'Transformation de la voix...')

      const targetVoiceUrl = actor.voice?.reference_audio_url
      console.log('[Generation] Voice params:', {
        sourceAudioUrl: rawVideoUrl?.slice(0, 50),
        targetVoiceUrl: targetVoiceUrl?.slice(0, 50),
        actorHasVoice: !!actor.voice,
      })

      if (!targetVoiceUrl) {
        throw new Error('L\'acteur n\'a pas de voix de référence configurée')
      }

      const voiceResponse = await fetch('/api/generate/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceAudioUrl: rawVideoUrl,
          targetVoiceUrl: targetVoiceUrl,
        }),
        signal: abortControllerRef.current?.signal,
      })

      if (!voiceResponse.ok) {
        const err = await voiceResponse.json()
        throw new Error(err.error || 'Erreur transformation voix')
      }
      const voiceData = await voiceResponse.json()

      // ────────────────────────────────────────────────────────────
      // ÉTAPE 4 : Ambiance (ElevenLabs SFX)
      // ────────────────────────────────────────────────────────────
      updateProgress('generating_ambient', 85, 'Génération de l\'ambiance...')

      const ambientResponse = await fetch('/api/generate/ambient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: ambientPrompt,
          duration: clip.video.duration + 2,
        }),
        signal: abortControllerRef.current?.signal,
      })

      if (!ambientResponse.ok) {
        const err = await ambientResponse.json()
        throw new Error(err.error || 'Erreur génération ambiance')
      }
      const ambientData = await ambientResponse.json()

      updateProgress('completed', 100, 'Terminé !')

      // ────────────────────────────────────────────────────────────
      // RETOUR DU CLIP MIS À JOUR
      // ────────────────────────────────────────────────────────────
      return {
        ...clip,
        first_frame: {
          ...clip.first_frame,
          image_url: frameUrl,
        },
        video: {
          ...clip.video,
          raw_url: rawVideoUrl,
          final_url: undefined, // Sera défini après mixage
        },
        audio: {
          source_audio_url: rawVideoUrl,
          transformed_voice_url: voiceData.audioUrl,
          ambient_url: ambientData.audioUrl,
          voice_volume: 100,
          ambient_volume: 20,
          final_audio_url: undefined, // Sera défini après mixage
        },
        status: 'completed',
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        updateProgress('failed', 0, 'Annulé')
        return null
      }
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue'
      updateProgress('failed', 0, errorMsg)
      console.error('[Generation] Clip failed:', errorMsg)
      return null
    }
  }, [])

  // ══════════════════════════════════════════════════════════════
  // RÉGÉNÉRATION PARTIELLE D'UN ASSET
  // ══════════════════════════════════════════════════════════════
  const regenerateAsset = useCallback(async (
    clip: CampaignClip,
    actor: Actor,
    what: RegenerateWhat,
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
      let updatedClip = { ...clip }

      // ── RÉGÉNÉRER FIRST FRAME ──
      if (what === 'frame' || what === 'all') {
        updateProgress('generating_frame', 25, 'Régénération de l\'image...')
        
        const intentionMedia = presetId && actor.intention_media?.[presetId]
        const frameResponse = await fetch('/api/generate/first-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            soulImageUrl: actor.soul_image_url,
            prompt: clip.first_frame.prompt,
            presetId,
            intentionImageUrl: intentionMedia?.image_url,
            actorId: actor.id,
            skipCache: true, // Forcer régénération
          }),
          signal: abortControllerRef.current?.signal,
        })

        if (!frameResponse.ok) throw new Error('Erreur régénération image')
        const frameData = await frameResponse.json()
        updatedClip.first_frame = { ...updatedClip.first_frame, image_url: frameData.url || frameData.imageUrl }
      }

      // ── RÉGÉNÉRER VIDÉO ── (le plus cher !)
      if (what === 'video' || what === 'all') {
        updateProgress('generating_video', 50, 'Régénération de la vidéo...')
        
        const frameUrl = updatedClip.first_frame.image_url
        if (!frameUrl) throw new Error('First frame requis pour générer la vidéo')

        const videoResponse = await fetch('/api/generate/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: clip.video.prompt,
            firstFrameUrl: frameUrl,
            engine: 'veo3.1',
            duration: clip.video.duration,
          }),
          signal: abortControllerRef.current?.signal,
        })

        if (!videoResponse.ok) throw new Error('Erreur régénération vidéo')
        const videoData = await videoResponse.json()
        updatedClip.video = { 
          ...updatedClip.video, 
          raw_url: videoData.videoUrl,
          final_url: undefined 
        }
        updatedClip.audio = { 
          ...updatedClip.audio, 
          source_audio_url: videoData.videoUrl,
          voice_volume: updatedClip.audio?.voice_volume ?? 100,
          ambient_volume: updatedClip.audio?.ambient_volume ?? 20,
        }
      }

      // ── RÉGÉNÉRER VOIX ── (pas cher)
      if (what === 'voice' || what === 'all') {
        updateProgress('generating_voice', 75, 'Régénération de la voix...')
        
        const sourceAudioUrl = updatedClip.video.raw_url || updatedClip.audio?.source_audio_url
        if (!sourceAudioUrl) throw new Error('Vidéo source requise pour transformer la voix')

        const voiceResponse = await fetch('/api/generate/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceAudioUrl,
            targetVoiceUrl: actor.voice.reference_audio_url,
          }),
          signal: abortControllerRef.current?.signal,
        })

        if (!voiceResponse.ok) throw new Error('Erreur régénération voix')
        const voiceData = await voiceResponse.json()
        updatedClip.audio = { 
          ...updatedClip.audio, 
          transformed_voice_url: voiceData.audioUrl,
          voice_volume: updatedClip.audio?.voice_volume ?? 100,
          ambient_volume: updatedClip.audio?.ambient_volume ?? 20,
        }
      }

      // ── RÉGÉNÉRER AMBIANCE ── (pas cher)
      if (what === 'ambient' || what === 'all') {
        updateProgress('generating_ambient', 90, 'Régénération de l\'ambiance...')

        const ambientResponse = await fetch('/api/generate/ambient', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: ambientPrompt,
            duration: clip.video.duration + 2,
          }),
          signal: abortControllerRef.current?.signal,
        })

        if (!ambientResponse.ok) throw new Error('Erreur régénération ambiance')
        const ambientData = await ambientResponse.json()
        updatedClip.audio = { 
          ...updatedClip.audio, 
          ambient_url: ambientData.audioUrl,
          voice_volume: updatedClip.audio?.voice_volume ?? 100,
          ambient_volume: updatedClip.audio?.ambient_volume ?? 20,
        }
      }

      updateProgress('completed', 100, 'Régénération terminée !')
      return { ...updatedClip, status: 'completed' }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        updateProgress('failed', 0, 'Annulé')
        return null
      }
      updateProgress('failed', 0, err instanceof Error ? err.message : 'Erreur')
      return null
    }
  }, [])

  // ══════════════════════════════════════════════════════════════
  // GÉNÉRATION DE TOUS LES CLIPS
  // ══════════════════════════════════════════════════════════════
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
        .then(result => result || { 
          ...clip, 
          status: 'failed' as const,
          audio: { voice_volume: 100, ambient_volume: 20 }
        })
    )

    const results = await Promise.all(promises)

    setGenerating(false)
    return results
  }, [generateClipAssets])

  // ══════════════════════════════════════════════════════════════
  // RÉGÉNÉRATION D'UN SEUL CLIP (complet ou partiel)
  // ══════════════════════════════════════════════════════════════
  const regenerateSingleClip = useCallback(async (
    clip: CampaignClip,
    actor: Actor,
    campaignId: string,
    ambientPrompt: string,
    what: RegenerateWhat,
    presetId?: string
  ): Promise<CampaignClip | null> => {
    setGenerating(true)
    setError(null)
    abortControllerRef.current = new AbortController()

    let result: CampaignClip | null = null

    if (what === 'all') {
      result = await generateClipAssets(clip, actor, campaignId, ambientPrompt, presetId)
    } else {
      result = await regenerateAsset(clip, actor, what, ambientPrompt, presetId)
    }

    setGenerating(false)
    return result
  }, [generateClipAssets, regenerateAsset])

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
