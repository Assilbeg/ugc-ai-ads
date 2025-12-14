'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Globe,
  Save,
  Loader2,
  Check,
  Star,
  DollarSign,
  Euro,
  PoundSterling,
} from 'lucide-react'

interface CurrencyConfig {
  id: string
  language_code: string
  currency_code: string
  currency_symbol: string
  exchange_rate: number
  is_default: boolean
  is_active: boolean
}

interface CurrencyConfigFormProps {
  configs: CurrencyConfig[]
}

const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'Français',
  en: 'Anglais',
  es: 'Espagnol',
  de: 'Allemand',
  it: 'Italien',
  pt: 'Portugais',
  nl: 'Néerlandais',
}

const LANGUAGE_FLAGS: Record<string, string> = {
  fr: '🇫🇷',
  en: '🇺🇸',
  es: '🇪🇸',
  de: '🇩🇪',
  it: '🇮🇹',
  pt: '🇵🇹',
  nl: '🇳🇱',
}

export function CurrencyConfigForm({ configs: initialConfigs }: CurrencyConfigFormProps) {
  const [configs, setConfigs] = useState(initialConfigs)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const getCurrencyIcon = (code: string) => {
    switch (code) {
      case 'EUR': return <Euro className="w-4 h-4 text-blue-500" />
      case 'USD': return <DollarSign className="w-4 h-4 text-green-500" />
      case 'GBP': return <PoundSterling className="w-4 h-4 text-purple-500" />
      default: return <Globe className="w-4 h-4 text-muted-foreground" />
    }
  }

  const formatRate = (rate: number) => {
    return rate.toFixed(4)
  }

  const handleConfigChange = (languageCode: string, field: keyof CurrencyConfig, value: string | number | boolean) => {
    setConfigs(prev => prev.map(config => 
      config.language_code === languageCode ? { ...config, [field]: value } : config
    ))
    setSaveSuccess(false)
  }

  const handleRateChange = (languageCode: string, value: string) => {
    const rate = parseFloat(value) || 1.0
    handleConfigChange(languageCode, 'exchange_rate', rate)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    
    try {
      const response = await fetch('/api/admin/currency-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erreur lors de la sauvegarde')
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Error saving currency configs:', error)
      alert(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }

  // Calculate preview prices (100€ = 10000 cents as example)
  const previewBaseCents = 10000 // 100€

  return (
    <div className="space-y-6">
      {/* Grid of currencies */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {configs.map((config) => (
          <div 
            key={config.language_code}
            className={`relative p-4 rounded-xl border bg-card transition-all ${
              config.is_default ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-border'
            } ${!config.is_active ? 'opacity-50' : ''}`}
          >
            {/* Default badge */}
            {config.is_default && (
              <Badge className="absolute -top-2 -right-2 bg-amber-500">
                <Star className="w-3 h-3 mr-1" />
                Base
              </Badge>
            )}

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{LANGUAGE_FLAGS[config.language_code]}</span>
              <div className="flex-1">
                <p className="font-semibold">{LANGUAGE_NAMES[config.language_code] || config.language_code}</p>
                <p className="text-xs text-muted-foreground">{config.language_code.toUpperCase()}</p>
              </div>
              {getCurrencyIcon(config.currency_code)}
            </div>

            {/* Currency inputs */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <Label className="text-xs text-muted-foreground">Code devise</Label>
                <Input
                  value={config.currency_code}
                  onChange={(e) => handleConfigChange(config.language_code, 'currency_code', e.target.value.toUpperCase())}
                  className="mt-1 h-9 font-mono"
                  maxLength={3}
                  disabled={config.is_default}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Symbole</Label>
                <Input
                  value={config.currency_symbol}
                  onChange={(e) => handleConfigChange(config.language_code, 'currency_symbol', e.target.value)}
                  className="mt-1 h-9 text-center font-bold"
                  maxLength={5}
                />
              </div>
            </div>

            {/* Exchange rate */}
            <div className="mb-4">
              <Label className="text-xs text-muted-foreground">
                Taux de change (1€ = X{config.currency_symbol})
              </Label>
              <Input
                type="number"
                step="0.0001"
                min="0.0001"
                value={formatRate(config.exchange_rate)}
                onChange={(e) => handleRateChange(config.language_code, e.target.value)}
                className="mt-1 h-9 font-mono"
                disabled={config.is_default}
              />
            </div>

            {/* Preview */}
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Aperçu: 100€ =</p>
              <p className="text-lg font-bold">
                {new Intl.NumberFormat(
                  config.language_code === 'en' ? 'en-US' : `${config.language_code}-${config.language_code.toUpperCase()}`,
                  { style: 'currency', currency: config.currency_code }
                ).format((previewBaseCents * config.exchange_rate) / 100)}
              </p>
            </div>

            {/* Active toggle */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active</span>
              <button
                onClick={() => handleConfigChange(config.language_code, 'is_active', !config.is_active)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  config.is_active ? 'bg-green-500' : 'bg-muted'
                }`}
                disabled={config.is_default}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  config.is_active ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Info box */}
      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <h4 className="font-semibold text-blue-500 mb-2">💡 Comment ça fonctionne</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• <strong>EUR est la devise de base</strong> (taux = 1.0)</li>
          <li>• Les prix sont stockés en centimes EUR dans la base de données</li>
          <li>• La conversion est faite automatiquement à l'affichage selon la langue du navigateur</li>
          <li>• <strong>Pour USD</strong>: un taux de 1.10 signifie que 1€ = $1.10</li>
          <li>• Les paiements Stripe restent en EUR (la devise affichée est informative)</li>
        </ul>
      </div>

      {/* Save button */}
      <div className="flex justify-end gap-3">
        {saveSuccess && (
          <div className="flex items-center gap-2 text-green-500">
            <Check className="w-4 h-4" />
            <span className="text-sm">Sauvegardé !</span>
          </div>
        )}
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Sauvegarder les devises
        </Button>
      </div>
    </div>
  )
}
