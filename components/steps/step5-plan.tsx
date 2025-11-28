'use client'

import { useEffect, useState } from 'react'
import { NewCampaignState, CampaignClip, CampaignBrief } from '@/types'
import { usePlanGeneration } from '@/hooks/use-plan-generation'
import { useActors } from '@/hooks/use-actors'
import { getPresetById } from '@/lib/presets'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

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
  hook: 'bg-amber-600',
  problem: 'bg-red-600',
  agitation: 'bg-orange-600',
  solution: 'bg-green-600',
  proof: 'bg-blue-600',
  cta: 'bg-violet-600',
}

export function Step5Plan({ state, onClipsGenerated, onNext, onBack }: Step5PlanProps) {
  const { getActorById } = useActors()
  const { clips, loading, error, generatePlan, updateClipScript, setClips } = usePlanGeneration()
  const [editingClip, setEditingClip] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  const actor = state.actor_id ? getActorById(state.actor_id) : undefined
  const preset = state.preset_id ? getPresetById(state.preset_id) : undefined

  // Generate plan on mount if not already generated
  useEffect(() => {
    if (clips.length === 0 && actor && preset && state.brief.what_selling) {
      handleGeneratePlan()
    }
  }, [])

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

  const handleContinue = () => {
    if (clips.length > 0) {
      onNext()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Plan de campagne</h2>
        <p className="text-muted-foreground mt-2">
          Valide le script et les clips générés par l'IA
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-muted-foreground">Génération du plan en cours...</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Claude analyse ton brief et crée le script</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <Card className="bg-destructive/10 border-destructive">
          <CardContent className="p-4">
            <p className="text-destructive">{error}</p>
            <Button 
              variant="outline" 
              onClick={handleGeneratePlan} 
              className="mt-4"
            >
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Clips preview */}
      {!loading && clips.length > 0 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-4">
              <Badge variant="secondary">{clips.length} clips</Badge>
              <span className="text-sm text-muted-foreground">
                Durée totale : ~{clips.reduce((sum, c) => sum + c.video.duration, 0)}s
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleGeneratePlan}>
              🔄 Tout régénérer
            </Button>
          </div>

          {/* Clips list */}
          <div className="space-y-4">
            {clips.map((clip, index) => (
              <Card 
                key={clip.id || index} 
                className="bg-card border-border hover:border-primary/50 transition-colors"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">
                        {index + 1}
                      </span>
                      <Badge className={`${BEAT_COLORS[clip.beat]} text-white`}>
                        {BEAT_LABELS[clip.beat]}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {clip.video.duration}s • {clip.video.engine.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {clip.script.word_count} mots
                      </Badge>
                      {editingClip !== index && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => startEditing(index)}
                        >
                          ✏️ Modifier
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {editingClip === index ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="bg-background border-input min-h-[100px]"
                        placeholder="Script du clip..."
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {editText.split(/\s+/).filter(Boolean).length} mots
                        </span>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={cancelEdit}>
                            Annuler
                          </Button>
                          <Button size="sm" onClick={saveEdit}>
                            Sauvegarder
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Script */}
                      <p className="text-foreground leading-relaxed">
                        "{clip.script.text}"
                      </p>
                      
                      {/* First frame prompt preview */}
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Prompt visuel :</p>
                        <p className="text-sm text-muted-foreground/80 line-clamp-2">
                          {clip.first_frame.prompt}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          ← Retour
        </Button>
        <Button
          onClick={handleContinue}
          disabled={clips.length === 0 || loading}
          className="bg-primary hover:bg-primary/90"
        >
          Générer les vidéos
        </Button>
      </div>
    </div>
  )
}

