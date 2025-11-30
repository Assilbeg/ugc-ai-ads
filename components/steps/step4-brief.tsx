'use client'

import { useState, useEffect } from 'react'
import { CampaignBrief, CampaignClip, Actor, IntentionPreset, ProductConfig } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Sparkles, Check, Clock, Target, Gift, ShoppingBag, AlertCircle, Link, Loader2, Wand2, ImageIcon, FileText } from 'lucide-react'

// Configuration des beats pour l'animation
const BEAT_STEPS = [
  { beat: 'hook', label: 'HOOK', emoji: '🎣', color: 'bg-amber-500' },
  { beat: 'problem', label: 'PROBLÈME', emoji: '😰', color: 'bg-red-500' },
  { beat: 'solution', label: 'SOLUTION', emoji: '✨', color: 'bg-emerald-500' },
  { beat: 'proof', label: 'PREUVE', emoji: '📊', color: 'bg-blue-500' },
  { beat: 'cta', label: 'CTA', emoji: '🚀', color: 'bg-violet-500' },
]

// Animation de chargement pendant la génération
function GeneratingAnimation({ phase }: { phase: 'script' | 'images' }) {
  const [progress, setProgress] = useState(0)
  const [scriptDone, setScriptDone] = useState(false)
  const [beatProgress, setBeatProgress] = useState<Record<string, number>>({})
  const [completedBeats, setCompletedBeats] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (phase === 'images' && !scriptDone) {
      setScriptDone(true)
    }
  }, [phase, scriptDone])

  // Animation de la barre principale
  useEffect(() => {
    const duration = phase === 'script' ? 15000 : 10000
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const linearProgress = Math.min(elapsed / duration, 1)
      const easedProgress = 1 - Math.pow(1 - linearProgress, 2)
      
      if (phase === 'script') {
        setProgress(easedProgress * 55)
      } else {
        setProgress(55 + easedProgress * 40)
      }
      
      if (linearProgress < 1) {
        requestAnimationFrame(animate)
      }
    }
    
    requestAnimationFrame(animate)
  }, [phase])

  // Animation des tuiles de beats (seulement en phase script)
  useEffect(() => {
    if (phase !== 'script') return

    // Durées variées pour chaque beat
    const beatDurations: Record<string, number> = {}
    BEAT_STEPS.forEach((step, index) => {
      const baseDuration = 6000 + (index * 1500)
      const randomVariation = Math.random() * 3000 - 1000
      beatDurations[step.beat] = Math.max(4000, baseDuration + randomVariation)
    })

    // Lancer chaque beat avec un décalage
    BEAT_STEPS.forEach((step, index) => {
      const startDelay = 500 + (index * 600)
      const duration = beatDurations[step.beat]

      setTimeout(() => {
        const startTime = Date.now()
        
        const animate = () => {
          const elapsed = Date.now() - startTime
          const linearProgress = Math.min(elapsed / duration, 1)
          const easedProgress = 1 - Math.pow(1 - linearProgress, 2.5)
          const progressPercent = easedProgress * 100
          
          setBeatProgress(prev => ({ ...prev, [step.beat]: progressPercent }))
          
          if (linearProgress < 1) {
            requestAnimationFrame(animate)
          } else {
            // Attendre que la barre soit visuellement à 100% avant d'afficher la checkmark
            setTimeout(() => {
              setCompletedBeats(prev => new Set([...prev, step.beat]))
            }, 150)
          }
        }
        
        requestAnimationFrame(animate)
      }, startDelay)
    })
  }, [phase])

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center overflow-hidden">
      <div className="max-w-2xl w-full mx-4 space-y-8">
        {/* Title */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-full text-sm font-medium mb-2">
            <Sparkles className="w-4 h-4 animate-pulse" />
            Création en cours...
          </div>
          <p className="text-sm text-muted-foreground">
            {phase === 'script' ? 'Écriture du script parfait...' : 'Préparation des visuels...'}
          </p>
        </div>

        {/* Progress bar principale */}
        <div className="space-y-2">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-foreground rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Beat tiles grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {BEAT_STEPS.map((item, index) => {
            const isCompleted = completedBeats.has(item.beat)
            const stepProgress = beatProgress[item.beat] || 0
            const isActive = stepProgress > 0 && !isCompleted
            
            return (
              <div
                key={item.beat}
                className={`
                  relative overflow-hidden rounded-2xl border bg-card p-4
                  transition-all duration-300
                  ${isCompleted ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-border'}
                  ${isActive ? 'ring-1 ring-foreground/10' : ''}
                `}
                style={{ 
                  opacity: 0,
                  animation: `fadeSlideUp 0.4s ease-out ${index * 0.1}s forwards`
                }}
              >
                {/* Shimmer effect */}
                {isActive && (
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent"
                    style={{ animation: 'shimmer 1.5s infinite' }}
                  />
                )}
                
                <div className="flex items-center gap-3">
                  <div className={`relative w-10 h-10 rounded-xl ${item.color} flex items-center justify-center text-lg`}>
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
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${isCompleted ? 'text-green-700 dark:text-green-400' : 'text-foreground'}`}>
                      {item.label}
                    </p>
                    <div className="h-1.5 mt-1.5 bg-muted rounded-full overflow-hidden">
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
            )
          })}
        </div>

        {/* Phase indicators */}
        <div className="flex gap-3">
          {/* Script phase */}
          <div className={`flex-1 flex items-center gap-3 p-3 rounded-xl border transition-all ${
            scriptDone 
              ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' 
              : phase === 'script' 
                ? 'border-foreground/20 bg-muted/50' 
                : 'border-border'
          }`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              scriptDone ? 'bg-green-500' : 'bg-foreground/10'
            }`}>
              {scriptDone ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <FileText className={`w-4 h-4 ${phase === 'script' ? 'animate-pulse' : ''}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-medium text-sm ${scriptDone ? 'text-green-700 dark:text-green-400' : ''}`}>
                Script
              </p>
            </div>
            {phase === 'script' && !scriptDone && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Images phase */}
          <div className={`flex-1 flex items-center gap-3 p-3 rounded-xl border transition-all ${
            phase === 'images' 
              ? 'border-foreground/20 bg-muted/50' 
              : 'border-border opacity-50'
          }`}>
            <div className="w-8 h-8 rounded-lg bg-foreground/10 flex items-center justify-center">
              <ImageIcon className={`w-4 h-4 ${phase === 'images' ? 'animate-pulse' : ''}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Images</p>
            </div>
            {phase === 'images' && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface Step4BriefProps {
  brief: Partial<CampaignBrief>
  onChange: (brief: Partial<CampaignBrief>) => void
  onNext: () => void
  onBack: () => void
  // Nouvelles props pour pré-générer le plan
  actor?: Actor
  preset?: IntentionPreset
  product: ProductConfig
  onClipsGenerated?: (clips: CampaignClip[]) => void
  onFirstFramesUpdate?: (frames: { [index: number]: { url: string; generatedAt: number } }) => void
}

const DURATION_OPTIONS = [
  { value: 15, label: '15s', clips: '2-3 clips' },
  { value: 30, label: '30s', clips: '4-5 clips' },
  { value: 45, label: '45s', clips: '5-6 clips' },
  { value: 60, label: '60s', clips: '6-8 clips' },
]

export function Step4Brief({ brief, onChange, onNext, onBack, actor, preset, product, onClipsGenerated, onFirstFramesUpdate }: Step4BriefProps) {
  const [url, setUrl] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [extracted, setExtracted] = useState(false)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [generationPhase, setGenerationPhase] = useState<'script' | 'images'>('script')
  const [planError, setPlanError] = useState<string | null>(null)

  const handleExtractFromUrl = async () => {
    if (!url.trim()) return

    setExtracting(true)
    setExtractError(null)

    try {
      const response = await fetch('/api/extract-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur d\'extraction')
      }

      onChange({
        ...brief,
        what_selling: data.brief.what_selling || brief.what_selling,
        pain_point: data.brief.pain_point || brief.pain_point,
        target_audience: data.brief.target_audience || brief.target_audience,
        key_benefits: data.brief.key_benefits || brief.key_benefits,
      })

      setExtracted(true)
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Erreur d\'extraction')
    } finally {
      setExtracting(false)
    }
  }

  const canContinue = brief.what_selling && brief.what_selling.length > 10 && brief.pain_point && brief.pain_point.length > 10 && brief.target_duration

  // Générer le plan, lancer les first frames, puis passer à l'étape suivante
  const handleGenerateAndContinue = async () => {
    if (!canContinue) return

    // Si on a toutes les données pour pré-générer le plan
    if (actor && preset && onClipsGenerated) {
      setGeneratingPlan(true)
      setGenerationPhase('script')
      setPlanError(null)

      try {
        // 1. Générer le plan (script)
        const response = await fetch('/api/generate/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actor,
            preset,
            brief: brief as CampaignBrief,
            product,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Erreur de génération')
        }

        const data = await response.json()
        
        // 2. Passer à la phase "images" 
        setGenerationPhase('images')

        // 3. Générer les first frames (au moins les 2 premiers)
        let updatedClips = [...data.clips]
        
        if (actor.soul_image_url && data.clips.length > 0) {
          // Générer les 2 premiers first frames en parallèle
          const framesToGenerate = Math.min(2, data.clips.length)
          const framePromises = []
          
          for (let i = 0; i < framesToGenerate; i++) {
            const clip = data.clips[i]
            framePromises.push(
              fetch('/api/generate/first-frame', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  soulImageUrl: actor.soul_image_url,
                  prompt: clip?.first_frame?.prompt || '',
                  actorId: actor.id, // Pour le cache des assets
                }),
              })
                .then(res => res.ok ? res.json() : null)
                .then(result => ({ index: i, url: result?.url, cached: result?.cached }))
                .catch(() => ({ index: i, url: null }))
            )
          }
          
          // Attendre toutes les générations
          const results = await Promise.all(framePromises)
          
          // Mettre à jour les clips avec les URLs générées
          const generatedFrames: { [index: number]: { url: string; generatedAt: number } } = {}
          
          for (const result of results) {
            if (result.url && updatedClips[result.index]) {
              updatedClips[result.index] = {
                ...updatedClips[result.index],
                first_frame: {
                  ...updatedClips[result.index].first_frame,
                  image_url: result.url,
                },
              }
              // Sauvegarder pour le cache
              generatedFrames[result.index] = {
                url: result.url,
                generatedAt: Date.now(),
              }
            }
          }
          
          // Sauvegarder les first frames dans le state parent
          if (onFirstFramesUpdate && Object.keys(generatedFrames).length > 0) {
            onFirstFramesUpdate(generatedFrames)
          }
        }
        
        // Passer les clips (avec les first frames) au parent
        onClipsGenerated(updatedClips)
        
        // 5. Passer à l'étape suivante
        onNext()
      } catch (err) {
        setPlanError(err instanceof Error ? err.message : 'Erreur de génération')
        setGeneratingPlan(false)
      }
    } else {
      // Pas de pré-génération, on passe directement
      onNext()
    }
  }

  return (
    <div className="space-y-8">
      {/* Animation de génération */}
      {generatingPlan && (
        <GeneratingAnimation phase={generationPhase} />
      )}

      {/* Header */}
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-2xl font-semibold tracking-tight">Brief rapide</h2>
        <p className="text-muted-foreground mt-2">
          Décris ton offre pour que l'IA génère le meilleur script
        </p>
      </div>

      {/* Brief form */}
      <div className="max-w-2xl mx-auto space-y-6">
        {/* URL Import Section */}
        <Card className={`p-5 rounded-2xl border-dashed transition-all ${extracted ? 'border-green-500 bg-green-50/50 dark:bg-green-950/20' : 'border-border'}`}>
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${extracted ? 'bg-green-500' : 'bg-foreground/5'}`}>
              {extracted ? (
                <Check className="w-5 h-5 text-white" />
              ) : (
                <Wand2 className={`w-5 h-5 ${extracting ? 'animate-pulse' : ''} text-foreground/70`} />
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-medium text-sm">
                  {extracted ? '✨ Brief pré-rempli depuis ton site !' : 'Tu as un site ou une landing page ?'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {extracted 
                    ? 'Tu peux éditer les champs ci-dessous si besoin'
                    : 'Colle l\'URL et on extrait les infos automatiquement'
                  }
                </p>
              </div>
              {!extracted && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="https://ton-site.com/produit"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="pl-9 h-10 rounded-xl border-border bg-background focus:border-foreground text-sm"
                      disabled={extracting}
                    />
                  </div>
                  <Button
                    onClick={handleExtractFromUrl}
                    disabled={!url.trim() || extracting}
                    className="h-10 px-4 rounded-xl"
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyse...
                      </>
                    ) : (
                      'Extraire'
                    )}
                  </Button>
                </div>
              )}
              {extractError && (
                <p className="text-xs text-destructive">{extractError}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Separator */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">ou remplis manuellement</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* What are you selling */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-foreground/70" />
            </div>
            <Label className="text-base font-medium">
              Qu'est-ce que tu vends ? <span className="text-destructive">*</span>
            </Label>
          </div>
          <Textarea
            placeholder="Ex: Une formation en ligne pour apprendre à coder en Python en 30 jours, idéale pour les débutants qui veulent se reconvertir dans la tech..."
            value={brief.what_selling || ''}
            onChange={(e) => onChange({ ...brief, what_selling: e.target.value })}
            className="min-h-[120px] rounded-xl border-border bg-background focus:border-foreground focus:ring-1 focus:ring-foreground/20 resize-none text-base"
          />
          <p className="text-xs text-muted-foreground">
            Plus tu es précis, meilleur sera le script généré
          </p>
        </div>

        {/* Pain point - THE KEY FIELD */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <Label className="text-base font-medium">
              Quel problème ça résout ? <span className="text-destructive">*</span>
            </Label>
          </div>
          <Textarea
            placeholder="Ex: Les gens veulent se reconvertir dans la tech mais ils ont peur de ne pas y arriver, ils pensent que c'est trop compliqué et qu'ils sont trop vieux pour apprendre à coder..."
            value={brief.pain_point || ''}
            onChange={(e) => onChange({ ...brief, pain_point: e.target.value })}
            className="min-h-[120px] rounded-xl border-border bg-background focus:border-foreground focus:ring-1 focus:ring-foreground/20 resize-none text-base"
          />
          <p className="text-xs text-muted-foreground">
            💡 La frustration de ton audience — c'est ce qui rendra le script percutant
          </p>
        </div>

        {/* Two columns for optional fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Target audience (optional) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
                <Target className="w-4 h-4 text-foreground/70" />
              </div>
              <Label className="text-base font-medium">Audience cible</Label>
            </div>
            <Input
              placeholder="Freelances, entrepreneurs..."
              value={brief.target_audience || ''}
              onChange={(e) => onChange({ ...brief, target_audience: e.target.value })}
              className="h-12 rounded-xl border-border bg-background focus:border-foreground focus:ring-1 focus:ring-foreground/20 text-base"
            />
          </div>

          {/* Key benefits (optional) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
                <Gift className="w-4 h-4 text-foreground/70" />
              </div>
              <Label className="text-base font-medium">Bénéfices clés</Label>
            </div>
            <Input
              placeholder="Gain de temps, simplicité..."
              value={brief.key_benefits?.[0] || ''}
              onChange={(e) => onChange({ ...brief, key_benefits: e.target.value ? [e.target.value] : [] })}
              className="h-12 rounded-xl border-border bg-background focus:border-foreground focus:ring-1 focus:ring-foreground/20 text-base"
            />
          </div>
        </div>

        {/* Duration selection */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
              <Clock className="w-4 h-4 text-foreground/70" />
            </div>
            <Label className="text-base font-medium">
              Durée souhaitée <span className="text-destructive">*</span>
            </Label>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {DURATION_OPTIONS.map((option) => {
              const isSelected = brief.target_duration === option.value
              return (
                <Card
                  key={option.value}
                  className={`
                    cursor-pointer transition-all duration-200 rounded-xl p-0 gap-0
                    ${isSelected
                      ? 'ring-2 ring-foreground bg-foreground text-background shadow-md'
                      : 'border-border hover:border-foreground/30 bg-background'
                    }
                  `}
                  onClick={() => onChange({ ...brief, target_duration: option.value as 15 | 30 | 45 | 60 })}
                >
                  <div className="p-4 text-center relative">
                    <div className="text-2xl font-bold">{option.label}</div>
                    <div className={`text-xs mt-1 ${isSelected ? 'text-background/70' : 'text-muted-foreground'}`}>
                      {option.clips}
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-background rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-foreground" />
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      </div>

      {/* Error message */}
      {planError && (
        <div className="max-w-2xl mx-auto">
          <Card className="bg-destructive/5 border-destructive/20 p-4 rounded-xl">
            <p className="text-destructive text-sm">{planError}</p>
          </Card>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between max-w-2xl mx-auto pt-4">
        <Button variant="ghost" onClick={onBack} disabled={generatingPlan} className="h-11 px-5 rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button
          onClick={handleGenerateAndContinue}
          disabled={!canContinue || generatingPlan}
          className="h-11 px-6 rounded-xl font-medium group"
        >
          {generatingPlan ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Génération du script...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Générer le plan
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

