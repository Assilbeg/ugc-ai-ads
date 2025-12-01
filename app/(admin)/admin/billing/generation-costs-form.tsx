'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Image, Video, Mic, Music, DollarSign } from 'lucide-react'

interface GenerationCost {
  id: string
  name: string
  description: string | null
  cost_cents: number
  real_cost_cents: number | null
  is_active: boolean
}

interface GenerationCostsFormProps {
  costs: GenerationCost[]
}

export function GenerationCostsForm({ costs: initialCosts }: GenerationCostsFormProps) {
  const [costs, setCosts] = useState(initialCosts)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const getCostIcon = (id: string) => {
    switch (id) {
      case 'first_frame': return <Image className="w-5 h-5 text-blue-500" />
      case 'video_veo31': return <Video className="w-5 h-5 text-purple-500" />
      case 'voice_chatterbox': return <Mic className="w-5 h-5 text-green-500" />
      case 'ambient_elevenlabs': return <Music className="w-5 h-5 text-amber-500" />
      default: return <DollarSign className="w-5 h-5" />
    }
  }

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2)
  }

  const handleCostChange = (id: string, field: 'cost_cents' | 'real_cost_cents', value: string) => {
    const cents = Math.round(parseFloat(value || '0') * 100)
    setCosts(prev => prev.map(cost => 
      cost.id === id ? { ...cost, [field]: cents } : cost
    ))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/generation-costs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ costs }),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde')
      }

      setMessage({ type: 'success', text: 'Coûts mis à jour avec succès' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' })
    } finally {
      setIsSaving(false)
    }
  }

  // Calculate margin for each cost
  const getMargin = (cost: GenerationCost) => {
    if (!cost.real_cost_cents || cost.real_cost_cents === 0) return null
    const margin = ((cost.cost_cents - cost.real_cost_cents) / cost.real_cost_cents) * 100
    return margin.toFixed(0)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {costs.map((cost) => (
          <div
            key={cost.id}
            className="flex items-center gap-4 p-4 rounded-xl border bg-card"
          >
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {getCostIcon(cost.id)}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-medium">{cost.name}</p>
              <p className="text-sm text-muted-foreground truncate">
                {cost.description}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-32">
                <Label className="text-xs text-muted-foreground">Coût réel (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formatPrice(cost.real_cost_cents || 0)}
                  onChange={(e) => handleCostChange(cost.id, 'real_cost_cents', e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="w-32">
                <Label className="text-xs text-muted-foreground">Prix facturé (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formatPrice(cost.cost_cents)}
                  onChange={(e) => handleCostChange(cost.id, 'cost_cents', e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="w-20 text-right">
                {getMargin(cost) !== null && (
                  <span className={`text-sm font-medium ${
                    parseInt(getMargin(cost)!) > 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    +{getMargin(cost)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
          {message.text}
        </p>
      )}

      <Button onClick={handleSave} disabled={isSaving} className="h-11 rounded-xl">
        {isSaving ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        Sauvegarder les coûts
      </Button>
    </div>
  )
}

