'use client'

import { CampaignBrief } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Sparkles, Check, Clock, Target, Gift, ShoppingBag } from 'lucide-react'

interface Step4BriefProps {
  brief: Partial<CampaignBrief>
  onChange: (brief: Partial<CampaignBrief>) => void
  onNext: () => void
  onBack: () => void
}

const DURATION_OPTIONS = [
  { value: 15, label: '15s', clips: '2-3 clips' },
  { value: 30, label: '30s', clips: '4-5 clips' },
  { value: 45, label: '45s', clips: '5-6 clips' },
  { value: 60, label: '60s', clips: '6-8 clips' },
]

export function Step4Brief({ brief, onChange, onNext, onBack }: Step4BriefProps) {
  const handleWhatSellingChange = (value: string) => {
    onChange({ ...brief, what_selling: value })
  }

  const handleTargetAudienceChange = (value: string) => {
    onChange({ ...brief, target_audience: value })
  }

  const handleBenefitsChange = (value: string) => {
    onChange({ ...brief, key_benefits: value ? [value] : [] })
  }

  const handleDurationChange = (duration: 15 | 30 | 45 | 60) => {
    onChange({ ...brief, target_duration: duration })
  }

  const canContinue = brief.what_selling && brief.what_selling.length > 10 && brief.target_duration

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-2xl font-semibold tracking-tight">Brief rapide</h2>
        <p className="text-muted-foreground mt-2">
          Décris ton offre pour que l'IA génère le meilleur script
        </p>
      </div>

      {/* Brief form */}
      <div className="max-w-2xl mx-auto space-y-6">
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
            onChange={(e) => handleWhatSellingChange(e.target.value)}
            className="min-h-[140px] rounded-xl border-border bg-background focus:border-foreground focus:ring-1 focus:ring-foreground/20 resize-none text-base"
          />
          <p className="text-xs text-muted-foreground">
            Plus tu es précis, meilleur sera le script généré
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
              onChange={(e) => handleTargetAudienceChange(e.target.value)}
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
              onChange={(e) => handleBenefitsChange(e.target.value)}
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
                  onClick={() => handleDurationChange(option.value as 15 | 30 | 45 | 60)}
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

      {/* Navigation buttons */}
      <div className="flex justify-between max-w-2xl mx-auto pt-4">
        <Button variant="ghost" onClick={onBack} className="h-11 px-5 rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button
          onClick={onNext}
          disabled={!canContinue}
          className="h-11 px-6 rounded-xl font-medium group"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Générer le plan
        </Button>
      </div>
    </div>
  )
}
