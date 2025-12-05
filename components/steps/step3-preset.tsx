'use client'

import { INTENTION_PRESETS } from '@/lib/presets'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Actor } from '@/types'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

interface Step3PresetProps {
  selectedPresetId?: string
  selectedActor?: Actor
  onSelect: (presetId: string) => void
  onNext: () => void
  onBack: () => void
}

const PRESET_EMOJIS: Record<string, string> = {
  'confession-intime': '🛏️',
  'morning-discovery': '☀️',
  'street-hype': '🚶',
  'chill-testimonial': '🛋️',
  'car-confession': '🚗',
  'unboxing-product': '📦',
  'story-journey': '📖',
}

const TONE_LABELS: Record<string, string> = {
  vulnerable: 'Vulnérable',
  energetic: 'Énergique',
  urgent: 'Urgent',
  conversational: 'Conversationnel',
  reflective: 'Réflexif',
}

const FILMING_LABELS: Record<string, string> = {
  handheld: 'Selfie',
  filmed_by_other: 'Filmé',
  setup_phone: 'Téléphone posé',
}

export function Step3Preset({ selectedPresetId, selectedActor, onSelect, onNext, onBack }: Step3PresetProps) {
  const handleContinue = () => {
    if (selectedPresetId) {
      onNext()
    }
  }

  const getActorIntentionImage = (presetId: string): string | undefined => {
    return selectedActor?.intention_media?.[presetId]?.image_url
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-2xl font-semibold tracking-tight">Choisis ton intention</h2>
        <p className="text-muted-foreground mt-2">
          Le style et le contexte de ta vidéo UGC
          {selectedActor && (
            <span className="text-foreground font-medium"> • avec {selectedActor.name}</span>
          )}
        </p>
      </div>

      {/* Presets grid - cards with proper 9:16 image ratio */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
        {INTENTION_PRESETS.map((preset) => {
          const actorImage = getActorIntentionImage(preset.id)
          const isSelected = selectedPresetId === preset.id
          
          return (
            <Card
              key={preset.id}
              className={`
                cursor-pointer transition-all duration-200 overflow-hidden rounded-2xl
                p-0 gap-0 border-0 aspect-[9/16]
                ${isSelected
                  ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background shadow-lg'
                  : 'hover:shadow-md'
                }
              `}
              onClick={() => onSelect(preset.id)}
            >
              {/* Image - 9:16 portrait format */}
              <div className="relative w-full h-full bg-muted">
                {actorImage ? (
                  <img 
                    src={actorImage} 
                    alt={`${selectedActor?.name} - ${preset.name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                    <span className="text-5xl">{PRESET_EMOJIS[preset.id] || '🎬'}</span>
                  </div>
                )}
                
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3 w-7 h-7 bg-foreground rounded-full flex items-center justify-center shadow-lg">
                    <Check className="w-4 h-4 text-background" />
                  </div>
                )}

                {/* Info overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-16">
                  <h3 className="font-semibold text-white text-sm">{preset.name}</h3>
                  <p className="text-xs text-white/70 mt-1 line-clamp-2">
                    {preset.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-[10px] rounded-full px-2 py-0 bg-white/20 text-white border-0">
                      {TONE_LABELS[preset.script.tone] || preset.script.tone}
                    </Badge>
                    {preset.filming_type && (
                      <Badge variant="secondary" className="text-[10px] rounded-full px-2 py-0 bg-white/10 text-white border-0">
                        {FILMING_LABELS[preset.filming_type] || preset.filming_type}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4 max-w-5xl mx-auto">
        <Button variant="ghost" onClick={onBack} className="h-11 px-5 rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!selectedPresetId}
          className="h-11 px-6 rounded-xl font-medium group"
        >
          Continuer
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  )
}
