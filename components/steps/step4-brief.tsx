'use client'

import { CampaignBrief } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent } from '@/components/ui/card'

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
    // Stocke comme array avec un seul élément pour garder le texte brut
    // Le split par virgule sera fait côté API si besoin
    onChange({ ...brief, key_benefits: value ? [value] : [] })
  }

  const handleDurationChange = (duration: 15 | 30 | 45 | 60) => {
    onChange({ ...brief, target_duration: duration })
  }

  const canContinue = brief.what_selling && brief.what_selling.length > 10 && brief.target_duration

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Brief rapide</h2>
        <p className="text-zinc-400 mt-2">
          Décris ton offre pour que l'IA génère le meilleur script
        </p>
      </div>

      {/* Brief form */}
      <div className="max-w-xl mx-auto space-y-6">
        {/* What are you selling */}
        <div className="space-y-2">
          <Label className="text-zinc-300 text-base">
            Qu'est-ce que tu vends ? <span className="text-red-400">*</span>
          </Label>
          <Textarea
            placeholder="Ex: Une formation en ligne pour apprendre à coder en Python en 30 jours, idéale pour les débutants qui veulent se reconvertir dans la tech..."
            value={brief.what_selling || ''}
            onChange={(e) => handleWhatSellingChange(e.target.value)}
            className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 min-h-[100px]"
          />
          <p className="text-xs text-zinc-500">
            Plus tu es précis, meilleur sera le script généré
          </p>
        </div>

        {/* Target audience (optional) */}
        <div className="space-y-2">
          <Label className="text-zinc-300">Audience cible (optionnel)</Label>
          <Input
            placeholder="Ex: Freelances, entrepreneurs, étudiants en reconversion..."
            value={brief.target_audience || ''}
            onChange={(e) => handleTargetAudienceChange(e.target.value)}
            className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>

        {/* Key benefits (optional) */}
        <div className="space-y-2">
          <Label className="text-zinc-300">Bénéfices clés (optionnel)</Label>
          <Input
            placeholder="Ex: Gain de temps, plus de clients, simplicité d'utilisation..."
            value={brief.key_benefits?.[0] || ''}
            onChange={(e) => handleBenefitsChange(e.target.value)}
            className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>

        {/* Duration selection */}
        <div className="space-y-4">
          <Label className="text-zinc-300 text-base">
            Durée finale souhaitée <span className="text-red-400">*</span>
          </Label>
          <div className="grid grid-cols-4 gap-3">
            {DURATION_OPTIONS.map((option) => (
              <Card
                key={option.value}
                className={`
                  cursor-pointer transition-all duration-200
                  ${brief.target_duration === option.value
                    ? 'ring-2 ring-violet-500 bg-violet-500/10 border-violet-500'
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                  }
                `}
                onClick={() => handleDurationChange(option.value as 15 | 30 | 45 | 60)}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-xl font-bold text-white">{option.label}</div>
                  <div className="text-xs text-zinc-500 mt-1">{option.clips}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between max-w-xl mx-auto">
        <Button variant="ghost" onClick={onBack} className="text-zinc-400 hover:text-white">
          ← Retour
        </Button>
        <Button
          onClick={onNext}
          disabled={!canContinue}
          className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50"
        >
          Générer le plan
        </Button>
      </div>
    </div>
  )
}

