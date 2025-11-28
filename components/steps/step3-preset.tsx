'use client'

import { INTENTION_PRESETS } from '@/lib/presets'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Step3PresetProps {
  selectedPresetId?: string
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
}

const TONE_LABELS: Record<string, string> = {
  vulnerable: 'Vulnérable',
  energetic: 'Énergique',
  urgent: 'Urgent',
  conversational: 'Conversationnel',
}

export function Step3Preset({ selectedPresetId, onSelect, onNext, onBack }: Step3PresetProps) {
  const handleContinue = () => {
    if (selectedPresetId) {
      onNext()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Choisis ton intention</h2>
        <p className="text-zinc-400 mt-2">
          Le style et le contexte de ta vidéo UGC
        </p>
      </div>

      {/* Presets grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INTENTION_PRESETS.map((preset) => (
          <Card
            key={preset.id}
            className={`
              cursor-pointer transition-all duration-200 overflow-hidden
              ${selectedPresetId === preset.id
                ? 'ring-2 ring-violet-500 bg-violet-500/10 border-violet-500'
                : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
              }
            `}
            onClick={() => onSelect(preset.id)}
          >
            <CardContent className="p-0">
              {/* Thumbnail placeholder */}
              <div className="aspect-video bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                <span className="text-5xl">{PRESET_EMOJIS[preset.id] || '🎬'}</span>
              </div>

              {/* Info */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-white">{preset.name}</h3>
                  {selectedPresetId === preset.id && (
                    <div className="w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-sm text-zinc-400 line-clamp-2">{preset.description}</p>
                
                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 text-xs">
                    {TONE_LABELS[preset.script.tone] || preset.script.tone}
                  </Badge>
                  <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 text-xs">
                    {preset.suggested_total_duration}s
                  </Badge>
                  <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 text-xs">
                    {preset.suggested_clip_count} clips
                  </Badge>
                </div>

                {/* Example hook */}
                <div className="pt-2 border-t border-zinc-800">
                  <p className="text-xs text-zinc-500 italic">
                    "{preset.script.hook_templates[0]}"
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="text-zinc-400 hover:text-white">
          ← Retour
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!selectedPresetId}
          className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50"
        >
          Continuer
        </Button>
      </div>
    </div>
  )
}

