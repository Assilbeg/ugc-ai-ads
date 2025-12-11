'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { CampaignBrief, CampaignClip, Actor, IntentionPreset, ProductConfig, ScriptLanguage } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Sparkles, Check, Clock, Target, Gift, ShoppingBag, AlertCircle, Link, Loader2, Wand2, ImageIcon, FileText, Globe } from 'lucide-react'

// Configuration des beats pour l'animation
const BEAT_STEPS = [
  { beat: 'hook', emoji: '🎣', color: 'bg-amber-500' },
  { beat: 'problem', emoji: '😰', color: 'bg-red-500' },
  { beat: 'solution', emoji: '✨', color: 'bg-emerald-500' },
  { beat: 'proof', emoji: '📊', color: 'bg-blue-500' },
  { beat: 'cta', emoji: '🚀', color: 'bg-violet-500' },
]

// Animation de chargement pendant la génération
function GeneratingAnimation({ phase }: { phase: 'script' | 'images' }) {
  const t = useTranslations('step4')
  const [progress, setProgress] = useState(0)
  const [scriptDone, setScriptDone] = useState(false)
  const [beatProgress, setBeatProgress] = useState<Record<string, number>>({})
  const [completedBeats, setCompletedBeats] = useState<Set<string>>(new Set())
  const beatSteps = BEAT_STEPS.map((step) => ({
    ...step,
    label: t(`beats.${step.beat}` as const),
  }))

  useEffect(() => {
    if (phase === 'images' && !scriptDone) {
      setScriptDone(true)
    }
  }, [phase, scriptDone])

  // Animation de la barre principale - plus progressive
  useEffect(() => {
    const duration = phase === 'script' ? 15000 : 10000
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const linearProgress = Math.min(elapsed / duration, 1)
      // Courbe plus linéaire pour une progression plus visible
      const easedProgress = linearProgress * 0.7 + Math.pow(linearProgress, 2) * 0.3
      
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
    <div className="fixed inset-0 bg-background z-[100] flex items-center justify-center overflow-hidden">
      <div className="max-w-2xl w-full mx-4 space-y-8">
        {/* Title */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-full text-sm font-medium mb-2">
            <Sparkles className="w-4 h-4 animate-pulse" />
            {t('generating.badge')}
          </div>
          <p className="text-sm text-muted-foreground">
            {phase === 'script' ? t('generating.scriptSubtitle') : t('generating.imagesSubtitle')}
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
          {beatSteps.map((item, index) => {
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
                {t('generating.scriptLabel')}
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
              <p className="font-medium text-sm">{t('generating.imagesLabel')}</p>
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
  { value: 15, labelKey: 'duration.options.s15.label', clipsKey: 'duration.options.s15.clips' },
  { value: 30, labelKey: 'duration.options.s30.label', clipsKey: 'duration.options.s30.clips' },
  { value: 45, labelKey: 'duration.options.s45.label', clipsKey: 'duration.options.s45.clips' },
  { value: 60, labelKey: 'duration.options.s60.label', clipsKey: 'duration.options.s60.clips' },
]

const LANGUAGE_OPTIONS: { value: ScriptLanguage; label: string; flag: string }[] = [
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'en-us', label: 'English (US)', flag: '🇺🇸' },
  { value: 'en-uk', label: 'English (UK)', flag: '🇬🇧' },
  { value: 'es', label: 'Español (España)', flag: '🇪🇸' },
  { value: 'es-latam', label: 'Español (Latam)', flag: '🇲🇽' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'it', label: 'Italiano', flag: '🇮🇹' },
  { value: 'pt-br', label: 'Português (BR)', flag: '🇧🇷' },
  { value: 'pt', label: 'Português (PT)', flag: '🇵🇹' },
  { value: 'nl', label: 'Nederlands', flag: '🇳🇱' },
]

export function Step4Brief({ brief, onChange, onNext, onBack, actor, preset, product, onClipsGenerated, onFirstFramesUpdate }: Step4BriefProps) {
  const [url, setUrl] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [extracted, setExtracted] = useState(false)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [generationPhase, setGenerationPhase] = useState<'script' | 'images'>('script')
  const [planError, setPlanError] = useState<string | null>(null)
  const t = useTranslations('step4')
  const tCommon = useTranslations('common')

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
        throw new Error(data.error || t('import.error'))
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
      setExtractError(err instanceof Error ? err.message : t('import.error'))
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
          throw new Error(data.error || t('errors.generation'))
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
                .then(async res => {
                  if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}))
                    console.error(`First frame ${i} failed:`, errorData.error || res.statusText)
                    return null
                  }
                  return res.json()
                })
                .then(result => ({ index: i, url: result?.url, cached: result?.cached }))
                .catch((err) => {
                  console.error(`First frame ${i} error:`, err)
                  return { index: i, url: null }
                })
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
        setPlanError(err instanceof Error ? err.message : t('errors.generation'))
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
        <h2 className="text-2xl font-semibold tracking-tight">{t('header.title')}</h2>
        <p className="text-muted-foreground mt-2">
          {t('header.subtitle')}
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
                  {extracted ? t('import.titleExtracted') : t('import.titleDefault')}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {extracted 
                    ? t('import.subtitleExtracted')
                    : t('import.subtitleDefault')
                  }
                </p>
              </div>
              {!extracted && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={t('import.placeholder')}
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
                        {t('import.loading')}
                      </>
                    ) : (
                      t('import.action')
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
          <span className="text-xs text-muted-foreground">{t('manualDivider')}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* What are you selling */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-foreground/70" />
            </div>
            <Label className="text-base font-medium">
              {t('fields.whatSelling.label')} <span className="text-destructive">*</span>
            </Label>
          </div>
          <Textarea
            placeholder={t('fields.whatSelling.placeholder')}
            value={brief.what_selling || ''}
            onChange={(e) => onChange({ ...brief, what_selling: e.target.value })}
            className="min-h-[120px] rounded-xl border-border bg-background focus:border-foreground focus:ring-1 focus:ring-foreground/20 resize-none text-base"
          />
          <p className="text-xs text-muted-foreground">
            {t('fields.whatSelling.helper')}
          </p>
        </div>

        {/* Pain point - THE KEY FIELD */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <Label className="text-base font-medium">
              {t('fields.painPoint.label')} <span className="text-destructive">*</span>
            </Label>
          </div>
          <Textarea
            placeholder={t('fields.painPoint.placeholder')}
            value={brief.pain_point || ''}
            onChange={(e) => onChange({ ...brief, pain_point: e.target.value })}
            className="min-h-[120px] rounded-xl border-border bg-background focus:border-foreground focus:ring-1 focus:ring-foreground/20 resize-none text-base"
          />
          <p className="text-xs text-muted-foreground">
            {t('fields.painPoint.helper')}
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
            <Label className="text-base font-medium">{t('fields.targetAudience.label')}</Label>
            </div>
            <Input
            placeholder={t('fields.targetAudience.placeholder')}
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
            <Label className="text-base font-medium">{t('fields.keyBenefits.label')}</Label>
            </div>
            <Input
            placeholder={t('fields.keyBenefits.placeholder')}
              value={brief.key_benefits?.[0] || ''}
              onChange={(e) => onChange({ ...brief, key_benefits: e.target.value ? [e.target.value] : [] })}
              className="h-12 rounded-xl border-border bg-background focus:border-foreground focus:ring-1 focus:ring-foreground/20 text-base"
            />
          </div>
        </div>

        {/* Duration and Language selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Duration selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
                <Clock className="w-4 h-4 text-foreground/70" />
              </div>
              <Label className="text-base font-medium">
                {t('duration.label')} <span className="text-destructive">*</span>
              </Label>
            </div>
            <div className="grid grid-cols-4 gap-2">
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
                    <div className="p-3 text-center relative">
                      <div className="text-lg font-bold">{t(option.labelKey as any)}</div>
                      <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-background/70' : 'text-muted-foreground'}`}>
                        {t(option.clipsKey as any)}
                      </div>
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-background rounded-full flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-foreground" />
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Language selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
                <Globe className="w-4 h-4 text-foreground/70" />
              </div>
              <Label className="text-base font-medium">{t('language.label')}</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGE_OPTIONS.slice(0, 4).map((option) => {
                const isSelected = (brief.language || 'fr') === option.value
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
                    onClick={() => onChange({ ...brief, language: option.value })}
                  >
                    <div className="p-2.5 flex items-center gap-2 relative">
                      <span className="text-lg">{option.flag}</span>
                      <span className={`text-sm font-medium truncate ${isSelected ? 'text-background' : ''}`}>
                        {option.label}
                      </span>
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-background rounded-full flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-foreground" />
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
            {/* More languages dropdown hint */}
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                {t('language.more')}
              </summary>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {LANGUAGE_OPTIONS.slice(4).map((option) => {
                  const isSelected = brief.language === option.value
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
                      onClick={() => onChange({ ...brief, language: option.value })}
                    >
                      <div className="p-2.5 flex items-center gap-2 relative">
                        <span className="text-lg">{option.flag}</span>
                        <span className={`text-sm font-medium truncate ${isSelected ? 'text-background' : ''}`}>
                          {option.label}
                        </span>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-background rounded-full flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-foreground" />
                          </div>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </details>
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
          {tCommon('back')}
        </Button>
        <Button
          onClick={handleGenerateAndContinue}
          disabled={!canContinue || generatingPlan}
          className="h-11 px-6 rounded-xl font-medium group"
        >
          {generatingPlan ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('plan.loading')}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              {t('plan.submit')}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
