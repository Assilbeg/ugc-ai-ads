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
  Info,
  Trash2,
  Check
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

// ═══════════════════════════════════════════════════════════════
// METADATA DES TEMPLATES DE SOUS-TITRES
// ═══════════════════════════════════════════════════════════════
interface TemplateMetadata {
  category: string[]
  isNew?: boolean
  bgColor: string
  textColor: string
  fontWeight?: string
  textTransform?: 'uppercase' | 'capitalize' | 'none'
}

const TEMPLATE_METADATA: Record<string, TemplateMetadata> = {
  'Laura': { category: ['trend', 'new'], isNew: true, bgColor: '#374151', textColor: '#84cc16', fontWeight: '600' },
  'Kelly 2': { category: ['trend', 'new'], isNew: true, bgColor: '#374151', textColor: '#fff', fontWeight: '500' },
  'Caleb': { category: ['new'], isNew: true, bgColor: '#374151', textColor: '#fff', fontWeight: '400' },
  'Kendrick': { category: ['new'], isNew: true, bgColor: '#374151', textColor: '#84cc16', fontWeight: '700' },
  'Lewis': { category: ['trend'], bgColor: '#374151', textColor: '#fff', fontWeight: '500' },
  'Doug': { category: ['trend'], bgColor: '#374151', textColor: '#fff', textTransform: 'uppercase', fontWeight: '900' },
  'Carlos': { category: ['all'], bgColor: '#374151', textColor: '#fff', textTransform: 'uppercase', fontWeight: '600' },
  'Luke': { category: ['all'], bgColor: '#374151', textColor: '#fff', textTransform: 'uppercase', fontWeight: '500' },
  'Mark': { category: ['trend'], bgColor: '#374151', textColor: '#fff', textTransform: 'uppercase', fontWeight: '700' },
  'Sara': { category: ['emoji', 'trend'], bgColor: '#6b7280', textColor: '#fff', fontWeight: '500' },
  'Daniel': { category: ['trend'], bgColor: '#6b7280', textColor: '#fff', fontWeight: '500' },
  'Dan 2': { category: ['all'], bgColor: '#374151', textColor: '#facc15', textTransform: 'uppercase', fontWeight: '800' },
  'Hormozi 1': { category: ['premium', 'trend'], bgColor: '#374151', textColor: '#fff', textTransform: 'uppercase', fontWeight: '800' },
  'Hormozi 2': { category: ['premium', 'trend'], bgColor: '#1f2937', textColor: '#fff', textTransform: 'uppercase', fontWeight: '700' },
  'Hormozi 3': { category: ['premium'], bgColor: '#374151', textColor: '#fff', textTransform: 'uppercase', fontWeight: '700' },
  'Hormozi 4': { category: ['premium', 'new'], isNew: true, bgColor: '#374151', textColor: '#f97316', textTransform: 'uppercase', fontWeight: '800' },
  'Hormozi 5': { category: ['premium'], bgColor: '#374151', textColor: '#fff', fontWeight: '600' },
  'Dan': { category: ['all'], bgColor: '#374151', textColor: '#fff', textTransform: 'uppercase', fontWeight: '600' },
  'Devin': { category: ['all'], bgColor: '#374151', textColor: '#fff', textTransform: 'uppercase', fontWeight: '600' },
  'Tayo': { category: ['all'], bgColor: '#374151', textColor: '#fff', fontWeight: '500' },
  'Ella': { category: ['all'], bgColor: '#374151', textColor: '#fff', textTransform: 'uppercase', fontWeight: '500' },
  'Tracy': { category: ['all'], bgColor: '#374151', textColor: '#fff', textTransform: 'uppercase', fontWeight: '600' },
  'William': { category: ['all'], bgColor: '#3b82f6', textColor: '#fff', textTransform: 'uppercase', fontWeight: '700' },
  'Leon': { category: ['all'], bgColor: '#ef4444', textColor: '#fff', textTransform: 'uppercase', fontWeight: '700' },
  'Ali': { category: ['emoji'], bgColor: '#e5e7eb', textColor: '#1f2937', fontWeight: '500' },
  'Beast': { category: ['premium', 'emoji'], bgColor: '#374151', textColor: '#fff', textTransform: 'uppercase', fontWeight: '900' },
  'Maya': { category: ['emoji'], bgColor: '#ec4899', textColor: '#fff', fontWeight: '600' },
  'Karl': { category: ['all'], bgColor: '#374151', textColor: '#fff', fontWeight: '500' },
  'Iman': { category: ['all'], bgColor: '#374151', textColor: '#fff', fontWeight: '500' },
  'David': { category: ['all'], bgColor: '#374151', textColor: '#fff', fontWeight: '500' },
  'Noah': { category: ['all'], bgColor: '#374151', textColor: '#fff', fontWeight: '500' },
  'Gstaad': { category: ['premium'], bgColor: '#374151', textColor: '#fff', fontWeight: '500' },
  'Nema': { category: ['premium'], bgColor: '#374151', textColor: '#fff', fontWeight: '500' },
}

