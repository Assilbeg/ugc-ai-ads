'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Image, Video, Mic, Music, DollarSign, Calculator, Clapperboard } from 'lucide-react'

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
  
  // Simulateur de campagne
  const [clipCount, setClipCount] = useState(4)
  const [videoDuration, setVideoDuration] = useState(6)
  const [videoMode, setVideoMode] = useState<'standard' | 'fast'>('fast')

  const getCostIcon = (id: string) => {
    if (id === 'first_frame') return <Image className="w-5 h-5 text-blue-500" />
    if (id.startsWith('video_')) return <Video className="w-5 h-5 text-purple-500" />
    if (id === 'voice_chatterbox') return <Mic className="w-5 h-5 text-green-500" />
    if (id === 'ambient_elevenlabs') return <Music className="w-5 h-5 text-amber-500" />
    return <DollarSign className="w-5 h-5" />
  }

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2)
  }

  const formatEuro = (cents: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100)
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

  // Get cost by id
  const getCost = (id: string) => costs.find(c => c.id === id)

  // Calculer le coût d'une campagne
  const campaignCost = useMemo(() => {
    const firstFrame = getCost('first_frame')
    const videoStandard = getCost('video_veo31_standard')
    const videoFast = getCost('video_veo31_fast')
    const voice = getCost('voice_chatterbox')
    const ambient = getCost('ambient_elevenlabs')

    const videoCost = videoMode === 'fast' ? videoFast : videoStandard
    
    if (!firstFrame || !videoCost || !voice || !ambient) {
      return { client: 0, real: 0, margin: 0, perClip: { client: 0, real: 0 } }
    }

    // Par clip
    const perClipClient = 
      firstFrame.cost_cents + 
      (videoCost.cost_cents * videoDuration) + 
      voice.cost_cents + 
      ambient.cost_cents

    const perClipReal = 
      (firstFrame.real_cost_cents || 0) + 
      ((videoCost.real_cost_cents || 0) * videoDuration) + 
      (voice.real_cost_cents || 0) + 
      (ambient.real_cost_cents || 0)

    // Total campagne
    const totalClient = perClipClient * clipCount
    const totalReal = perClipReal * clipCount
    const margin = totalReal > 0 ? ((totalClient - totalReal) / totalReal) * 100 : 0

    return {
      client: totalClient,
      real: totalReal,
      margin,
      perClip: { client: perClipClient, real: perClipReal }
    }
  }, [costs, clipCount, videoDuration, videoMode])

  // Séparer les coûts par catégorie
  const videoCosts = costs.filter(c => c.id.startsWith('video_'))
  const otherCosts = costs.filter(c => !c.id.startsWith('video_'))

  return (
    <div className="space-y-8">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SIMULATEUR DE CAMPAGNE */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h3 className="font-semibold">Simulateur de campagne</h3>
            <p className="text-sm text-muted-foreground">Estimer le coût et la marge d'une campagne type</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <Label className="text-xs text-muted-foreground">Nombre de clips</Label>
            <Input
              type="number"
              min="1"
              max="20"
              value={clipCount}
              onChange={(e) => setClipCount(parseInt(e.target.value) || 1)}
              className="h-10"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Durée vidéo (sec)</Label>
            <Input
              type="number"
              min="4"
              max="10"
              value={videoDuration}
              onChange={(e) => setVideoDuration(parseInt(e.target.value) || 6)}
              className="h-10"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Mode vidéo</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                size="sm"
                variant={videoMode === 'fast' ? 'default' : 'outline'}
                onClick={() => setVideoMode('fast')}
                className="flex-1"
              >
                Fast
              </Button>
              <Button
                type="button"
                size="sm"
                variant={videoMode === 'standard' ? 'default' : 'outline'}
                onClick={() => setVideoMode('standard')}
                className="flex-1"
              >
                Standard
              </Button>
            </div>
          </div>
        </div>

        {/* Résultats */}
        <div className="grid grid-cols-2 gap-4">
          {/* Par clip */}
          <div className="p-4 rounded-xl bg-background/50 border">
            <div className="flex items-center gap-2 mb-3">
              <Clapperboard className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Par clip</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Coût réel</span>
                <span>{formatEuro(campaignCost.perClip.real)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Prix client</span>
                <span className="font-medium">{formatEuro(campaignCost.perClip.client)}</span>
              </div>
            </div>
          </div>

          {/* Total campagne */}
          <div className="p-4 rounded-xl bg-background/50 border">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Campagne ({clipCount} clips)</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Coût réel</span>
                <span>{formatEuro(campaignCost.real)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Prix client</span>
                <span className="font-semibold text-lg">{formatEuro(campaignCost.client)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t mt-2">
                <span className="text-muted-foreground">Marge</span>
                <span className={`font-bold ${campaignCost.margin > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  +{campaignCost.margin.toFixed(0)}% ({formatEuro(campaignCost.client - campaignCost.real)})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Détail par élément */}
        <div className="mt-4 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
          <strong>Détail par clip :</strong> 1× First Frame + {videoDuration}s × Vidéo {videoMode} + 1× Voice + 1× Ambient
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* VIDÉOS (prix par seconde) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Video className="w-4 h-4" />
          Vidéos Veo 3.1 (prix PAR SECONDE)
        </h4>
        <div className="grid gap-3">
          {videoCosts.map((cost) => (
            <div
              key={cost.id}
              className="flex items-center gap-4 p-4 rounded-xl border bg-card"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                {getCostIcon(cost.id)}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium">{cost.name}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {cost.description}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-28">
                  <Label className="text-xs text-muted-foreground">Coût réel/s</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formatPrice(cost.real_cost_cents || 0)}
                    onChange={(e) => handleCostChange(cost.id, 'real_cost_cents', e.target.value)}
                    className="h-9"
                  />
                </div>

                <div className="w-28">
                  <Label className="text-xs text-muted-foreground">Prix client/s</Label>
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
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* AUTRES (prix par unité) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Autres générations (prix PAR UNITÉ)
        </h4>
        <div className="grid gap-3">
          {otherCosts.map((cost) => (
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
                <div className="w-28">
                  <Label className="text-xs text-muted-foreground">Coût réel</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formatPrice(cost.real_cost_cents || 0)}
                    onChange={(e) => handleCostChange(cost.id, 'real_cost_cents', e.target.value)}
                    className="h-9"
                  />
                </div>

                <div className="w-28">
                  <Label className="text-xs text-muted-foreground">Prix client</Label>
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

