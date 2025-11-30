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
import { Slider } from '@/components/ui/slider'

interface Step6GenerateProps {
  state: NewCampaignState
  onComplete: (campaignId: string) => void
  onBack: () => void
}

const STATUS_LABELS: Record<ClipStatus, string> = {
  pending: 'En attente',
  generating_frame: 'Génération image...',
  generating_video: 'Génération vidéo...',
  generating_voice: 'Transformation voix...',
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
  const [expandedClip, setExpandedClip] = useState<number | null>(null)

  const actor = state.actor_id ? getActorById(state.actor_id) : undefined
  const preset = state.preset_id ? getPresetById(state.preset_id) : undefined
  const clips = state.generated_clips || []

  const handleStartGeneration = async () => {
    if (!actor || !preset || clips.length === 0) return

    setStarted(true)
    const tempCampaignId = `temp-${Date.now()}`
    setCampaignId(tempCampaignId)

    const results = await generateAllClips(
      clips,
      actor,
      tempCampaignId,
      preset.ambient_audio.prompt,
      preset.id
    )

    setGeneratedClips(results)
  }

  const handleRegenerateAsset = async (clipIndex: number, what: RegenerateWhat) => {
    if (!actor || !preset) return

    const clipToRegenerate = generatedClips[clipIndex] || clips[clipIndex]
    const result = await regenerateSingleClip(
      clipToRegenerate,
      actor,
      campaignId || 'temp',
      preset.ambient_audio.prompt,
      what,
      preset.id
    )

    if (result) {
      setGeneratedClips(prev => {
        const newClips = [...prev]
        newClips[clipIndex] = result
        return newClips
      })
    }
  }

  const handleVolumeChange = (clipIndex: number, type: 'voice' | 'ambient', value: number) => {
    setGeneratedClips(prev => {
      const newClips = [...prev]
      if (newClips[clipIndex]) {
        newClips[clipIndex] = {
          ...newClips[clipIndex],
          audio: {
            ...newClips[clipIndex].audio,
            [type === 'voice' ? 'voice_volume' : 'ambient_volume']: value,
          }
        }
      }
      return newClips
    })
  }

  const handleFinish = async () => {
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
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-2xl font-semibold tracking-tight">Génération en cours</h2>
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
        <Card className="rounded-2xl">
          <CardContent className="p-10 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted flex items-center justify-center">
              <span className="text-4xl">🎬</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">
              Prêt à générer {clips.length} clips
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              La génération peut prendre plusieurs minutes.
            </p>
            
            {/* Pipeline explanation */}
            <div className="text-left bg-muted/50 rounded-xl p-4 mb-8 max-w-md mx-auto">
              <p className="text-sm font-medium mb-2">Pipeline par clip :</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>1️⃣ <span className="text-amber-500">Image</span> — NanoBanana Pro (~0.15€)</p>
                <p>2️⃣ <span className="text-blue-500">Vidéo</span> — Veo3.1 (~1-2€) ⚠️</p>
                <p>3️⃣ <span className="text-violet-500">Voix</span> — Chatterbox S2S (~0.02€)</p>
                <p>4️⃣ <span className="text-fuchsia-500">Ambiance</span> — ElevenLabs (~0.03€)</p>
              </div>
              <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border">
                💡 Tu pourras régénérer voix/ambiance sans refaire la vidéo
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="ghost" onClick={onBack} className="h-11 px-5 rounded-xl">
                ← Modifier le plan
              </Button>
              <Button 
                onClick={handleStartGeneration}
                className="h-12 px-8 rounded-xl font-medium"
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
          <Card className="rounded-xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Progression globale</span>
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
              const isExpanded = expandedClip === index

              return (
                <Card key={clip.id || index} className="rounded-xl overflow-hidden">
                  <CardContent className="p-5">
                    {/* Header row */}
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
                      
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_COLORS[currentStatus]}>
                          {STATUS_LABELS[currentStatus]}
                        </Badge>
                        
                        {currentStatus === 'completed' && !generating && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setExpandedClip(isExpanded ? null : index)}
                          >
                            {isExpanded ? '▲' : '▼'}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Progress bar during generation */}
                    {clipProgress && !['completed', 'failed'].includes(clipProgress.status) && (
                      <div className="mt-3">
                        <Progress value={clipProgress.progress} className="h-1" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {clipProgress.message}
                        </p>
                      </div>
                    )}

                    {/* Failed state */}
                    {currentStatus === 'failed' && !generating && (
                      <div className="mt-3 flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleRegenerateAsset(index, 'all')}
                        >
                          🔄 Tout régénérer
                        </Button>
                      </div>
                    )}

                    {/* Expanded view for completed clips */}
                    {isExpanded && generatedClip && (
                      <div className="mt-4 pt-4 border-t border-border space-y-4">
                        {/* Video preview */}
                        {generatedClip.video?.raw_url && (
                          <div className="rounded-lg overflow-hidden bg-muted aspect-video">
                            <video 
                              src={generatedClip.video.raw_url} 
                              className="w-full h-full object-cover"
                              controls
                            />
                          </div>
                        )}

                        {/* Audio controls */}
                        <div className="grid grid-cols-2 gap-4">
                          {/* Voice volume */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">🎙️ Voix</span>
                              <span className="text-xs text-muted-foreground">
                                {generatedClip.audio?.voice_volume ?? 100}%
                              </span>
                            </div>
                            <Slider
                              value={[generatedClip.audio?.voice_volume ?? 100]}
                              min={0}
                              max={100}
                              step={5}
                              onValueChange={([v]) => handleVolumeChange(index, 'voice', v)}
                            />
                          </div>

                          {/* Ambient volume */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">🎵 Ambiance</span>
                              <span className="text-xs text-muted-foreground">
                                {generatedClip.audio?.ambient_volume ?? 20}%
                              </span>
                            </div>
                            <Slider
                              value={[generatedClip.audio?.ambient_volume ?? 20]}
                              min={0}
                              max={50}
                              step={5}
                              onValueChange={([v]) => handleVolumeChange(index, 'ambient', v)}
                            />
                          </div>
                        </div>

                        {/* Regenerate individual assets */}
                        <div className="flex flex-wrap gap-2 pt-2">
                          <span className="text-xs text-muted-foreground mr-2">Régénérer :</span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleRegenerateAsset(index, 'frame')}
                            disabled={generating}
                          >
                            🖼️ Image
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-7 text-xs text-orange-500 border-orange-500/30"
                            onClick={() => handleRegenerateAsset(index, 'video')}
                            disabled={generating}
                          >
                            🎬 Vidéo (coûteux)
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleRegenerateAsset(index, 'voice')}
                            disabled={generating}
                          >
                            🎙️ Voix
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleRegenerateAsset(index, 'ambient')}
                            disabled={generating}
                          >
                            🎵 Ambiance
                          </Button>
                        </div>

                        {/* Debug: show asset URLs */}
                        <details className="text-xs text-muted-foreground">
                          <summary className="cursor-pointer hover:text-foreground">
                            Assets générés
                          </summary>
                          <div className="mt-2 space-y-1 font-mono text-[10px] bg-muted p-2 rounded">
                            <p>🖼️ Frame: {generatedClip.first_frame?.image_url?.slice(0, 60)}...</p>
                            <p>🎬 Video: {generatedClip.video?.raw_url?.slice(0, 60)}...</p>
                            <p>🎙️ Voice: {generatedClip.audio?.transformed_voice_url?.slice(0, 60)}...</p>
                            <p>🎵 Ambient: {generatedClip.audio?.ambient_url?.slice(0, 60)}...</p>
                          </div>
                        </details>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-6">
            {generating ? (
              <Button variant="destructive" onClick={cancel} className="h-11 px-5 rounded-xl">
                ✕ Annuler
              </Button>
            ) : (
              <Button variant="ghost" onClick={onBack} className="h-11 px-5 rounded-xl">
                ← Retour au plan
              </Button>
            )}

            {allCompleted && (
              <Button 
                onClick={handleFinish}
                disabled={saving}
                className="h-11 px-6 rounded-xl font-medium bg-green-600 hover:bg-green-500"
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
