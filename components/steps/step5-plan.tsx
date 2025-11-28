'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NewCampaignState, CampaignClip, CampaignBrief, Actor } from '@/types'
import { usePlanGeneration } from '@/hooks/use-plan-generation'
import { getPresetById } from '@/lib/presets'
import { IntentionPreset } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

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
  hook: 'bg-amber-600',
  problem: 'bg-red-600',
  agitation: 'bg-orange-600',
  solution: 'bg-green-600',
  proof: 'bg-blue-600',
  cta: 'bg-violet-600',
}

export function Step5Plan({ state, onClipsGenerated, onNext, onBack }: Step5PlanProps) {
  const { clips, loading, error, generatePlan, updateClipScript, setClips } = usePlanGeneration()
  const [editingClip, setEditingClip] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [editingVisualPrompt, setEditingVisualPrompt] = useState<number | null>(null)
  const [editVisualText, setEditVisualText] = useState('')
  const [hasGenerated, setHasGenerated] = useState(false)
  const [actor, setActor] = useState<Actor | undefined>(undefined)
  const [actorLoading, setActorLoading] = useState(true)
  const [preset, setPreset] = useState<IntentionPreset | undefined>(undefined)
  const [presetLoading, setPresetLoading] = useState(true)
  const [firstFrames, setFirstFrames] = useState<FirstFrameStatus>({})
  const [generatingFrames, setGeneratingFrames] = useState(false)
  
  const supabase = createClient()

  // Generate first frame for a single clip
  const generateFirstFrame = useCallback(async (clipIndex: number, clip: CampaignClip) => {
    if (!actor?.soul_image_url) {
      console.error('No soul_image_url for actor:', actor)
      setFirstFrames(prev => ({
        ...prev,
        [clipIndex]: { loading: false, error: 'Pas d\'image SOUL' }
      }))
      return
    }

    // Check if URL is absolute (required for NanoBanana)
    if (!actor.soul_image_url.startsWith('http')) {
      console.error('soul_image_url must be an absolute URL:', actor.soul_image_url)
      setFirstFrames(prev => ({
        ...prev,
        [clipIndex]: { loading: false, error: 'Image SOUL non uploadée (URL locale)' }
      }))
      return
    }

    console.log(`Generating first frame ${clipIndex}:`, {
      soulImageUrl: actor.soul_image_url.slice(0, 50),
      prompt: clip.first_frame.prompt.slice(0, 50)
    })

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
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('First frame API error:', data)
        throw new Error(data.error || 'Failed to generate first frame')
      }
      
      console.log(`First frame ${clipIndex} generated:`, data.url?.slice(0, 50))
      
      setFirstFrames(prev => ({
        ...prev,
        [clipIndex]: { loading: false, url: data.url }
      }))
    } catch (err) {
      console.error('First frame generation error:', err)
      setFirstFrames(prev => ({
        ...prev,
        [clipIndex]: { loading: false, error: err instanceof Error ? err.message : 'Erreur génération' }
      }))
    }
  }, [actor])

  // Generate all first frames after plan is ready
  const generateAllFirstFrames = useCallback(async () => {
    if (!actor?.soul_image_url || clips.length === 0 || generatingFrames) return
    
    setGeneratingFrames(true)
    
    // Generate frames sequentially to avoid rate limits
    for (let i = 0; i < clips.length; i++) {
      await generateFirstFrame(i, clips[i])
      // Small delay between requests
      if (i < clips.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
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

      if (error) {
        console.error('Error loading actor:', error)
      }

      if (data) {
        console.log('Loaded actor:', data.name, data.soul_image_url?.slice(0, 50))
        setActor(data as Actor)
      }
      
      setActorLoading(false)
    }

    loadActor()
  }, [state.actor_id])

  // Load preset (from hardcoded or database)
  useEffect(() => {
    async function loadPreset() {
      if (!state.preset_id) {
        setPresetLoading(false)
        return
      }

      // First check hardcoded presets
      const hardcodedPreset = getPresetById(state.preset_id)
      if (hardcodedPreset) {
        setPreset(hardcodedPreset)
        setPresetLoading(false)
        return
      }

      // Then check database
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

  // Generate plan on mount if not already generated
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
    if (!actor || !preset || !state.brief.what_selling) {
      console.error('Missing data:', { actor, preset, brief: state.brief })
      return
    }

    console.log('Generating plan with:', { actor: actor.name, preset: preset.name, brief: state.brief })

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

  // Visual prompt editing
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
    handleGeneratePlan()
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

      {/* Debug info */}
      {!loading && clips.length === 0 && !error && (
        <Card className="bg-muted/50 border-border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-2">Debug :</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>Acteur : {actorLoading ? '⏳ Chargement...' : actor ? `✓ ${actor.name}` : `✗ Non trouvé (ID: ${state.actor_id})`}</li>
              <li>Preset : {presetLoading ? '⏳ Chargement...' : preset ? `✓ ${preset.name}` : `✗ Non trouvé (ID: ${state.preset_id})`}</li>
              <li>Brief : {state.brief.what_selling ? `✓ ${state.brief.what_selling.slice(0, 30)}...` : '✗ Vide'}</li>
            </ul>
            {actor && preset && state.brief.what_selling && !actorLoading && !presetLoading && (
              <Button 
                onClick={handleGeneratePlan} 
                className="mt-4"
                disabled={loading}
              >
                🚀 Lancer la génération
              </Button>
            )}
          </CardContent>
        </Card>
      )}

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
            <p className="text-destructive font-medium mb-2">Erreur :</p>
            <p className="text-destructive/80 text-sm">{error}</p>
            <Button 
              variant="outline" 
              onClick={handleRegenerate} 
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
              {generatingFrames && (
                <span className="text-sm text-primary flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Génération des images...
                </span>
              )}
              {!generatingFrames && Object.values(firstFrames).filter(f => f.url).length === clips.length && (
                <span className="text-sm text-green-500">✓ {clips.length} images générées</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setFirstFrames({})
                  setTimeout(generateAllFirstFrames, 100)
                }}
                disabled={generatingFrames}
              >
                🖼️ Regénérer images
              </Button>
              <Button variant="outline" size="sm" onClick={handleRegenerate}>
                🔄 Tout régénérer
              </Button>
            </div>
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
                    <div className="flex gap-4">
                      {/* First Frame Preview */}
                      <div className="flex-shrink-0 w-24">
                        <div className="aspect-[9/16] rounded-lg bg-muted/50 overflow-hidden relative">
                          {firstFrames[index]?.loading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                              <span className="text-[10px] text-muted-foreground mt-1">Génération...</span>
                            </div>
                          ) : firstFrames[index]?.url ? (
                            <img 
                              src={firstFrames[index].url} 
                              alt={`First frame clip ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : firstFrames[index]?.error ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                              <span className="text-[10px] text-destructive text-center">{firstFrames[index].error}</span>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="mt-1 h-6 text-[10px]"
                                onClick={() => generateFirstFrame(index, clip)}
                              >
                                Réessayer
                              </Button>
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                              <span className="text-[10px] text-muted-foreground text-center">En attente</span>
                            </div>
                          )}
                        </div>
                        {firstFrames[index]?.url && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full mt-1 h-6 text-[10px]"
                            onClick={() => generateFirstFrame(index, clip)}
                          >
                            🔄 Regénérer
                          </Button>
                        )}
                      </div>

                      {/* Script & Info */}
                      <div className="flex-1 space-y-3">
                        {/* Script */}
                        <p className="text-foreground leading-relaxed">
                          "{clip.script.text}"
                        </p>
                        
                        {/* First frame prompt preview */}
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-muted-foreground">Prompt visuel :</p>
                            {editingVisualPrompt !== index && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-5 text-[10px] px-2"
                                onClick={() => startEditingVisual(index)}
                              >
                                ✏️ Éditer
                              </Button>
                            )}
                          </div>
                          {editingVisualPrompt === index ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editVisualText}
                                onChange={(e) => setEditVisualText(e.target.value)}
                                className="bg-background border-input min-h-[80px] text-sm"
                                placeholder="Prompt visuel pour la first frame..."
                              />
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelVisualEdit}>
                                  Annuler
                                </Button>
                                <Button size="sm" className="h-7 text-xs" onClick={() => {
                                  saveVisualEdit()
                                  // Regénérer la first frame avec le nouveau prompt
                                  generateFirstFrame(index, { ...clip, first_frame: { ...clip.first_frame, prompt: editVisualText } })
                                }}>
                                  Sauvegarder & Regénérer
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground/80 line-clamp-2">
                              {clip.first_frame.prompt}
                            </p>
                          )}
                        </div>
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
