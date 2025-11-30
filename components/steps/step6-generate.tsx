'use client'

import { useState, useEffect, useCallback } from 'react'
import { NewCampaignState, CampaignClip, ClipStatus, ClipAdjustments } from '@/types'
import { useVideoGeneration, RegenerateWhat } from '@/hooks/use-video-generation'
import { useActors } from '@/hooks/use-actors'
import { useCampaignCreation } from '@/hooks/use-campaign-creation'
import { getPresetById } from '@/lib/presets'
import { createClient } from '@/lib/supabase/client'
import { buildPreviewUrl, calculateAdjustedDuration } from '@/lib/api/cloudinary'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Loader2, Play, X, Video, Mic, Music, Maximize2, Clock, Scissors, Gauge, Eye, Check, RefreshCw, Film } from 'lucide-react'

// Vitesses disponibles
const SPEED_OPTIONS = [
  { value: 0.8, label: '0.8x' },
  { value: 0.9, label: '0.9x' },
  { value: 1.0, label: '1x' },
  { value: 1.1, label: '1.1x' },
  { value: 1.2, label: '1.2x' },
]

interface Step6GenerateProps {
  state: NewCampaignState
  onClipsUpdate: (clips: CampaignClip[]) => void
  onComplete: (campaignId: string) => void
  onBack: () => void
}

const BEAT_LABELS: Record<string, string> = {
  hook: 'HOOK',
  problem: 'PROBLÈME',
  agitation: 'AGITATION',
  solution: 'SOLUTION',
  proof: 'PREUVE',
  cta: 'CTA',
}

const BEAT_COLORS: Record<string, string> = {
  hook: 'bg-amber-500',
  problem: 'bg-red-500',
  agitation: 'bg-orange-500',
  solution: 'bg-emerald-500',
  proof: 'bg-blue-500',
  cta: 'bg-violet-500',
}

const STATUS_STEPS = [
  { status: 'generating_video', label: 'Vidéo', icon: Video, color: 'text-blue-500' },
  { status: 'generating_voice', label: 'Voix', icon: Mic, color: 'text-violet-500' },
  { status: 'generating_ambient', label: 'Ambiance', icon: Music, color: 'text-fuchsia-500' },
]