// ═══════════════════════════════════════════════════════════════
// METADATA DES THEMES DE HOOK
// ═══════════════════════════════════════════════════════════════
interface HookThemeMetadata {
  bgColor: string
  textColor: string
  isNew?: boolean
}

const HOOK_THEME_METADATA: Record<string, HookThemeMetadata> = {
  'tiktok': { bgColor: '#1f2937', textColor: '#fff' },
  'laura': { bgColor: '#374151', textColor: '#fff' },
  'steph': { bgColor: '#16a34a', textColor: '#fff', isNew: true },
  'kevin': { bgColor: '#22c55e', textColor: '#1f2937', isNew: true },
  'kelly': { bgColor: '#6b7280', textColor: '#fff', isNew: true },
  'mark': { bgColor: '#6b7280', textColor: '#fff', isNew: true },
  'logan': { bgColor: '#374151', textColor: '#fff' },
  'enrico': { bgColor: '#374151', textColor: '#fff' },
  'mike': { bgColor: '#374151', textColor: '#fff' },
  'devin': { bgColor: '#374151', textColor: '#fff' },
  'hormozi': { bgColor: '#374151', textColor: '#fff' },
  'masi': { bgColor: '#84cc16', textColor: '#1f2937' },
  'ali': { bgColor: '#e5e7eb', textColor: '#1f2937' },
}

// Filtres disponibles
const TEMPLATE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'trend', label: 'Trend' },
  { id: 'new', label: 'New' },
  { id: 'premium', label: 'Premium' },
  { id: 'emoji', label: 'Emoji' },
]

