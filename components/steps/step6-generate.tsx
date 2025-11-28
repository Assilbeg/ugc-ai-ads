'use client'

import { useState, useEffect } from 'react'
import { NewCampaignState, CampaignClip, ClipStatus } from '@/types'
import { useVideoGeneration } from '@/hooks/use-video-generation'
import { useActors } from '@/hooks/use-actors'
import { useCampaignCreation } from '@/hooks/use-campaign-creation'
import { getPresetById } from '@/lib/presets'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

interface Step6GenerateProps {
  state: NewCampaignState
  onComplete: (campaignId: string) => void
  onBack: () => void
}

const STATUS_LABELS: Record<ClipStatus, string> = {
  pending: 'En attente',
  generating_frame: 'Génération image...',
  generating_video: 'Génération vidéo...',
  generating_voice: 'Clonage voix...',
  generating_ambient: 'Ambiance sonore...',
  completed: 'Terminé',
  failed: 'Échec',
}

const STATUS_COLORS: Record<ClipStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  generating_frame: 'bg-amber-600 text-white',
  generating_video: 'bg-blue-600 text-white',
  generating_voice: 'bg-violet-600 text-white',
  generating_ambient: 'bg-fuchsia-600 text-white',
  completed: 'bg-green-600 text-white',
  failed: 'bg-destructive text-destructive-foreground',
}

export function Step6Generate({ state, onComplete, onBack }: Step6GenerateProps) {
  const { getActorById } = useActors()
  const { generating, progress, generateAllClips, regenerateSingleClip, cancel, getOverallProgress } = useVideoGeneration()
  const { saveCampaign, saving } = useCampaignCreation()
  
  const [generatedClips, setGeneratedClips] = useState<CampaignClip[]>([])
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [started, setStarted] = useState(false)

  const actor = state.actor_id ? getActorById(state.actor_id) : undefined
  const preset = state.preset_id ? getPresetById(state.preset_id) : undefined
  const clips = state.generated_clips || []

  const handleStartGeneration = async () => {
    if (!actor || !preset || clips.length === 0) return

    setStarted(true)

    // First save the campaign to get an ID
    // Note: In a real implementation, saveCampaign would need access to state
    // For now, we'll generate a temporary ID
    const tempCampaignId = `temp-${Date.now()}`
    setCampaignId(tempCampaignId)

    // Generate all clips
    const results = await generateAllClips(
      clips,
      actor,
      tempCampaignId,
      preset.ambient_audio.prompt
    )

    setGeneratedClips(results)
  }

  const handleRegenerateClip = async (clipIndex: number) => {
    if (!actor || !preset) return

    const clip = clips[clipIndex]
    const result = await regenerateSingleClip(
      clip,
      actor,
      campaignId || 'temp',
      preset.ambient_audio.prompt,
      'all'
    )

    if (result) {
      setGeneratedClips(prev => prev.map((c, i) => i === clipIndex ? result : c))
    }
  }

  const handleFinish = async () => {
    // Save final campaign to database
    // In a real implementation, this would update the campaign with generated URLs
    if (campaignId) {
      onComplete(campaignId)
    }
  }

  const allCompleted = generatedClips.length > 0 && 
    generatedClips.every(c => c.status === 'completed')

  const hasFailures = generatedClips.some(c => c.status === 'failed')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Génération en cours</h2>
        <p className="text-muted-foreground mt-2">
          {!started 
            ? 'Prêt à générer tes vidéos UGC' 
            : generating 
              ? 'Les vidéos sont en cours de génération...'
              : allCompleted
                ? '🎉 Toutes les vidéos sont prêtes !'
                : hasFailures
                  ? 'Certains clips ont échoué. Tu peux les régénérer.'
                  : 'Génération terminée'
          }
        </p>
      </div>

      {/* Not started state */}
      {!started && (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-4xl">🎬</span>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Prêt à générer {clips.length} clips
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              La génération peut prendre plusieurs minutes. 
              Chaque clip passera par : image → vidéo → voix → ambiance.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="ghost" onClick={onBack}>
                ← Modifier le plan
              </Button>
              <Button 
                onClick={handleStartGeneration}
                className="bg-primary hover:bg-primary/90"
                size="lg"
              >
                🚀 Lancer la génération
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generation in progress */}
      {started && (
        <div className="space-y-4">
          {/* Overall progress */}
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  Progression globale
                </span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(getOverallProgress())}%
                </span>
              </div>
              <Progress value={getOverallProgress()} className="h-2" />
            </CardContent>
          </Card>

          {/* Clips progress */}
          <div className="grid gap-4">
            {clips.map((clip, index) => {
              const clipProgress = progress[clip.id || `clip-${clip.order}`]
              const generatedClip = generatedClips[index]
              const currentStatus = clipProgress?.status || generatedClip?.status || 'pending'

              return (
                <Card 
                  key={clip.id || index}
                  className="bg-card border-border"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-foreground line-clamp-1">
                            {clip.script.text.slice(0, 50)}...
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {clip.video.duration}s • {clip.beat.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge className={STATUS_COLORS[currentStatus]}>
                          {STATUS_LABELS[currentStatus]}
                        </Badge>
                        
                        {currentStatus === 'failed' && !generating && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleRegenerateClip(index)}
                          >
                            🔄 Réessayer
                          </Button>
                        )}

                        {currentStatus === 'completed' && !generating && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRegenerateClip(index)}
                          >
                            🔄
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Individual progress bar */}
                    {clipProgress && clipProgress.status !== 'completed' && clipProgress.status !== 'failed' && (
                      <div className="mt-3">
                        <Progress value={clipProgress.progress} className="h-1" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {clipProgress.message}
                        </p>
                      </div>
                    )}

                    {/* Preview when completed */}
                    {generatedClip?.video?.url && (
                      <div className="mt-3 rounded-lg overflow-hidden bg-muted aspect-video">
                        <video 
                          src={generatedClip.video.url} 
                          className="w-full h-full object-cover"
                          controls
                          muted
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            {generating ? (
              <Button variant="destructive" onClick={cancel}>
                ✕ Annuler
              </Button>
            ) : (
              <Button variant="ghost" onClick={onBack}>
                ← Retour au plan
              </Button>
            )}

            {allCompleted && (
              <Button 
                onClick={handleFinish}
                disabled={saving}
                className="bg-green-600 hover:bg-green-500"
              >
                {saving ? 'Sauvegarde...' : '✓ Terminer et sauvegarder'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

