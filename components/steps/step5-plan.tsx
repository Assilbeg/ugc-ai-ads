'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { NewCampaignState, CampaignClip, CampaignBrief, Actor } from '@/types'
import { usePlanGeneration } from '@/hooks/use-plan-generation'
import { getPresetById } from '@/lib/presets'
import { IntentionPreset } from '@/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, ArrowRight, RefreshCw, Sparkles, Clock, Film, ImageIcon, Pencil, Check, X, Loader2, AlertTriangle } from 'lucide-react'

// Type for first frame generation status
interface FirstFrameStatus {
  [clipIndex: number]: {
    loading: boolean
    url?: string
    error?: string
  }
}

interface Step5PlanProps {
  state: NewCampaignState
  onClipsGenerated: (clips: CampaignClip[]) => void
  onFirstFramesUpdate: (frames: { [index: number]: { url: string; generatedAt: number } }) => void
  onNext: () => void
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

const BEAT_EMOJIS: Record<string, string> = {
  hook: '🎣',
  problem: '😰',
  agitation: '🔥',
  solution: '✨',
  proof: '📊',
  cta: '🚀',
}

// Configuration des étapes de chargement - toutes démarrent ensemble avec des vitesses différentes
const LOADING_STEPS = [
  { beat: 'hook', label: 'HOOK', emoji: '🎣' },
  { beat: 'solution', label: 'SOLUTION', emoji: '✨' },
  { beat: 'problem', label: 'PROBLÈME', emoji: '😰' },
  { beat: 'proof', label: 'PREUVE', emoji: '📊' },
  { beat: 'agitation', label: 'AGITATION', emoji: '🔥' },
  { beat: 'cta', label: 'CTA', emoji: '🚀' },
]

function LoadingAnimation() {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [overallProgress, setOverallProgress] = useState(0)
  const [mounted, setMounted] = useState(false)

  // S'assurer qu'on est côté client pour le Portal
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // ═══════════════════════════════════════════════════════════════
    // BARRE GLOBALE : Animation indépendante qui démarre immédiatement
    // ═══════════════════════════════════════════════════════════════
    const globalDuration = 25000 // 25 secondes pour aller de 0 à 95%
    const globalStartTime = Date.now()
    
    const animateGlobal = () => {
      const elapsed = Date.now() - globalStartTime
      const linearProgress = Math.min(elapsed / globalDuration, 1)
      // Courbe ease-out pour un remplissage naturel
      const easedProgress = 1 - Math.pow(1 - linearProgress, 2)
      const progressPercent = easedProgress * 95 // Max 95%
      
      setOverallProgress(progressPercent)
      
      if (linearProgress < 1) {
        requestAnimationFrame(animateGlobal)
      }
    }
    // Démarrer immédiatement
    requestAnimationFrame(animateGlobal)

    // ═══════════════════════════════════════════════════════════════
    // TUILES INDIVIDUELLES : Animation avec délai décalé
    // ═══════════════════════════════════════════════════════════════
    const stepDurations: Record<string, number> = {}
    LOADING_STEPS.forEach((step, index) => {
      const baseDuration = 8000 + (index * 1800)
      const randomVariation = Math.random() * 4000 - 1500
      stepDurations[step.beat] = Math.max(6000, baseDuration + randomVariation)
    })

    const lastBeat = LOADING_STEPS[LOADING_STEPS.length - 1].beat
    
    LOADING_STEPS.forEach((step, index) => {
      const startDelay = 300 + (index * 400)
      const duration = stepDurations[step.beat]
      const isLast = step.beat === lastBeat
      
      setTimeout(() => {
        setActiveStep(prev => prev || step.beat)
        
        if (isLast) {
          // Dernière tuile : animation en boucle
          let goingUp = true
          let currentProgress = 0
          const animate = () => {
            if (goingUp) {
              currentProgress += 1.2
              if (currentProgress >= 90) goingUp = false
            } else {
              currentProgress -= 0.6
              if (currentProgress <= 30) goingUp = true
            }
            setProgress(prev => ({ ...prev, [step.beat]: currentProgress }))
            requestAnimationFrame(animate)
          }
          requestAnimationFrame(animate)
        } else {
          // Autres tuiles : progression de 0 à 100%
          const startTime = Date.now()
          const animate = () => {
            const elapsed = Date.now() - startTime
            const linearProgress = Math.min(elapsed / duration, 1)
            const easedProgress = 1 - Math.pow(1 - linearProgress, 2.5)
            const progressPercent = easedProgress * 100
            
            setProgress(prev => ({ ...prev, [step.beat]: progressPercent }))
            
            if (linearProgress < 1) {
              requestAnimationFrame(animate)
            } else {
              setProgress(prev => ({ ...prev, [step.beat]: 100 }))
              setTimeout(() => {
                setCompletedSteps(prev => new Set([...prev, step.beat]))
              }, 400)
            }
          }
          requestAnimationFrame(animate)
        }
      }, startDelay)
    })
  }, [])

  // Contenu de l'overlay
  const overlayContent = (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'hsl(var(--background))',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
      }}
    >
      <div className="w-full max-w-4xl px-6 py-12">
      {/* Title */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-full text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4 animate-pulse" />
          Génération du script parfait...
        </div>
        <p className="text-muted-foreground text-sm">Analyse du brief et création des clips</p>
      </div>

      {/* Animated timeline */}
      <div className="max-w-3xl mx-auto">
        {/* Timeline bar */}
        <div className="flex items-center gap-3 mb-8">
          <div className="relative h-2 flex-1 bg-muted rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-foreground rounded-full"
              style={{ 
                width: `${overallProgress}%`,
                transition: 'width 0.1s linear'
              }}
            />
          </div>
          <span className="text-sm font-medium text-foreground tabular-nums w-12 text-right">
            {Math.round(overallProgress)}%
          </span>
        </div>

        {/* Beat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {LOADING_STEPS.map((item, index) => {
            const stepProgress = progress[item.beat] || 0
            // La pastille verte n'apparaît que si la barre est vraiment à 100%
            const isCompleted = completedSteps.has(item.beat) && stepProgress >= 99.9
            const isActive = activeStep === item.beat
            
            return (
              <div
                key={item.beat}
                className={`
                  relative overflow-hidden rounded-2xl border bg-card p-4
                  transition-all duration-300
                  ${isCompleted ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-border'}
                  ${isActive ? 'ring-2 ring-foreground/20' : ''}
                `}
                style={{ 
                  opacity: 0,
                  animation: `fadeSlideUp 0.4s ease-out ${index * 0.08}s forwards`
                }}
              >
                {/* Shimmer effect while active */}
                {isActive && !isCompleted && (
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent"
                    style={{ animation: 'shimmer 1.5s infinite' }}
                  />
                )}
                
                <div className="flex items-center gap-3">
                  <div className={`relative w-10 h-10 rounded-xl ${BEAT_COLORS[item.beat]} flex items-center justify-center text-lg`}>
                    {item.emoji}
                    {/* Sablier pendant le chargement, checkmark quand terminé */}
                    {isActive && !isCompleted && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-foreground/80 rounded-full flex items-center justify-center shadow-sm">
                        <span className="text-[10px]">⏳</span>
                      </div>
                    )}
                    {isCompleted && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-sm animate-in zoom-in duration-200">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className={`font-semibold ${isCompleted ? 'text-green-700 dark:text-green-400' : 'text-foreground'}`}>
                        {item.label}
                      </p>
                      {isCompleted && (
                        <span className="text-[10px] text-green-600 font-medium">✓</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-100 ${
                            isCompleted ? 'bg-green-500' : 'bg-foreground'
                          }`}
                          style={{ width: `${stepProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Progress text */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-foreground animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 rounded-full bg-foreground animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 rounded-full bg-foreground animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
          <span className="text-sm text-muted-foreground">
            {activeStep ? `Écriture du ${LOADING_STEPS.find(s => s.beat === activeStep)?.label}...` : 'Analyse du brief...'}
          </span>
        </div>
      </div>
      </div>
    </div>
  )

  // Utiliser un Portal pour rendre l'overlay directement dans le body
  // Cela évite les problèmes de stacking context avec les parents
  if (!mounted) return null
  return createPortal(overlayContent, document.body)
}

export function Step5Plan({ state, onClipsGenerated, onFirstFramesUpdate, onNext, onBack }: Step5PlanProps) {
  const { clips, loading, error, generatePlan, updateClipScript, setClips } = usePlanGeneration()
  const [editingClip, setEditingClip] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [editingVisualPrompt, setEditingVisualPrompt] = useState<number | null>(null)
  const [editVisualText, setEditVisualText] = useState('')
  const [hasGenerated, setHasGenerated] = useState(false)
  const [hasRestoredClips, setHasRestoredClips] = useState(false)
  const [actor, setActor] = useState<Actor | undefined>(undefined)
  const [actorLoading, setActorLoading] = useState(true)
  const [preset, setPreset] = useState<IntentionPreset | undefined>(undefined)
  const [presetLoading, setPresetLoading] = useState(true)
  const [firstFrames, setFirstFrames] = useState<FirstFrameStatus>({})
  const [generatingFrames, setGeneratingFrames] = useState(false)
  
  const supabase = createClient()

  // Restaurer les clips et first frames depuis le state parent
  useEffect(() => {
    if (!hasRestoredClips && state.generated_clips && state.generated_clips.length > 0 && clips.length === 0) {
      setClips(state.generated_clips)
      setHasGenerated(true)
      setHasRestoredClips(true)
      
      // Initialiser firstFrames depuis le cache parent OU depuis les clips
      const preGeneratedFrames: FirstFrameStatus = {}
      
      // D'abord, récupérer depuis le cache parent (prioritaire car plus fiable)
      if (state.generated_first_frames) {
        Object.entries(state.generated_first_frames).forEach(([indexStr, frame]) => {
          const index = parseInt(indexStr)
          if (frame.url) {
            preGeneratedFrames[index] = { loading: false, url: frame.url }
          }
        })
      }
      
      // Ensuite, compléter avec les URLs dans les clips (pour step4)
      state.generated_clips.forEach((clip, index) => {
        if (clip.first_frame?.image_url && !preGeneratedFrames[index]) {
          preGeneratedFrames[index] = { loading: false, url: clip.first_frame.image_url }
        }
      })
      
      if (Object.keys(preGeneratedFrames).length > 0) {
        setFirstFrames(preGeneratedFrames)
      }
    }
  }, [state.generated_clips, state.generated_first_frames, clips.length, hasRestoredClips, setClips])

  // Generate first frame for a single clip
  // invalidateVideo = true quand c'est une régénération manuelle (pas la génération initiale)
  const generateFirstFrame = useCallback(async (clipIndex: number, clip: CampaignClip, previousFrameUrl?: string, invalidateVideo = false) => {
    if (!actor?.soul_image_url) {
      setFirstFrames(prev => ({
        ...prev,
        [clipIndex]: { loading: false, error: 'Pas d\'image SOUL' }
      }))
      return null
    }

    if (!actor.soul_image_url.startsWith('http')) {
      setFirstFrames(prev => ({
        ...prev,
        [clipIndex]: { loading: false, error: 'Image SOUL non uploadée' }
      }))
      return null
    }

    setFirstFrames(prev => ({
      ...prev,
      [clipIndex]: { loading: true }
    }))
    
    // Invalider la vidéo existante si demandé (régénération manuelle)
    if (invalidateVideo && clips[clipIndex]?.video?.raw_url) {
      const updatedClips = [...clips]
      updatedClips[clipIndex] = {
        ...updatedClips[clipIndex],
        video: {
          ...updatedClips[clipIndex].video,
          raw_url: undefined,
          final_url: undefined,
        },
        status: 'pending',
      }
      setClips(updatedClips)
    }

    try {
      const response = await fetch('/api/generate/first-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soulImageUrl: actor.soul_image_url,
          prompt: clip.first_frame.prompt,
          previousFrameUrl, // Utiliser l'image du clip précédent pour continuité
          actorId: actor.id, // Pour le cache des assets
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate first frame')
      }
      
      setFirstFrames(prev => ({
        ...prev,
        [clipIndex]: { loading: false, url: data.url }
      }))
      
      // Mettre à jour aussi le clip lui-même pour que ça persiste
      // IMPORTANT: utiliser le clip passé en paramètre (qui peut avoir un prompt modifié)
      const updatedClips = [...clips]
      if (updatedClips[clipIndex]) {
        updatedClips[clipIndex] = {
          ...updatedClips[clipIndex],
          first_frame: {
            ...clip.first_frame, // Utiliser le clip passé en paramètre pour garder le nouveau prompt
            image_url: data.url
          }
        }
        setClips(updatedClips)
      }
      
      return data.url // Retourner l'URL pour le clip suivant
    } catch (err) {
      setFirstFrames(prev => ({
        ...prev,
        [clipIndex]: { loading: false, error: err instanceof Error ? err.message : 'Erreur génération' }
      }))
      return null
    }
  }, [actor, clips, setClips])

  // Generate all first frames after plan is ready (séquentiel avec chaînage)
  const generateAllFirstFrames = useCallback(async () => {
    if (!actor?.soul_image_url || clips.length === 0 || generatingFrames) return
    
    setGeneratingFrames(true)
    
    let previousUrl: string | undefined = undefined
    
    for (let i = 0; i < clips.length; i++) {
      // Vérifier si ce clip a déjà une image générée
      const existingFrame = firstFrames[i]
      if (existingFrame?.url) {
        // Utiliser l'image existante comme référence pour le prochain clip
        previousUrl = existingFrame.url
        continue
      }
      
      // Passer l'URL du clip précédent pour continuité visuelle
      const generatedUrl = await generateFirstFrame(i, clips[i], previousUrl)
      
      // Utiliser cette URL comme référence pour le prochain clip
      if (generatedUrl) {
        previousUrl = generatedUrl
      }
      
      if (i < clips.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500)) // Réduit car déjà séquentiel
      }
    }
    
    setGeneratingFrames(false)
  }, [actor, clips, generatingFrames, generateFirstFrame, firstFrames])

  // Auto-generate first frames when clips are ready (seulement si toutes les images ne sont pas déjà là)
  useEffect(() => {
    const existingFrameCount = Object.values(firstFrames).filter(f => f.url).length
    const needsGeneration = clips.length > 0 && existingFrameCount < clips.length
    
    if (needsGeneration && actor && !generatingFrames) {
      generateAllFirstFrames()
    }
  }, [clips, actor, firstFrames, generatingFrames, generateAllFirstFrames])

  // Sauvegarder les first frames dans le state parent pour persistance
  useEffect(() => {
    const framesToSave: { [index: number]: { url: string; generatedAt: number } } = {}
    let hasNewFrames = false
    
    Object.entries(firstFrames).forEach(([indexStr, frame]) => {
      if (frame.url) {
        const index = parseInt(indexStr)
        // Vérifier si ce frame n'est pas déjà dans le state parent
        const existingFrame = state.generated_first_frames?.[index]
        if (!existingFrame || existingFrame.url !== frame.url) {
          hasNewFrames = true
        }
        framesToSave[index] = {
          url: frame.url,
          generatedAt: existingFrame?.generatedAt || Date.now()
        }
      }
    })
    
    // Sauvegarder seulement si on a de nouveaux frames
    if (hasNewFrames && Object.keys(framesToSave).length > 0) {
      onFirstFramesUpdate(framesToSave)
    }
  }, [firstFrames, state.generated_first_frames, onFirstFramesUpdate])

  // Load actor from database
  useEffect(() => {
    async function loadActor() {
      if (!state.actor_id) {
        setActorLoading(false)
        return
      }

      const { data, error } = await (supabase
        .from('actors') as any)
        .select('*')
        .eq('id', state.actor_id)
        .single()

      if (data) {
        setActor(data as Actor)
      }
      
      setActorLoading(false)
    }

    loadActor()
  }, [state.actor_id])

  // Load preset
  useEffect(() => {
    async function loadPreset() {
      if (!state.preset_id) {
        setPresetLoading(false)
        return
      }

      const hardcodedPreset = getPresetById(state.preset_id)
      if (hardcodedPreset) {
        setPreset(hardcodedPreset)
        setPresetLoading(false)
        return
      }

      const { data } = await (supabase
        .from('intention_presets') as any)
        .select('*')
        .eq('id', state.preset_id)
        .single()

      if (data) {
        setPreset(data as IntentionPreset)
      }
      setPresetLoading(false)
    }

    loadPreset()
  }, [state.preset_id])

  // Generate plan on mount - SEULEMENT si pas de clips existants dans le state parent
  useEffect(() => {
    // Ne PAS générer si des clips existent déjà (en cours de restauration ou déjà restaurés)
    const hasExistingClips = state.generated_clips && state.generated_clips.length > 0
    
    if (!hasGenerated && clips.length === 0 && !hasExistingClips && actor && preset && state.brief.what_selling && !loading && !actorLoading && !presetLoading) {
      setHasGenerated(true)
      handleGeneratePlan()
    }
  }, [actor, preset, state.brief.what_selling, hasGenerated, clips.length, loading, actorLoading, presetLoading, state.generated_clips])

  // Sync clips with parent
  useEffect(() => {
    if (clips.length > 0) {
      onClipsGenerated(clips)
    }
  }, [clips, onClipsGenerated])

  // ══════════════════════════════════════════════════════════════
  // SAUVEGARDER LES CLIPS EN BDD DÈS QU'ILS SONT GÉNÉRÉS
  // ══════════════════════════════════════════════════════════════
  const saveClipsToDb = useCallback(async (clipsToSave: CampaignClip[]) => {
    if (!state.campaign_id || clipsToSave.length === 0) return

    try {
      // Supprimer les anciens clips et insérer les nouveaux
      const { error: deleteError } = await (supabase
        .from('campaign_clips') as any)
        .delete()
        .eq('campaign_id', state.campaign_id)

      if (deleteError) {
        console.warn('[Step5] Error deleting old clips:', deleteError)
      }

      const clipsToInsert = clipsToSave.map(clip => ({
        campaign_id: state.campaign_id,
        order: clip.order,
        beat: clip.beat,
        first_frame: clip.first_frame,
        script: clip.script,
        video: clip.video,
        audio: clip.audio || {},
        status: clip.status || 'pending',
      }))

      const { error: insertError } = await (supabase
        .from('campaign_clips') as any)
        .insert(clipsToInsert)

      if (insertError) {
        console.error('[Step5] Error saving clips to DB:', insertError)
        return
      }

      console.log('[Step5] ✓ Clips saved to DB:', clipsToSave.length)
    } catch (err) {
      console.error('[Step5] Error saving clips to DB:', err)
    }
  }, [state.campaign_id, supabase])

  // Auto-save clips when they change (and we have a campaign_id)
  useEffect(() => {
    // Ne sauvegarder que si :
    // 1. On a un campaign_id
    // 2. On a des clips
    // 3. Les clips n'ont pas été restaurés depuis la BDD (éviter boucle)
    if (state.campaign_id && clips.length > 0 && hasGenerated && !hasRestoredClips) {
      saveClipsToDb(clips)
    }
  }, [clips, state.campaign_id, hasGenerated, hasRestoredClips, saveClipsToDb])

  const handleGeneratePlan = async () => {
    if (!actor || !preset || !state.brief.what_selling) return

    await generatePlan({
      actor,
      preset,
      brief: state.brief as CampaignBrief,
      product: state.product,
    })
  }

  const startEditing = (index: number) => {
    setEditingClip(index)
    setEditText(clips[index].script.text)
  }

  const saveEdit = () => {
    if (editingClip !== null) {
      updateClipScript(editingClip, editText)
      
      // Invalider la vidéo existante si le script a changé
      // Pour forcer une régénération à l'étape 6
      const currentClip = clips[editingClip]
      if (currentClip?.video?.raw_url && currentClip.script.text !== editText) {
        const updatedClips = [...clips]
        updatedClips[editingClip] = {
          ...updatedClips[editingClip],
          video: {
            ...updatedClips[editingClip].video,
            raw_url: undefined, // Invalider pour forcer régénération
            final_url: undefined,
          },
          status: 'pending',
        }
        setClips(updatedClips)
      }
      
      setEditingClip(null)
      setEditText('')
    }
  }

  const cancelEdit = () => {
    setEditingClip(null)
    setEditText('')
  }

  const startEditingVisual = (index: number) => {
    setEditingVisualPrompt(index)
    setEditVisualText(clips[index].first_frame.prompt)
  }

  const saveVisualEdit = async () => {
    if (editingVisualPrompt !== null) {
      const currentClip = clips[editingVisualPrompt]
      const promptChanged = currentClip.first_frame.prompt !== editVisualText
      
      const newFirstFrame = {
        ...currentClip.first_frame,
        prompt: editVisualText,
        // Invalider l'image existante si le prompt a changé
        image_url: promptChanged ? undefined : currentClip.first_frame.image_url,
      }
      
      const updatedClips = [...clips]
      updatedClips[editingVisualPrompt] = {
        ...updatedClips[editingVisualPrompt],
        first_frame: newFirstFrame,
        // Invalider la vidéo existante si le prompt visuel a changé
        // Pour forcer une régénération à l'étape 6
        ...(promptChanged && currentClip.video?.raw_url ? {
          video: {
            ...updatedClips[editingVisualPrompt].video,
            raw_url: undefined,
            final_url: undefined,
          },
          status: 'pending' as const,
        } : {}),
      }
      setClips(updatedClips)
      setEditingVisualPrompt(null)
      setEditVisualText('')
      
      // Sauvegarder en BDD si on a un campaign_id
      if (state.campaign_id && currentClip.order !== undefined) {
        try {
          const { error } = await (supabase
            .from('campaign_clips') as any)
            .update({ 
              first_frame: newFirstFrame,
              // Invalider la vidéo si le prompt a changé
              ...(promptChanged ? { 
                video: { ...currentClip.video, raw_url: null, final_url: null },
                status: 'pending'
              } : {})
            })
            .eq('campaign_id', state.campaign_id)
            .eq('order', currentClip.order)
          
          if (error) {
            console.error('[Step5] Error saving prompt to DB:', error)
          } else {
            console.log('[Step5] ✓ Prompt saved to DB for clip', currentClip.order)
          }
        } catch (err) {
          console.error('[Step5] Error saving prompt to DB:', err)
        }
      }
    }
  }

  const cancelVisualEdit = () => {
    setEditingVisualPrompt(null)
    setEditVisualText('')
  }

  const handleContinue = () => {
    if (clips.length > 0) {
      onNext()
    }
  }

  const handleRegenerate = () => {
    setHasGenerated(false)
    setFirstFrames({})
    handleGeneratePlan()
  }

  const totalDuration = clips.reduce((sum, c) => sum + c.video.duration, 0)
  const generatedFrames = Object.values(firstFrames).filter(f => f.url).length

  // Helper pour vérifier si le script est trop long
  // Bornes réelles selon les durées Veo 3.1 (4s/6s/8s) utilisées par claude.ts
  const getWordWarning = (text: string, duration: number): { isWarning: boolean; wordCount: number; maxWords: number } => {
    const wordCount = text.split(/\s+/).filter(Boolean).length
    // Bornes exactes de claude.ts pour Veo 3.1
    const maxWordsByDuration: Record<number, number> = {
      4: 15,   // 4s = 12-15 mots max
      6: 22,   // 6s = 18-22 mots max
      8: 30,   // 8s = 25-30 mots max
      12: 45,  // 12s = 40-45 mots max (Sora 2)
    }
    const maxWords = maxWordsByDuration[duration] || Math.floor(duration * 3.5)
    return {
      isWarning: wordCount > maxWords,
      wordCount,
      maxWords
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-2xl font-semibold tracking-tight">Plan de campagne</h2>
        <p className="text-muted-foreground mt-2">
          Valide le script et les visuels générés par l'IA
        </p>
      </div>

      {/* Loading state - Animated timeline */}
      {loading && (
        <LoadingAnimation />
      )}

      {/* Error state */}
      {error && (
        <Card className="bg-destructive/5 border-destructive/20 p-6 gap-0">
          <p className="text-destructive font-medium mb-2">Une erreur est survenue</p>
          <p className="text-destructive/70 text-sm mb-4">{error}</p>
          <Button variant="outline" onClick={handleRegenerate} className="w-fit rounded-xl">
            <RefreshCw className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        </Card>
      )}

      {/* Clips preview */}
      {!loading && clips.length > 0 && (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="flex items-center justify-between p-4 bg-foreground text-background rounded-2xl">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4" />
                <span className="font-medium">{clips.length} clips</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="font-medium">~{totalDuration}s</span>
              </div>
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                {generatingFrames ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Génération...
                  </span>
                ) : (
                  <span className={generatedFrames === clips.length ? 'text-emerald-300' : ''}>
                    {generatedFrames}/{clips.length} images
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                size="sm" 
                className="rounded-lg bg-background/20 hover:bg-background/30 text-background border-0"
                onClick={() => {
                  setFirstFrames({})
                  setTimeout(generateAllFirstFrames, 100)
                }}
                disabled={generatingFrames}
              >
                <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                Images
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                className="rounded-lg bg-background/20 hover:bg-background/30 text-background border-0"
                onClick={handleRegenerate}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Tout
              </Button>
            </div>
          </div>

          {/* Clips list */}
          <div className="space-y-4">
            {clips.map((clip, index) => (
              <Card 
                key={clip.id || index} 
                className="rounded-2xl border-border p-0 gap-0 overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="flex">
                  {/* Left: First Frame Preview */}
                  <div className="w-32 flex-shrink-0 bg-muted relative">
                    <div className="aspect-[9/16]">
                      {firstFrames[index]?.loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground mt-2">Génération...</span>
                        </div>
                      ) : firstFrames[index]?.url ? (
                        <img 
                          src={firstFrames[index].url} 
                          alt={`Clip ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : firstFrames[index]?.error ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted p-2">
                          <span className="text-[10px] text-destructive text-center">{firstFrames[index].error}</span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="mt-2 h-6 text-[10px]"
                            onClick={() => generateFirstFrame(index, clip, index > 0 ? firstFrames[index - 1]?.url : undefined, true)}
                          >
                            Réessayer
                          </Button>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted">
                          <span className="text-3xl">{BEAT_EMOJIS[clip.beat]}</span>
                        </div>
                      )}
                    </div>
                    {/* Regenerate button overlay */}
                    {firstFrames[index]?.url && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="absolute bottom-2 left-2 right-2 h-7 text-[10px] bg-background/80 hover:bg-background backdrop-blur-sm rounded-lg"
                        onClick={() => generateFirstFrame(index, clip, index > 0 ? firstFrames[index - 1]?.url : undefined, true)}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Regénérer
                      </Button>
                    )}
                  </div>

                  {/* Right: Content */}
                  <div className="flex-1 p-5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-sm">
                          {index + 1}
                        </div>
                        <Badge className={`${BEAT_COLORS[clip.beat]} text-white border-0`}>
                          {BEAT_LABELS[clip.beat]}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {clip.video.duration}s
                        </span>
                      </div>
                      {editingClip !== index && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-muted-foreground hover:text-foreground rounded-lg"
                          onClick={() => startEditing(index)}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1.5" />
                          Modifier
                        </Button>
                      )}
                    </div>

                    {/* Script */}
                    {editingClip === index ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="bg-background border-border min-h-[100px] rounded-xl focus:border-foreground"
                          placeholder="Script du clip..."
                        />
                        <div className="flex items-center justify-between">
                          {(() => {
                            const warning = getWordWarning(editText, clip.video.duration)
                            return (
                              <div className="flex items-center gap-2">
                                <span className={`text-xs ${warning.isWarning ? 'text-amber-500 font-medium' : 'text-muted-foreground'}`}>
                                  {warning.wordCount} mots
                                </span>
                                {warning.isWarning && (
                                  <span className="text-xs text-amber-500 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    max ~{warning.maxWords} pour {clip.video.duration}s
                                  </span>
                                )}
                              </div>
                            )
                          })()}
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={cancelEdit} className="rounded-lg">
                              <X className="w-3.5 h-3.5 mr-1" />
                              Annuler
                            </Button>
                            <Button size="sm" onClick={saveEdit} className="rounded-lg">
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Sauvegarder
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <p className="text-foreground leading-relaxed text-base">
                            "{clip.script.text}"
                          </p>
                          {(() => {
                            const warning = getWordWarning(clip.script.text, clip.video.duration)
                            return warning.isWarning ? (
                              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-500">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Script trop long : {warning.wordCount} mots pour {clip.video.duration}s (max ~{warning.maxWords})</span>
                              </div>
                            ) : null
                          })()}
                        </div>
                        
                        {/* Visual prompt */}
                        <div className="p-3 bg-muted/50 rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">Prompt visuel</span>
                            {editingVisualPrompt !== index && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                                onClick={() => startEditingVisual(index)}
                              >
                                <Pencil className="w-2.5 h-2.5 mr-1" />
                                Éditer
                              </Button>
                            )}
                          </div>
                          {editingVisualPrompt === index ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editVisualText}
                                onChange={(e) => setEditVisualText(e.target.value)}
                                className="bg-background border-border min-h-[80px] text-sm rounded-xl focus:border-foreground"
                                placeholder="Prompt visuel..."
                              />
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg" onClick={cancelVisualEdit}>
                                  Annuler
                                </Button>
                                <Button size="sm" className="h-7 text-xs rounded-lg" onClick={async () => {
                                  await saveVisualEdit()
                                  generateFirstFrame(index, { ...clip, first_frame: { ...clip.first_frame, prompt: editVisualText } }, index > 0 ? firstFrames[index - 1]?.url : undefined, true)
                                }}>
                                  Sauvegarder & Regénérer
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {clip.first_frame.prompt}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="h-11 px-5 rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button
          onClick={handleContinue}
          disabled={clips.length === 0 || loading || generatingFrames || generatedFrames < clips.length}
          className="h-11 px-6 rounded-xl font-medium group"
        >
          {generatingFrames ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Génération des images...
            </>
          ) : generatedFrames < clips.length ? (
            <>
              Images {generatedFrames}/{clips.length}
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            </>
          ) : (
            <>
              Générer les vidéos
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