export function Step6Generate({ state, onClipsUpdate, onComplete, onBack }: Step6GenerateProps) {
  const { getActorById } = useActors()
  const { generating, progress, generateAllClips, regenerateSingleClip, cancel, getOverallProgress } = useVideoGeneration()
  const { saving } = useCampaignCreation()
  const supabase = createClient()
  
  const actor = state.actor_id ? getActorById(state.actor_id) : undefined
  const preset = state.preset_id ? getPresetById(state.preset_id) : undefined
  const clips = state.generated_clips || []
  
  // Vérifier si des vidéos ont déjà été générées (clips avec raw_url)
  const hasExistingVideos = clips.some(c => c.video?.raw_url)
  
  // Initialiser avec les clips existants s'ils ont des vidéos
  const [generatedClips, setGeneratedClips] = useState<CampaignClip[]>(() => {
    return hasExistingVideos ? clips : []
  })
  
  // Resynchroniser generatedClips quand state.generated_clips change
  // (ex: quand on revient de step5 avec des first frames modifiées)
  useEffect(() => {
    if (clips.length > 0) {
      // Fusionner les nouvelles données (first frames) avec les vidéos générées existantes
      const mergedClips = clips.map((clip, index) => {
        const existingGenerated = generatedClips[index]
        // Si on a une vidéo générée, garder les données de génération
        // mais mettre à jour la first frame si elle a changé
        if (existingGenerated?.video?.raw_url) {
          return {
            ...existingGenerated,
            first_frame: clip.first_frame, // Toujours prendre la first frame la plus récente
            script: clip.script, // Prendre le script mis à jour aussi
          }
        }
        return clip
      })
      
      // Ne mettre à jour que si quelque chose a changé
      const hasChanges = mergedClips.some((clip, index) => {
        const existing = generatedClips[index]
        return !existing || 
               clip.first_frame?.image_url !== existing.first_frame?.image_url ||
               clip.script?.text !== existing.script?.text
      })
      
      if (hasChanges) {
        console.log('[Step6] Resync clips from state:', mergedClips.length, 'clips')
        setGeneratedClips(mergedClips)
      }
    }
  }, [clips])
  const [campaignId, setCampaignId] = useState<string | null>(state.campaign_id || null)
  const [started, setStarted] = useState(hasExistingVideos) // Déjà "started" si on a des vidéos
  const [fullscreenVideo, setFullscreenVideo] = useState<string | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  
  // Ajustements vidéo (trim + vitesse) par clip
  const [adjustments, setAdjustments] = useState<Record<number, ClipAdjustments>>({})
  const [previewingClip, setPreviewingClip] = useState<number | null>(null)
  const [assembling, setAssembling] = useState(false)
  
  // Modal de confirmation pour régénération
  const [confirmRegen, setConfirmRegen] = useState<{
    clipIndex: number
    what: RegenerateWhat
    label: string
    warning?: string
  } | null>(null)

  // Initialiser les ajustements quand les clips changent
  useEffect(() => {
    const newAdjustments: Record<number, ClipAdjustments> = {}
    clips.forEach((clip, index) => {
      if (!adjustments[index]) {
        newAdjustments[index] = {
          trimStart: 0,
          trimEnd: clip.video.duration,
          speed: 1.0,
        }
      } else {
        newAdjustments[index] = adjustments[index]
      }
    })
    if (Object.keys(newAdjustments).length > 0) {
      setAdjustments(prev => ({ ...prev, ...newAdjustments }))
    }
  }, [clips.length])

  // Mettre à jour un ajustement
  const updateAdjustment = useCallback((index: number, update: Partial<ClipAdjustments>) => {
    setAdjustments(prev => ({
      ...prev,
      [index]: { ...prev[index], ...update, isApplied: false }
    }))
  }, [])

  // Reset les ajustements à leurs valeurs par défaut
  const resetAdjustments = useCallback((index: number) => {
    const clip = clips[index] || generatedClips[index]
    if (!clip) return
    
    setAdjustments(prev => ({
      ...prev,
      [index]: {
        trimStart: 0,
        trimEnd: clip.video.duration,
        speed: 1.0,
        isApplied: false,
        // Garder cloudinaryId si déjà uploadé
        cloudinaryId: prev[index]?.cloudinaryId,
      }
    }))
  }, [clips, generatedClips])

  // Appliquer les ajustements (uploader vers Cloudinary si nécessaire)
  const applyAdjustments = useCallback(async (index: number) => {
    const clip = generatedClips[index] || clips[index]
    let adj = adjustments[index]
    
    if (!clip?.video?.raw_url || !adj) return
    
    // Si pas encore uploadé sur Cloudinary, uploader d'abord
    if (!adj.cloudinaryId) {
      setAdjustments(prev => ({
        ...prev,
        [index]: { ...prev[index], isUploading: true }
      }))
      
      try {
        const response = await fetch('/api/cloudinary/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl: clip.video.raw_url })
        })
        
        if (!response.ok) throw new Error('Upload failed')
        
        const data = await response.json()
        adj = { ...adj, cloudinaryId: data.publicId }
        setAdjustments(prev => ({
          ...prev,
          [index]: { ...prev[index], cloudinaryId: data.publicId, isUploading: false }
        }))
      } catch (err) {
        console.error('Upload error:', err)
        setAdjustments(prev => ({
          ...prev,
          [index]: { ...prev[index], isUploading: false }
        }))
        return
      }
    }
    
    const cloudinaryUrl = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload/${adj.cloudinaryId}.mp4`
    const adjustedUrl = buildPreviewUrl(cloudinaryUrl, {
      trimStart: adj.trimStart,
      trimEnd: adj.trimEnd,
      speed: adj.speed
    })
    
    setAdjustments(prev => ({
      ...prev,
      [index]: { ...prev[index], adjustedUrl, isApplied: true, isUploading: false }
    }))
    
    // Mettre à jour le clip avec l'URL ajustée
    const updatedClips = [...generatedClips]
    if (updatedClips[index]) {
      updatedClips[index] = {
        ...updatedClips[index],
        video: {
          ...updatedClips[index].video,
          final_url: adjustedUrl
        }
      }
      setGeneratedClips(updatedClips)
      onClipsUpdate(updatedClips)
    }
  }, [adjustments, generatedClips, clips, onClipsUpdate])

  // Assembler la vidéo finale (applique les ajustements automatiquement)
  // Redirige IMMÉDIATEMENT et lance l'assemblage en arrière-plan
  const assembleVideo = useCallback(async () => {
    if (!campaignId) return
    
    setAssembling(true)
    
    try {
      // Préparer les données RAPIDEMENT (sans upload Cloudinary ici)
      // L'API fera les uploads si nécessaire
      const clipsForAssembly = generatedClips
        .filter(clip => clip?.video?.raw_url)
        .map((clip, index) => {
          const adj = adjustments[index]
          const trimStart = adj?.trimStart ?? 0
          const trimEnd = adj?.trimEnd ?? clip.video.duration
          const speed = adj?.speed ?? 1.0
          const trimmedDuration = trimEnd - trimStart
          const duration = trimmedDuration / speed
          
          return {
            rawUrl: clip.video.raw_url, // URL brute (l'API uploadera si besoin)
            duration,
            clipOrder: clip.order,
            trimStart,
            trimEnd,
            speed,
            cloudinaryId: adj?.cloudinaryId, // Peut être undefined
            originalDuration: clip.video.duration,
          }
        })
      
      // 1. Mettre le status à "assembling" AVANT de rediriger (await nécessaire!)
      await (supabase.from('campaigns') as any)
        .update({ status: 'assembling' })
        .eq('id', campaignId)
      
      // 2. Rediriger vers la page campagne avec le flag assembling
      // Le query param force l'affichage de l'animation même si le status n'est pas encore à jour
      window.location.href = `/campaign/${campaignId}?assembling=1`
      
      // 3. Lancer l'assemblage en arrière-plan (sans await)
      // L'API fera les uploads Cloudinary si nécessaire
      fetch('/api/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clips: clipsForAssembly,
          campaignId
        })
      }).catch(err => {
        console.error('[Assemble] Background error:', err)
      })
      
    } catch (err) {
      console.error('Assemble error:', err)
      setAssembling(false)
    }
  }, [campaignId, generatedClips, adjustments, onComplete, supabase])

  // ══════════════════════════════════════════════════════════════
  // SAUVEGARDE AUTOMATIQUE EN BASE
  // ══════════════════════════════════════════════════════════════
  
  // Créer la campagne en base
  const createCampaignInDb = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('User not authenticated')
        return null
      }

      const { data: campaign, error } = await supabase
        .from('campaigns')
        .insert({
          user_id: user.id,
          actor_id: state.actor_id,
          preset_id: state.preset_id,
          product: state.product,
          brief: state.brief,
          status: 'generating',
        } as any)
        .select()
        .single()

      if (error) {
        console.error('Error creating campaign:', error)
        return null
      }

      console.log('✓ Campaign created:', (campaign as any).id)
      return (campaign as any).id as string
    } catch (err) {
      console.error('Error creating campaign:', err)
      return null
    }
  }, [supabase, state.actor_id, state.preset_id, state.product, state.brief])

  // Sauvegarder les clips en base
  const saveClipsToDb = useCallback(async (dbCampaignId: string, clipsToSave: CampaignClip[]) => {
    if (!dbCampaignId || clipsToSave.length === 0) return

    setAutoSaveStatus('saving')

    try {
      // Supprimer les anciens clips et insérer les nouveaux (upsert simplifié)
      const { error: deleteError } = await supabase
        .from('campaign_clips')
        .delete()
        .eq('campaign_id', dbCampaignId)

      if (deleteError) {
        console.warn('Error deleting old clips:', deleteError)
      }

      const clipsToInsert = clipsToSave.map(clip => ({
        campaign_id: dbCampaignId,
        order: clip.order,
        beat: clip.beat,
        first_frame: clip.first_frame,
        script: clip.script,
        video: clip.video,
        audio: clip.audio || {},
        status: clip.status || 'pending',
      }))

      const { error: insertError } = await supabase
        .from('campaign_clips')
        .insert(clipsToInsert as any)

      if (insertError) {
        console.error('Error saving clips:', insertError)
        setAutoSaveStatus('error')
        return
      }

      console.log('✓ Clips auto-saved:', clipsToSave.length)
      setAutoSaveStatus('saved')
    } catch (err) {
      console.error('Error saving clips:', err)
      setAutoSaveStatus('error')
    }
  }, [supabase])

  // Mettre à jour le status de la campagne
  const updateCampaignStatus = useCallback(async (dbCampaignId: string, newStatus: 'generating' | 'completed' | 'failed') => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('campaigns') as any).update({ status: newStatus }).eq('id', dbCampaignId)
      
      console.log('✓ Campaign status updated:', newStatus)
    } catch (err) {
      console.error('Error updating campaign status:', err)
    }
  }, [supabase])

  // Track si on vient de générer de nouvelles vidéos (pas juste charger depuis la base)
  const [hasNewlyGeneratedClips, setHasNewlyGeneratedClips] = useState(false)

  // Auto-save UNIQUEMENT quand des clips sont NOUVELLEMENT générés (pas au chargement)
  useEffect(() => {
    if (campaignId && generatedClips.length > 0 && !campaignId.startsWith('temp-') && hasNewlyGeneratedClips) {
      // Sauvegarder les clips avec vidéo générée
      const clipsWithVideo = generatedClips.filter(c => c.video?.raw_url)
      if (clipsWithVideo.length > 0) {
        console.log('[AutoSave] Saving newly generated clips:', clipsWithVideo.length)
        saveClipsToDb(campaignId, generatedClips)
        setHasNewlyGeneratedClips(false) // Reset après sauvegarde
      }
    }
  }, [campaignId, generatedClips, saveClipsToDb, hasNewlyGeneratedClips])

  const handleStartGeneration = async () => {
    if (!actor || !preset || clips.length === 0) return

    setStarted(true)
    
    // Utiliser le campaign_id existant (depuis /new/[id]) ou en créer un nouveau
    let dbCampaignId: string | null = state.campaign_id || null
    
    if (!dbCampaignId) {
      // Pas de campaign_id dans le state, créer en base
      dbCampaignId = await createCampaignInDb()
      if (!dbCampaignId) {
        console.error('Failed to create campaign, using temp ID')
        setCampaignId(`temp-${Date.now()}`)
      } else {
        setCampaignId(dbCampaignId)
      }
    } else {
      // Campaign existe déjà, on l'utilise
      console.log('✓ Using existing campaign:', dbCampaignId)
      setCampaignId(dbCampaignId)
    }

    // Enrichir les clips avec les first frames générées à l'étape Plan
    // On utilise TOUJOURS la first frame de generated_first_frames si elle existe
    // car c'est la plus récente (peut avoir été régénérée)
    const clipsWithFirstFrames = clips.map((clip, index) => {
      const generatedFrame = state.generated_first_frames?.[index]
      if (generatedFrame?.url) {
        return {
          ...clip,
          first_frame: {
            ...clip.first_frame,
            image_url: generatedFrame.url
          }
        }
      }
      return clip
    })

    // Filtrer les clips qui n'ont pas encore de vidéo générée
    const clipsWithoutVideo = clipsWithFirstFrames.filter(c => !c.video?.raw_url)
    
    const clipsToGenerate = clipsWithoutVideo

    if (clipsToGenerate.length === 0) {
      console.log('Tous les clips ont déjà des vidéos')
      return
    }

    const results = await generateAllClips(
      clipsToGenerate,
      actor,
      dbCampaignId || `temp-${Date.now()}`,
      preset.ambient_audio.prompt,
      preset.id
    )

    // Marquer qu'on a de nouveaux clips générés (pour déclencher la sauvegarde)
    setHasNewlyGeneratedClips(true)

    // Fusionner avec les clips existants - on utilise l'order comme clé unique
    // IMPORTANT: On ne compare pas les id car ils peuvent être undefined
    const updatedClips = clipsWithFirstFrames.map((clip, index) => {
      // Chercher par order (qui est unique et défini par Claude)
      const generated = results.find(r => r.order !== undefined && clip.order !== undefined && r.order === clip.order)
      return generated || clip
    })

    setGeneratedClips(updatedClips)
    onClipsUpdate(updatedClips) // Sauvegarder dans le state parent

    // Mettre à jour le status de la campagne si terminé
    if (dbCampaignId) {
      const allCompleted = updatedClips.every(c => c.status === 'completed')
      const hasFailed = updatedClips.some(c => c.status === 'failed')
      
      if (allCompleted) {
        await updateCampaignStatus(dbCampaignId, 'completed')
      } else if (hasFailed) {
        await updateCampaignStatus(dbCampaignId, 'failed')
      }
    }
  }

  const handleConfirmRegenerate = async () => {
    if (!confirmRegen || !actor || !preset) return

    const { clipIndex, what } = confirmRegen
    const clipToRegenerate = generatedClips[clipIndex] || clips[clipIndex]
    
    setConfirmRegen(null)
    
    const result = await regenerateSingleClip(
      clipToRegenerate,
      actor,
      campaignId || 'temp',
      preset.ambient_audio.prompt,
      what,
      preset.id
    )

    if (result) {
      const updatedClips = [...generatedClips]
      updatedClips[clipIndex] = result
      setGeneratedClips(updatedClips)
      onClipsUpdate(updatedClips) // Sauvegarder dans le state parent
      
      // Déclencher la sauvegarde automatique en base
      setHasNewlyGeneratedClips(true)
      
      // Reset les ajustements pour ce clip (la vidéo a changé)
      setAdjustments(prev => ({
        ...prev,
        [clipIndex]: {
          trimStart: 0,
          trimEnd: result.video.duration,
          speed: 1.0,
          isApplied: false,
          cloudinaryId: undefined, // Reset le cloudinaryId car nouvelle vidéo
        }
      }))
    }
  }

  const askRegenerate = (clipIndex: number, what: RegenerateWhat) => {
    const labels: Record<RegenerateWhat, string> = {
      video: 'la vidéo',
      voice: 'la voix',
      ambient: 'l\'ambiance',
      frame: 'l\'image',
      all: 'tout',
    }
    
    setConfirmRegen({
      clipIndex,
      what,
      label: labels[what],
      warning: what === 'video' ? '⚠️ Coûteux (~1-2€)' : undefined
    })
  }

  const handleFinish = async () => {
    if (campaignId) {
      onComplete(campaignId)
    }
  }

  // Nombre de clips avec vidéo générée
  const clipsWithVideo = generatedClips.filter(c => c.video?.raw_url).length
  const allClipsHaveVideo = clipsWithVideo === clips.length && clips.length > 0
  
  const allCompleted = generatedClips.length > 0 && 
    generatedClips.every(c => c.status === 'completed')

  const hasFailures = generatedClips.some(c => c.status === 'failed')
  
  // Clips restants à générer
  const remainingClips = clips.length - clipsWithVideo

  const getClipStatus = (index: number): ClipStatus => {
    const clipProgress = progress[clips[index]?.id || `clip-${clips[index]?.order}`]
    // Si on a une vidéo générée, c'est completed
    const hasVideo = generatedClips[index]?.video?.raw_url || clips[index]?.video?.raw_url
    if (hasVideo && !clipProgress) return 'completed'
    return clipProgress?.status || generatedClips[index]?.status || 'pending'
  }

  const getCurrentStep = (status: ClipStatus): number => {
    if (status === 'generating_video') return 0
    if (status === 'generating_voice') return 1
    if (status === 'generating_ambient') return 2
    if (status === 'completed') return 3
    return -1
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-3xl font-semibold tracking-tight">
          {!started ? 'Génération des vidéos' : generating ? 'Génération en cours...' : allCompleted ? '🎉 Vidéos prêtes !' : 'Génération terminée'}
        </h2>
        <p className="text-muted-foreground mt-3 text-lg">
          {!started 
            ? `${clips.length} clips à générer` 
            : generating 
              ? 'Cela peut prendre quelques minutes...'
              : hasFailures
                ? 'Certains clips ont échoué'
                : 'Tu peux prévisualiser et ajuster tes vidéos'
          }
        </p>
      </div>

      {/* Not started state - seulement si aucune vidéo n'existe */}
      {!started && !hasExistingVideos && (
        <Card className="rounded-2xl">
          <CardContent className="p-12 text-center">
            <div className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-muted flex items-center justify-center">
              <span className="text-5xl">🎬</span>
            </div>
            <h3 className="text-2xl font-semibold mb-3">
              Prêt à générer {clips.length} clips
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Chaque clip passe par : Vidéo → Voix → Ambiance
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <Button variant="ghost" onClick={onBack} className="h-12 px-6 rounded-xl text-base">
                ← Modifier le plan
              </Button>
              <Button 
                onClick={handleStartGeneration}
                className="h-14 px-10 rounded-xl font-medium text-lg"
                size="lg"
              >
                🚀 Lancer la génération
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generation in progress / Completed */}
      {started && (
        <div className="space-y-6">
          {/* Overall progress */}
          {generating && (
            <Card className="rounded-xl bg-foreground text-background">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">Progression globale</span>
                  <span className="opacity-70">
                    {Math.round(getOverallProgress())}%
                  </span>
                </div>
                <Progress value={getOverallProgress()} className="h-2.5 bg-background/20" />
              </CardContent>
            </Card>
          )}

          {/* Clips grid */}
          <div className="space-y-5">
            {clips.map((clip, index) => {
              const generatedClip = generatedClips[index]
              const currentStatus = getClipStatus(index)
              const currentStep = getCurrentStep(currentStatus)
              const clipProgress = progress[clip.id || `clip-${clip.order}`]
              const isCompleted = currentStatus === 'completed'
              const isFailed = currentStatus === 'failed'
              const isGenerating = currentStatus !== 'pending' && currentStatus !== 'completed' && currentStatus !== 'failed'
              
              const videoUrl = generatedClip?.video?.raw_url
              const firstFrameUrl = clip.first_frame?.image_url || state.generated_first_frames?.[index]?.url
              
              return (
                <div 
                  key={clip.id || index} 
                  className={`rounded-2xl overflow-hidden border bg-card transition-all grid grid-cols-[160px_1fr] ${
                    isCompleted ? 'ring-2 ring-green-500/30' : 
                    isFailed ? 'ring-2 ring-red-500/30' : ''
                  }`}
                >
                  {/* Left: Video/Image - Collé aux bords, pas de padding */}
                  <div className="relative group bg-black">
                    {videoUrl ? (
                      <>
                        <video 
                          key={videoUrl} // Force remount when URL changes (after regeneration)
                          src={videoUrl} 
                          className="w-full h-full object-cover"
                          poster={firstFrameUrl}
                          autoPlay
                          muted
                          loop
                          playsInline
                          ref={(video) => {
                            if (video) {
                              const adj = adjustments[index]
                              if (adj) {
                                // Appliquer la vitesse en temps réel
                                video.playbackRate = adj.speed || 1
                                // Gérer le trim (boucle entre trimStart et trimEnd)
                                const handleTimeUpdate = () => {
                                  const trimEnd = adj.trimEnd ?? clip.video.duration
                                  const trimStart = adj.trimStart ?? 0
                                  if (video.currentTime >= trimEnd || video.currentTime < trimStart) {
                                    video.currentTime = trimStart
                                  }
                                }
                                video.ontimeupdate = handleTimeUpdate
                                // Démarrer au bon point si nécessaire
                                if (adj.trimStart && video.currentTime < adj.trimStart) {
                                  video.currentTime = adj.trimStart
                                }
                              }
                            }
                          }}
                        />
                        {/* Bouton plein écran au hover */}
                        <button
                          onClick={() => { setPreviewingClip(index); setFullscreenVideo(videoUrl) }}
                          className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors"
                        >
                          <Play className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </>
                    ) : firstFrameUrl ? (
                      <>
                        <img 
                          src={firstFrameUrl} 
                          alt={`Clip ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {isGenerating && (
                          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-white mb-2" />
                            <span className="text-white text-xs font-medium">
                              {currentStatus === 'generating_video' ? 'Vidéo...' : 
                               currentStatus === 'generating_voice' ? 'Voix...' : 
                               currentStatus === 'generating_ambient' ? 'Ambiance...' : ''}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full min-h-[140px] flex items-center justify-center bg-muted">
                        <Play className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Badge Completed */}
                    {isCompleted && (
                      <div className="absolute top-2 right-2 z-10 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>

                    {/* Right: Content */}
                    <div className="p-4 flex flex-col">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-sm">
                              {index + 1}
                            </span>
                            <Badge className={`${BEAT_COLORS[clip.beat]} text-white text-xs px-2 py-0.5`}>
                              {BEAT_LABELS[clip.beat]}
                            </Badge>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{clip.video.duration}s</span>
                            </div>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">
                            "{clip.script.text}"
                          </p>
                        </div>
                      </div>

                      {/* Generation steps indicator */}
                      {(isGenerating || isCompleted) && (
                        <div className="flex items-center gap-4 mb-4">
                          {STATUS_STEPS.map((step, stepIndex) => {
                            const StepIcon = step.icon
                            const isActive = stepIndex === currentStep
                            const isDone = stepIndex < currentStep || isCompleted
                            
                            return (
                              <div key={step.status} className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                                  isDone ? 'bg-green-500' : 
                                  isActive ? 'bg-foreground' : 
                                  'bg-muted'
                                }`}>
                                  {isDone ? (
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : isActive ? (
                                    <Loader2 className="w-4 h-4 text-background animate-spin" />
                                  ) : (
                                    <StepIcon className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </div>
                                <span className={`text-sm font-medium ${
                                  isDone ? 'text-green-600' : 
                                  isActive ? 'text-foreground' : 
                                  'text-muted-foreground'
                                }`}>
                                  {step.label}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Progress message */}
                      {clipProgress && !['completed', 'failed'].includes(clipProgress.status) && (
                        <div className="mb-4">
                          <Progress value={clipProgress.progress} className="h-1.5 mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {clipProgress.message}
                          </p>
                        </div>
                      )}

                      {/* Failed state */}
                      {isFailed && (
                        <div className="mb-4">
                          <Button 
                            variant="destructive" 
                            size="sm"
                            className="h-9 text-sm rounded-lg"
                            onClick={() => askRegenerate(index, 'all')}
                            disabled={generating}
                          >
                            🔄 Réessayer tout
                          </Button>
                        </div>
                      )}

                      {/* Completed: Sections Ajuster + Régénérer */}
                      {isCompleted && generatedClip && (
                        <div className="mt-auto pt-3 space-y-3">
                          {/* Section AJUSTER (gratuit) */}
                          <div className="p-3 rounded-lg border border-border bg-muted/30">
                            <div className="flex items-center gap-2 mb-3">
                              <Scissors className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium">Ajuster ce clip</span>
                              <Badge variant="outline" className="text-xs ml-auto">gratuit</Badge>
                            </div>
                            
                            {/* Trim Slider */}
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span>Trim</span>
                                <span>
                                  {adjustments[index]?.trimStart?.toFixed(1) || '0.0'}s → {adjustments[index]?.trimEnd?.toFixed(1) || clip.video.duration}s
                                </span>
                              </div>
                              <Slider
                                value={[
                                  adjustments[index]?.trimStart || 0,
                                  adjustments[index]?.trimEnd || clip.video.duration
                                ]}
                                min={0}
                                max={clip.video.duration}
                                step={0.1}
                                onValueChange={([start, end]) => {
                                  updateAdjustment(index, { trimStart: start, trimEnd: end })
                                }}
                                className="w-full"
                              />
                            </div>
                            
                            {/* Speed Buttons */}
                            <div className="mb-3">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                <Gauge className="w-3 h-3" />
                                <span>Vitesse</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {SPEED_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.value}
                                    onClick={() => updateAdjustment(index, { speed: opt.value })}
                                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                                      (adjustments[index]?.speed || 1.0) === opt.value
                                        ? 'bg-foreground text-background font-medium'
                                        : 'bg-muted hover:bg-muted/80'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                            {/* Durée ajustée */}
                            {adjustments[index] && (
                              <div className="text-xs text-muted-foreground mb-3">
                                Durée finale : {calculateAdjustedDuration(
                                  clip.video.duration,
                                  adjustments[index].trimStart,
                                  adjustments[index].trimEnd,
                                  adjustments[index].speed
                                ).toFixed(1)}s
                              </div>
                            )}
                            
                            {/* Reset Button - seulement si modifié */}
                            {(adjustments[index]?.trimStart !== 0 ||
                              adjustments[index]?.trimEnd !== clip.video.duration ||
                              adjustments[index]?.speed !== 1.0) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs rounded-lg text-muted-foreground"
                                onClick={() => resetAdjustments(index)}
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Reset
                              </Button>
                            )}
                          </div>
                          
                          {/* Section RÉGÉNÉRER (coûteux) */}
                          <div className="p-3 rounded-lg border border-orange-500/30 bg-orange-500/5">
                            <div className="flex items-center gap-2 mb-2">
                              <RefreshCw className="w-4 h-4 text-orange-500" />
                              <span className="text-sm font-medium text-orange-600">Régénérer</span>
                              <Badge variant="outline" className="text-xs ml-auto border-orange-500/50 text-orange-600">~1-2€</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="h-8 text-xs rounded-lg border-orange-500/40 text-orange-600 hover:bg-orange-50 hover:border-orange-500"
                                onClick={() => askRegenerate(index, 'video')}
                                disabled={generating}
                              >
                                <Video className="w-3 h-3 mr-1" />
                                Vidéo
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="h-8 text-xs rounded-lg"
                                onClick={() => askRegenerate(index, 'voice')}
                                disabled={generating}
                              >
                                <Mic className="w-3 h-3 mr-1" />
                                Voix
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="h-8 text-xs rounded-lg"
                                onClick={() => askRegenerate(index, 'ambient')}
                                disabled={generating}
                              >
                                <Music className="w-3 h-3 mr-1" />
                                Ambiance
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-6">
            {generating ? (
              <Button variant="destructive" onClick={cancel} className="h-12 px-6 rounded-xl text-base">
                ✕ Annuler
              </Button>
            ) : (
              <Button variant="ghost" onClick={onBack} className="h-12 px-6 rounded-xl text-base">
                ← Retour au plan
              </Button>
            )}

            <div className="flex items-center gap-3">
              {/* Bouton pour continuer la génération si des clips restent */}
              {!generating && remainingClips > 0 && (
                <Button 
                  onClick={handleStartGeneration}
                  className="h-12 px-6 rounded-xl font-medium text-base"
                >
                  🚀 Générer {remainingClips} clip{remainingClips > 1 ? 's' : ''} restant{remainingClips > 1 ? 's' : ''}
                </Button>
              )}

              {allCompleted && (
                <Button 
                  onClick={assembleVideo}
                  disabled={assembling}
                  className="h-12 px-8 rounded-xl font-medium text-base bg-green-600 hover:bg-green-500"
                >
                  {assembling ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Assemblage...
                    </>
                  ) : (
                    <>
                      <Film className="w-4 h-4 mr-2" />
                      Assembler la vidéo finale
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation régénération */}
      <ConfirmModal
        isOpen={!!confirmRegen}
        onCancel={() => setConfirmRegen(null)}
        onConfirm={handleConfirmRegenerate}
        title={`Régénérer ${confirmRegen?.label} ?`}
        message={
          confirmRegen?.warning 
            ? `${confirmRegen.warning} — Cette action va régénérer ${confirmRegen.label} du clip.`
            : `Cette action va régénérer ${confirmRegen?.label || ''} du clip.`
        }
        confirmText="Régénérer"
        variant={confirmRegen?.what === 'video' ? 'danger' : 'warning'}
      />

      {/* Modal vidéo plein écran avec ajustements HTML5 */}
      {fullscreenVideo && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => { setFullscreenVideo(null); setPreviewingClip(null) }}
        >
          <button
            onClick={() => { setFullscreenVideo(null); setPreviewingClip(null) }}
            className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          
          {/* Afficher les infos d'ajustement */}
          {previewingClip !== null && adjustments[previewingClip] && (
            <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-sm">
              <div className="flex items-center gap-4">
                <span>⏱ {adjustments[previewingClip].trimStart?.toFixed(1)}s → {adjustments[previewingClip].trimEnd?.toFixed(1)}s</span>
                <span>⚡ {adjustments[previewingClip].speed}x</span>
              </div>
            </div>
          )}
          
          <video 
            key={fullscreenVideo} // Force remount when URL changes
            src={fullscreenVideo} 
            className="max-h-[85vh] max-w-full rounded-xl"
            controls
            autoPlay
            onClick={(e) => e.stopPropagation()}
            ref={(video) => {
              if (video && previewingClip !== null) {
                const adj = adjustments[previewingClip]
                if (adj) {
                  // Appliquer la vitesse
                  video.playbackRate = adj.speed || 1
                  // Démarrer au bon timing (trim start)
                  if (adj.trimStart > 0 && video.currentTime < adj.trimStart) {
                    video.currentTime = adj.trimStart
                  }
                  // Boucler à la fin du trim
                  video.ontimeupdate = () => {
                    if (video.currentTime >= (adj.trimEnd || video.duration)) {
                      video.currentTime = adj.trimStart || 0
                    }
                  }
                }
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
