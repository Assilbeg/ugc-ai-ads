'use client'

import { useState } from 'react'
import { NewCampaignState, CampaignClip, ClipStatus } from '@/types'
import { useVideoGeneration, RegenerateWhat } from '@/hooks/use-video-generation'
import { useActors } from '@/hooks/use-actors'
import { useCampaignCreation } from '@/hooks/use-campaign-creation'
import { getPresetById } from '@/lib/presets'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Loader2, Play, X, Video, Mic, Music, Maximize2, Clock } from 'lucide-react'

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
  const { saveCampaign, saving } = useCampaignCreation()
  
  const actor = state.actor_id ? getActorById(state.actor_id) : undefined
  const preset = state.preset_id ? getPresetById(state.preset_id) : undefined
  const clips = state.generated_clips || []
  
  // Vérifier si des vidéos ont déjà été générées (clips avec raw_url)
  const hasExistingVideos = clips.some(c => c.video?.raw_url)
  
  // Initialiser avec les clips existants s'ils ont des vidéos
  const [generatedClips, setGeneratedClips] = useState<CampaignClip[]>(() => {
    return hasExistingVideos ? clips : []
  })
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [started, setStarted] = useState(hasExistingVideos) // Déjà "started" si on a des vidéos
  const [fullscreenVideo, setFullscreenVideo] = useState<string | null>(null)
  
  // Modal de confirmation pour régénération
  const [confirmRegen, setConfirmRegen] = useState<{
    clipIndex: number
    what: RegenerateWhat
    label: string
    warning?: string
  } | null>(null)

  const handleStartGeneration = async () => {
    if (!actor || !preset || clips.length === 0) return

    setStarted(true)
    const tempCampaignId = `temp-${Date.now()}`
    setCampaignId(tempCampaignId)

    // Enrichir les clips avec les first frames générées à l'étape Plan
    const clipsWithFirstFrames = clips.map((clip, index) => {
      const generatedFrame = state.generated_first_frames?.[index]
      // Si on a un first frame généré et que le clip n'en a pas encore
      if (generatedFrame?.url && !clip.first_frame?.image_url) {
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
      tempCampaignId,
      preset.ambient_audio.prompt,
      preset.id
    )

    // Fusionner avec les clips existants - on utilise l'order comme clé unique
    // IMPORTANT: On ne compare pas les id car ils peuvent être undefined
    const updatedClips = clipsWithFirstFrames.map((clip, index) => {
      // Chercher par order (qui est unique et défini par Claude)
      const generated = results.find(r => r.order !== undefined && clip.order !== undefined && r.order === clip.order)
      return generated || clip
    })

    setGeneratedClips(updatedClips)
    onClipsUpdate(updatedClips) // Sauvegarder dans le state parent
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
                          src={videoUrl} 
                          className="w-full h-full object-cover"
                          poster={firstFrameUrl}
                          autoPlay
                          muted
                          loop
                          playsInline
                        />
                        {/* Bouton plein écran au hover */}
                        <button
                          onClick={() => setFullscreenVideo(videoUrl)}
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

                      {/* Completed: Regenerate buttons only */}
                      {isCompleted && generatedClip && (
                        <div className="mt-auto pt-4 border-t border-border">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">Régénérer :</span>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-9 text-sm px-4 rounded-lg border-orange-500/40 text-orange-600 hover:bg-orange-50 hover:border-orange-500"
                              onClick={() => askRegenerate(index, 'video')}
                              disabled={generating}
                            >
                              <Video className="w-4 h-4 mr-2" />
                              Vidéo
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-9 text-sm px-4 rounded-lg"
                              onClick={() => askRegenerate(index, 'voice')}
                              disabled={generating}
                            >
                              <Mic className="w-4 h-4 mr-2" />
                              Voix
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-9 text-sm px-4 rounded-lg"
                              onClick={() => askRegenerate(index, 'ambient')}
                              disabled={generating}
                            >
                              <Music className="w-4 h-4 mr-2" />
                              Ambiance
                            </Button>
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
                  onClick={handleFinish}
                  disabled={saving}
                  className="h-12 px-8 rounded-xl font-medium text-base bg-green-600 hover:bg-green-500"
                >
                  {saving ? 'Sauvegarde...' : '✓ Terminer et sauvegarder'}
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

      {/* Modal vidéo plein écran */}
      {fullscreenVideo && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreenVideo(null)}
        >
          <button
            onClick={() => setFullscreenVideo(null)}
            className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <video 
            src={fullscreenVideo} 
            className="max-h-[90vh] max-w-full rounded-xl"
            controls
            autoPlay
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
