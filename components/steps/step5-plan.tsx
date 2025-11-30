'use client'

import { useEffect, useState, useCallback } from 'react'
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

// Configuration des étapes de chargement avec ordre et durées réalistes
// Total ~12-15s pour simuler le temps de génération Claude (on garde la dernière en boucle)
const LOADING_STEPS = [
  { beat: 'hook', label: 'HOOK', emoji: '🎣', order: 0, duration: 1500 },      // Premier
  { beat: 'solution', label: 'SOLUTION', emoji: '✨', order: 1, duration: 2500 }, // 2ème, plus long
  { beat: 'problem', label: 'PROBLÈME', emoji: '😰', order: 2, duration: 2000 }, // 3ème
  { beat: 'proof', label: 'PREUVE', emoji: '📊', order: 3, duration: 1800 },    // 4ème
  { beat: 'agitation', label: 'AGITATION', emoji: '🔥', order: 4, duration: 1600 }, // 5ème
  { beat: 'cta', label: 'CTA', emoji: '🚀', order: 5, duration: 0 },           // Dernier - reste en boucle
]

function LoadingAnimation() {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, number>>({})

  useEffect(() => {
    // Trier les étapes par ordre d'exécution
    const sortedSteps = [...LOADING_STEPS].sort((a, b) => a.order - b.order)
    
    let totalDelay = 300 // Délai initial
    
    sortedSteps.forEach((step, index) => {
      const startDelay = totalDelay
      const duration = step.duration
      const isLast = index === sortedSteps.length - 1
      
      // Démarrer l'animation de cette étape
      setTimeout(() => {
        setActiveStep(step.beat)
        
        if (isLast) {
          // Dernière étape : animation en boucle infinie (pulse entre 30-90%)
          let goingUp = true
          let currentProgress = 0
          const animate = () => {
            if (goingUp) {
              currentProgress += 2
              if (currentProgress >= 90) goingUp = false
            } else {
              currentProgress -= 1
              if (currentProgress <= 30) goingUp = true
            }
            setProgress(prev => ({ ...prev, [step.beat]: currentProgress }))
            requestAnimationFrame(animate)
          }
          requestAnimationFrame(animate)
        } else {
          // Animer la progression de 0 à 100
          const startTime = Date.now()
          const animate = () => {
            const elapsed = Date.now() - startTime
            const progressPercent = Math.min((elapsed / duration) * 100, 100)
            
            setProgress(prev => ({ ...prev, [step.beat]: progressPercent }))
            
            if (progressPercent < 100) {
              requestAnimationFrame(animate)
            } else {
              // Marquer comme terminé
              setCompletedSteps(prev => new Set([...prev, step.beat]))
            }
          }
          requestAnimationFrame(animate)
        }
      }, startDelay)
      
      if (!isLast) {
        totalDelay += duration + 200 // Petit délai entre chaque étape
      }
    })
  }, [])

  const completedCount = completedSteps.size
  const totalSteps = LOADING_STEPS.length - 1 // On ne compte pas la dernière qui reste en boucle
  const overallProgress = Math.min((completedCount / totalSteps) * 100, 95) // Max 95% tant que loading

  return (
    <div className="py-12">
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
        <div className="relative h-1.5 bg-muted rounded-full mb-8 overflow-hidden">
          <div 
            className="absolute inset-y-0 left-0 bg-foreground rounded-full transition-all duration-300 ease-out"
            style={{ width: `${overallProgress}%` }}
          />
        </div>

        {/* Beat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {LOADING_STEPS.map((item, index) => {
            const isCompleted = completedSteps.has(item.beat)
            const isActive = activeStep === item.beat
            const stepProgress = progress[item.beat] || 0
            
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
                    {/* Pastille verte de completion */}
                    {isCompleted && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
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
  )
}

export function Step5Plan({ state, onClipsGenerated, onNext, onBack }: Step5PlanProps) {
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

  // Restaurer les clips depuis le state parent (quand on revient de l'étape 6)
  useEffect(() => {
    if (!hasRestoredClips && state.generated_clips && state.generated_clips.length > 0 && clips.length === 0) {
      setClips(state.generated_clips)
      setHasGenerated(true)
      setHasRestoredClips(true)
    }
  }, [state.generated_clips, clips.length, hasRestoredClips, setClips])

  // Generate first frame for a single clip
  const generateFirstFrame = useCallback(async (clipIndex: number, clip: CampaignClip, previousFrameUrl?: string) => {
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

    try {
      const response = await fetch('/api/generate/first-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soulImageUrl: actor.soul_image_url,
          prompt: clip.first_frame.prompt,
          previousFrameUrl, // Utiliser l'image du clip précédent pour continuité
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
      
      return data.url // Retourner l'URL pour le clip suivant
    } catch (err) {
      setFirstFrames(prev => ({
        ...prev,
        [clipIndex]: { loading: false, error: err instanceof Error ? err.message : 'Erreur génération' }
      }))
      return null
    }
  }, [actor])

  // Generate all first frames after plan is ready (séquentiel avec chaînage)
  const generateAllFirstFrames = useCallback(async () => {
    if (!actor?.soul_image_url || clips.length === 0 || generatingFrames) return
    
    setGeneratingFrames(true)
    
    let previousUrl: string | undefined = undefined
    
    for (let i = 0; i < clips.length; i++) {
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
  }, [actor, clips, generatingFrames, generateFirstFrame])

  // Auto-generate first frames when clips are ready
  useEffect(() => {
    if (clips.length > 0 && actor && Object.keys(firstFrames).length === 0 && !generatingFrames) {
      generateAllFirstFrames()
    }
  }, [clips, actor, firstFrames, generatingFrames, generateAllFirstFrames])

  // Load actor from database
  useEffect(() => {
    async function loadActor() {
      if (!state.actor_id) {
        setActorLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('actors')
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

      const { data } = await supabase
        .from('intention_presets')
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

  // Generate plan on mount
  useEffect(() => {
    if (!hasGenerated && clips.length === 0 && actor && preset && state.brief.what_selling && !loading && !actorLoading && !presetLoading) {
      setHasGenerated(true)
      handleGeneratePlan()
    }
  }, [actor, preset, state.brief.what_selling, hasGenerated, clips.length, loading, actorLoading, presetLoading])

  // Sync clips with parent
  useEffect(() => {
    if (clips.length > 0) {
      onClipsGenerated(clips)
    }
  }, [clips, onClipsGenerated])

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

  const saveVisualEdit = () => {
    if (editingVisualPrompt !== null) {
      const updatedClips = [...clips]
      updatedClips[editingVisualPrompt] = {
        ...updatedClips[editingVisualPrompt],
        first_frame: {
          ...updatedClips[editingVisualPrompt].first_frame,
          prompt: editVisualText
        }
      }
      setClips(updatedClips)
      setEditingVisualPrompt(null)
      setEditVisualText('')
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

  // Helper pour vérifier si le script est trop long (~3 mots/seconde max avec marge de tolérance)
  const getWordWarning = (text: string, duration: number): { isWarning: boolean; wordCount: number; maxWords: number } => {
    const wordCount = text.split(/\s+/).filter(Boolean).length
    const maxWords = Math.floor(duration * 3) // ~3 mots/seconde avec marge de tolérance
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
                            onClick={() => generateFirstFrame(index, clip, index > 0 ? firstFrames[index - 1]?.url : undefined)}
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
                        onClick={() => generateFirstFrame(index, clip, index > 0 ? firstFrames[index - 1]?.url : undefined)}
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
                                <Button size="sm" className="h-7 text-xs rounded-lg" onClick={() => {
                                  saveVisualEdit()
                                  generateFirstFrame(index, { ...clip, first_frame: { ...clip.first_frame, prompt: editVisualText } }, index > 0 ? firstFrames[index - 1]?.url : undefined)
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
