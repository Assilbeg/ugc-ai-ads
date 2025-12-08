'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  X,
  Subtitles,
  Loader2,
  Sparkles,
  Zap,
  Type,
  Film,
  Volume2,
  Scissors,
  Info
} from 'lucide-react'
import type { SubmagicConfig } from '@/types'

const SUBMAGIC_COST = 25 // crédits

interface SubmagicModalProps {
  isOpen: boolean
  onClose: () => void
  campaignId: string
  campaignTitle: string
  onSuccess?: () => void
  currentBalance?: number
}

// Templates par défaut en cas d'échec API
const DEFAULT_TEMPLATES = ['Sara', 'Daniel', 'Hormozi 2', 'Beast', 'Ali']
const DEFAULT_HOOK_TEMPLATES = ['tiktok', 'hormozi', 'ali', 'laura', 'steph']

export function SubmagicModal({
  isOpen,
  onClose,
  campaignId,
  campaignTitle,
  onSuccess,
  currentBalance = 0,
}: SubmagicModalProps) {
  // Templates
  const [templates, setTemplates] = useState<string[]>(DEFAULT_TEMPLATES)
  const [hookTemplates, setHookTemplates] = useState<string[]>(DEFAULT_HOOK_TEMPLATES)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)

  // Config state
  const [config, setConfig] = useState<SubmagicConfig>({
    templateName: 'Sara',
    hookTitle: {
      enabled: false,
      text: '',
      template: 'tiktok',
      top: 50,
      size: 30,
    },
    magicZooms: false,
    magicBrolls: false,
    magicBrollsPercentage: 50,
    removeSilencePace: undefined,
    removeBadTakes: false,
  })

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setIsLoadingTemplates(true)
    try {
      const [templatesRes, hookTemplatesRes] = await Promise.all([
        fetch('/api/submagic/templates'),
        fetch('/api/submagic/hook-templates'),
      ])

      if (templatesRes.ok) {
        const data = await templatesRes.json()
        if (data.templates?.length > 0) {
          setTemplates(data.templates)
        }
      }

      if (hookTemplatesRes.ok) {
        const data = await hookTemplatesRes.json()
        if (data.templates?.length > 0) {
          setHookTemplates(data.templates)
        }
      }
    } catch (err) {
      console.error('Error fetching Submagic templates:', err)
    } finally {
      setIsLoadingTemplates(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchTemplates()
      setError(null)
    }
  }, [isOpen, fetchTemplates])

  // Bloquer le scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Fermer avec Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/submagic/create-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, config }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 402) {
          setError(`Crédits insuffisants. Vous avez ${currentBalance} crédits, il en faut ${SUBMAGIC_COST}.`)
        } else {
          setError(data.error || 'Une erreur est survenue')
        }
        return
      }

      onSuccess?.()
      onClose()
      // Rafraîchir la page pour voir le nouveau statut
      window.location.reload()

    } catch (err) {
      console.error('Error creating Submagic project:', err)
      setError('Erreur de connexion')
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateConfig = <K extends keyof SubmagicConfig>(key: K, value: SubmagicConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  const updateHookTitle = <K extends keyof NonNullable<SubmagicConfig['hookTitle']>>(
    key: K, 
    value: NonNullable<SubmagicConfig['hookTitle']>[K]
  ) => {
    setConfig(prev => ({
      ...prev,
      hookTitle: { ...prev.hookTitle!, [key]: value }
    }))
  }

  if (!isOpen) return null

  const hasEnoughCredits = currentBalance >= SUBMAGIC_COST

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-muted transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Subtitles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Ajouter des sous-titres</h2>
              <p className="text-sm text-muted-foreground truncate max-w-md">
                {campaignTitle}
              </p>
            </div>
          </div>

          {/* Cost info */}
          <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-muted/50">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-sm">Coût : <strong>{SUBMAGIC_COST} crédits</strong></span>
            </div>
            <div className={`text-sm ${hasEnoughCredits ? 'text-muted-foreground' : 'text-destructive'}`}>
              Solde : {currentBalance} crédits
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Template de sous-titres */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Type className="w-4 h-4" />
              Style de sous-titres
            </Label>
            <Select
              value={config.templateName}
              onValueChange={(value) => updateConfig('templateName', value)}
              disabled={isLoadingTemplates}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choisir un style" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template} value={template}>
                    {template}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Détermine l'apparence visuelle des sous-titres (police, couleurs, animations)
            </p>
          </div>

          {/* Hook Title */}
          <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Hook animé
              </Label>
              <button
                type="button"
                onClick={() => updateHookTitle('enabled', !config.hookTitle?.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.hookTitle?.enabled ? 'bg-violet-500' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.hookTitle?.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {config.hookTitle?.enabled && (
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs">Texte du hook</Label>
                  <Input
                    placeholder="Ex: Regarde ça ! 👀"
                    value={config.hookTitle.text || ''}
                    onChange={(e) => updateHookTitle('text', e.target.value.slice(0, 100))}
                    maxLength={100}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {(config.hookTitle.text || '').length}/100 caractères
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Template</Label>
                    <Select
                      value={config.hookTitle.template || 'tiktok'}
                      onValueChange={(value) => updateHookTitle('template', value)}
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {hookTemplates.map((template) => (
                          <SelectItem key={template} value={template}>
                            {template}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Position verticale ({config.hookTitle.top || 50}%)</Label>
                    <Slider
                      value={[config.hookTitle.top || 50]}
                      onValueChange={([value]) => updateHookTitle('top', value)}
                      min={0}
                      max={80}
                      step={5}
                      className="mt-2"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Taille du texte ({config.hookTitle.size || 30})</Label>
                  <Slider
                    value={[config.hookTitle.size || 30]}
                    onValueChange={([value]) => updateHookTitle('size', value)}
                    min={10}
                    max={80}
                    step={5}
                    className="mt-2"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Options avancées */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Film className="w-4 h-4" />
              Options vidéo
            </h3>

            {/* Magic Zooms */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
              <div>
                <p className="text-sm font-medium">Magic Zooms</p>
                <p className="text-xs text-muted-foreground">Zooms automatiques sur les mots importants</p>
              </div>
              <button
                type="button"
                onClick={() => updateConfig('magicZooms', !config.magicZooms)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.magicZooms ? 'bg-violet-500' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.magicZooms ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Magic B-rolls */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Magic B-rolls</p>
                  <p className="text-xs text-muted-foreground">Ajouter des vidéos stock IA</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig('magicBrolls', !config.magicBrolls)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.magicBrolls ? 'bg-violet-500' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.magicBrolls ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {config.magicBrolls && (
                <div>
                  <Label className="text-xs">Pourcentage de couverture ({config.magicBrollsPercentage || 50}%)</Label>
                  <Slider
                    value={[config.magicBrollsPercentage || 50]}
                    onValueChange={([value]) => updateConfig('magicBrollsPercentage', value)}
                    min={0}
                    max={100}
                    step={10}
                    className="mt-2"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Audio options */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Options audio
            </h3>

            {/* Remove Silence */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border">
              <Label className="text-xs mb-2 block">Suppression des silences</Label>
              <Select
                value={config.removeSilencePace || 'none'}
                onValueChange={(value) => updateConfig('removeSilencePace', value === 'none' ? undefined : value as 'natural' | 'fast' | 'extra-fast')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Désactivé" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Désactivé</SelectItem>
                  <SelectItem value="natural">Naturel</SelectItem>
                  <SelectItem value="fast">Rapide</SelectItem>
                  <SelectItem value="extra-fast">Très rapide</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Remove Bad Takes */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
              <div>
                <p className="text-sm font-medium flex items-center gap-1">
                  <Scissors className="w-3 h-3" />
                  Supprimer les mauvaises prises
                </p>
                <p className="text-xs text-muted-foreground">Enlève automatiquement les hésitations</p>
              </div>
              <button
                type="button"
                onClick={() => updateConfig('removeBadTakes', !config.removeBadTakes)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.removeBadTakes ? 'bg-violet-500' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.removeBadTakes ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Info box */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Le traitement prend généralement 1 à 5 minutes. Vous recevrez la vidéo avec sous-titres 
              automatiquement sur cette page.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-border flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl"
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !hasEnoughCredits}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                <Subtitles className="w-4 h-4 mr-2" />
                Lancer ({SUBMAGIC_COST} crédits)
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