export function SubmagicModal({
  isOpen,
  onClose,
  campaignId,
  campaignTitle,
  onSuccess,
  currentBalance = 0,
}: SubmagicModalProps) {
  // Templates depuis l'API
  const [templates, setTemplates] = useState<string[]>(Object.keys(TEMPLATE_METADATA))
  const [hookTemplates, setHookTemplates] = useState<string[]>(Object.keys(HOOK_THEME_METADATA))
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  
  // Filtre des templates
  const [templateFilter, setTemplateFilter] = useState('all')

  // Config state
  const [config, setConfig] = useState<SubmagicConfig>({
    templateName: 'Hormozi 2',
    hookTitle: {
      enabled: true,
      text: '',
      template: 'tiktok',
      top: 50,
      size: 30,
      isAutoGenerated: false,
    },
    magicZooms: false,
    magicBrolls: false,
    magicBrollsPercentage: 50,
    removeSilencePace: undefined,
    removeBadTakes: false,
  })

  // Hook generation state
  const [isGeneratingHook, setIsGeneratingHook] = useState(false)

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch templates from API
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

  // Generate hook via Claude
  const generateHook = useCallback(async () => {
    setIsGeneratingHook(true)
    setError(null)
    
    try {
      const response = await fetch('/api/submagic/generate-hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la génération')
      }

      if (data.hook) {
        setConfig(prev => ({
          ...prev,
          hookTitle: {
            ...prev.hookTitle!,
            enabled: true,
            text: data.hook,
            isAutoGenerated: true,
          }
        }))
      }
    } catch (err) {
      console.error('Error generating hook:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération du hook')
    } finally {
      setIsGeneratingHook(false)
    }
  }, [campaignId])

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
      hookTitle: { ...prev.hookTitle!, [key]: value, isAutoGenerated: false }
    }))
  }

  const clearHookText = () => {
    setConfig(prev => ({
      ...prev,
      hookTitle: { ...prev.hookTitle!, text: '', isAutoGenerated: false }
    }))
  }

  // Filtrer les templates selon le filtre sélectionné
  const filteredTemplates = templates.filter(template => {
    if (templateFilter === 'all') return true
    const meta = TEMPLATE_METADATA[template]
    if (!meta) return templateFilter === 'all'
    return meta.category.includes(templateFilter)
  })

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
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 fade-in duration-200">
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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Subtitles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Sous-titres & Hook</h2>
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

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-220px)]">
        <div className="p-6 space-y-6">
            
            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECTION HOOK TITLE */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="space-y-4 p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200 dark:border-orange-900">
            <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <Sparkles className="w-5 h-5 text-orange-500" />
                  Hook Title
              </Label>
              <button
                type="button"
                onClick={() => updateHookTitle('enabled', !config.hookTitle?.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.hookTitle?.enabled ? 'bg-orange-500' : 'bg-muted'
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
                <div className="space-y-4">
                  {/* Input + Actions */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                  <Input
                          placeholder="Ex: la stratégie secrète pour tripler vos ventes 🚀"
                    value={config.hookTitle.text || ''}
                          onChange={(e) => {
                            setConfig(prev => ({
                              ...prev,
                              hookTitle: { ...prev.hookTitle!, text: e.target.value.slice(0, 100), isAutoGenerated: false }
                            }))
                          }}
                    maxLength={100}
                          className="pr-10 h-11 text-base"
                        />
                        {config.hookTitle.text && (
                          <button
                            type="button"
                            onClick={clearHookText}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={generateHook}
                        disabled={isGeneratingHook}
                        className="h-11 px-4 gap-2 border-orange-300 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-950"
                      >
                        {isGeneratingHook ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        Générer
                      </Button>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {config.hookTitle.isAutoGenerated && config.hookTitle.text && (
                          <span className="text-orange-600 dark:text-orange-400">✨ Généré par IA</span>
                        )}
                      </span>
                      <span>{(config.hookTitle.text || '').length}/100</span>
                    </div>
                </div>

                  {/* Theme Selection - Visual Buttons */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Theme</Label>
                    <div className="flex flex-wrap gap-2">
                      {hookTemplates.map((theme) => {
                        const meta = HOOK_THEME_METADATA[theme] || { bgColor: '#374151', textColor: '#fff' }
                        const isSelected = config.hookTitle?.template === theme
                        return (
                          <button
                            key={theme}
                            type="button"
                            onClick={() => updateHookTitle('template', theme)}
                            className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              isSelected 
                                ? 'ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-gray-900' 
                                : 'hover:opacity-80'
                            }`}
                            style={{ 
                              backgroundColor: meta.bgColor, 
                              color: meta.textColor,
                            }}
                          >
                            {theme}
                            {meta.isNew && (
                              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold bg-green-500 text-white rounded">
                                New
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Position & Size Sliders */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-xs text-muted-foreground">Position</Label>
                        <span className="text-xs font-mono">{config.hookTitle.top || 50}%</span>
                      </div>
                    <Slider
                      value={[config.hookTitle.top || 50]}
                      onValueChange={([value]) => updateHookTitle('top', value)}
                      min={0}
                      max={80}
                      step={5}
                        className="[&_[role=slider]]:bg-orange-500"
                    />
                  </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-xs text-muted-foreground">Taille</Label>
                        <span className="text-xs font-mono">{config.hookTitle.size || 30}px</span>
                </div>
                  <Slider
                    value={[config.hookTitle.size || 30]}
                    onValueChange={([value]) => updateHookTitle('size', value)}
                    min={10}
                    max={80}
                    step={5}
                        className="[&_[role=slider]]:bg-orange-500"
                  />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECTION TEMPLATES DE SOUS-TITRES */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="space-y-4">
              <Label className="flex items-center gap-2 text-base font-semibold">
                <Type className="w-5 h-5" />
                Style de sous-titres
              </Label>

              {/* Filtres */}
              <div className="flex gap-2">
                {TEMPLATE_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setTemplateFilter(filter.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      templateFilter === filter.id
                        ? 'bg-foreground text-background'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Grille de templates */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[240px] overflow-y-auto p-1">
                {isLoadingTemplates ? (
                  <div className="col-span-full flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  filteredTemplates.map((template) => {
                    const meta = TEMPLATE_METADATA[template] || { 
                      category: ['all'], 
                      bgColor: '#374151', 
                      textColor: '#fff',
                      fontWeight: '500'
                    }
                    const isSelected = config.templateName === template
                    // Nom du fichier image (slugify)
                    const imageFileName = template.toLowerCase().replace(/\s+/g, '-') + '.png'
                    const imagePath = `/submagic-templates/${imageFileName}`
                    
                    return (
                      <button
                        key={template}
                        type="button"
                        onClick={() => updateConfig('templateName', template)}
                        className={`relative rounded-lg overflow-hidden transition-all ${
                          isSelected 
                            ? 'ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-gray-900 scale-105' 
                            : 'hover:scale-102 hover:opacity-90'
                        }`}
                      >
                        {/* Image du template */}
                        <img 
                          src={imagePath} 
                          alt={template}
                          className="w-full h-auto block"
                          onError={(e) => {
                            // Fallback si l'image n'existe pas
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            target.parentElement!.innerHTML = `<div class="p-3 text-sm font-medium text-white" style="background-color: ${meta.bgColor}">${template}</div>`
                          }}
                        />
                        {isSelected && (
                          <span className="absolute top-1 right-1 bg-orange-500 rounded-full p-0.5">
                            <Check className="w-3 h-3 text-white" />
                          </span>
                        )}
                        {meta.isNew && (
                          <span className="absolute -top-1 -left-1 px-1.5 py-0.5 text-[10px] font-bold bg-green-500 text-white rounded">
                            New
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>

              {filteredTemplates.length === 0 && !isLoadingTemplates && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Aucun template dans cette catégorie
                </p>
            )}
          </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* OPTIONS VIDÉO */}
            {/* ═══════════════════════════════════════════════════════════════ */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Film className="w-4 h-4" />
              Options vidéo
            </h3>

              <div className="grid grid-cols-2 gap-3">
            {/* Magic Zooms */}
              <button
                type="button"
                onClick={() => updateConfig('magicZooms', !config.magicZooms)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    config.magicZooms 
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' 
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">Magic Zooms</p>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      config.magicZooms ? 'border-orange-500 bg-orange-500' : 'border-muted-foreground'
                    }`}>
                      {config.magicZooms && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Zooms automatiques</p>
                </button>

                {/* Remove Bad Takes */}
                <button
                  type="button"
                  onClick={() => updateConfig('removeBadTakes', !config.removeBadTakes)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    config.removeBadTakes 
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' 
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium flex items-center gap-1">
                      <Scissors className="w-3 h-3" />
                      Bad Takes
                    </p>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      config.removeBadTakes ? 'border-orange-500 bg-orange-500' : 'border-muted-foreground'
                    }`}>
                      {config.removeBadTakes && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Supprime les hésitations</p>
              </button>
            </div>

            {/* Magic B-rolls */}
              <div className={`p-3 rounded-xl border transition-all ${
                config.magicBrolls 
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' 
                  : 'border-border'
              }`}>
                <button
                  type="button"
                  onClick={() => updateConfig('magicBrolls', !config.magicBrolls)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div>
                    <p className="text-sm font-medium">Magic B-rolls</p>
                    <p className="text-xs text-muted-foreground">Vidéos stock IA contextuelles</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    config.magicBrolls ? 'border-orange-500 bg-orange-500' : 'border-muted-foreground'
                  }`}>
                    {config.magicBrolls && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>

              {config.magicBrolls && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex justify-between mb-2">
                      <Label className="text-xs text-muted-foreground">Couverture</Label>
                      <span className="text-xs font-mono">{config.magicBrollsPercentage || 50}%</span>
                    </div>
                  <Slider
                    value={[config.magicBrollsPercentage || 50]}
                    onValueChange={([value]) => updateConfig('magicBrollsPercentage', value)}
                    min={0}
                    max={100}
                    step={10}
                      className="[&_[role=slider]]:bg-orange-500"
                  />
                </div>
              )}
            </div>
          </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* OPTIONS AUDIO */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Options audio
            </h3>

              <div className="p-3 rounded-xl border border-border">
                <Label className="text-xs text-muted-foreground mb-2 block">Suppression des silences</Label>
              <Select
                value={config.removeSilencePace || 'none'}
                onValueChange={(value) => updateConfig('removeSilencePace', value === 'none' ? undefined : value as 'natural' | 'fast' | 'extra-fast')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Désactivé" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Désactivé</SelectItem>
                    <SelectItem value="natural">Naturel (0.6s+)</SelectItem>
                    <SelectItem value="fast">Rapide (0.2-0.6s)</SelectItem>
                    <SelectItem value="extra-fast">Très rapide (0.1-0.2s)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Info box */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
                Le traitement prend 1 à 5 minutes. La vidéo avec sous-titres apparaîtra automatiquement.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}
          </div>
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
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
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
