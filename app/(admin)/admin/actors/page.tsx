'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Actor, IntentionPreset, ActorIntentionMedia } from '@/types'
import { INTENTION_PRESETS } from '@/lib/presets'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

// Composant Upload Zone
function UploadZone({ 
  label, 
  accept, 
  value, 
  onChange, 
  onUpload,
  uploading,
  previewType = 'image'
}: {
  label: string
  accept: string
  value: string
  onChange: (url: string) => void
  onUpload: (file: File) => Promise<void>
  uploading: boolean
  previewType?: 'image' | 'video' | 'audio'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) await onUpload(file)
  }

  const handleClick = () => inputRef.current?.click()

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {/* Zone de drop */}
      <div
        onClick={handleClick}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-4 cursor-pointer
          transition-all duration-200 min-h-[120px]
          flex flex-col items-center justify-center gap-2
          ${dragOver 
            ? 'border-foreground bg-muted' 
            : value 
              ? 'border-green-500/50 bg-green-50' 
              : 'border-border hover:border-foreground/30 bg-muted/50'
          }
          ${uploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        {uploading ? (
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-sm text-muted-foreground">Upload en cours...</span>
          </div>
        ) : value ? (
          <div className="w-full">
            {previewType === 'image' && (
              <img src={value} alt="Preview" className="w-20 h-20 object-cover rounded-lg mx-auto" />
            )}
            {previewType === 'video' && (
              <video src={value} className="w-20 h-20 object-cover rounded-lg mx-auto" autoPlay loop muted />
            )}
            {previewType === 'audio' && (
              <audio src={value} controls className="w-full max-w-[200px] mx-auto" />
            )}
            <p className="text-xs text-green-600 text-center mt-2">✓ Fichier uploadé</p>
            <p className="text-xs text-muted-foreground text-center truncate max-w-full px-2">{value.split('/').pop()}</p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <span className="text-sm text-muted-foreground">Glisser-déposer ou cliquer</span>
            <span className="text-xs text-muted-foreground/60">{accept.replace(/,/g, ', ')}</span>
          </>
        )}
        
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) await onUpload(file)
          }}
          className="hidden"
        />
      </div>

      {/* Option URL manuelle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">ou URL :</span>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs h-8 flex-1 rounded-lg bg-muted/50 border-transparent"
          placeholder="https://..."
        />
        {value && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange('')}
            className="h-8 px-2 text-destructive hover:text-destructive/80"
          >
            ✕
          </Button>
        )}
      </div>
    </div>
  )
}

// Emojis pour les intentions
const INTENTION_EMOJIS: Record<string, string> = {
  'confession-intime': '🛏️',
  'morning-discovery': '☀️',
  'street-hype': '🏙️',
  'chill-testimonial': '🛋️',
  'car-confession': '🚗',
  'unboxing-product': '📦',
  'story-journey': '🎬',
}

// Templates par filming_type pour générer l'image de l'acteur
const FILMING_TYPE_TEMPLATES: Record<string, string> = {
  // Selfie tenu à la main - cadrage selfie naturel sans montrer le téléphone
  handheld: `Generate a photo of this same person as a first frame for a TikTok UGC video. {CONTEXT}. Same person as reference, close-up selfie angle, looking directly at camera, authentic UGC style. KEEP THE EXACT SAME FACE AND IDENTITY. NO TIKTOK UI, NO TEXT, NO WATERMARKS, NO OVERLAYS ON THE IMAGE. Do not show phone or arm holding phone.`,
  
  // Filmé par quelqu'un d'autre - pas de bras tendu, cadrage plus large
  filmed_by_other: `Generate a photo of this same person as a first frame for a TikTok UGC video. {CONTEXT}. Same person as reference, natural pose as if filmed by someone else, looking at camera or slightly off-camera, half-body or full-body framing, authentic UGC style. KEEP THE EXACT SAME FACE AND IDENTITY. NO TIKTOK UI, NO TEXT, NO WATERMARKS, NO OVERLAYS ON THE IMAGE.`,
  
  // Téléphone posé/trépied - cadrage fixe, mains libres pour montrer produit
  setup_phone: `Generate a photo of this same person as a first frame for a TikTok UGC video. {CONTEXT}. Same person as reference, natural pose with both hands free (as if phone is on tripod), looking at camera, half-body framing showing hands/desk area, authentic UGC style. KEEP THE EXACT SAME FACE AND IDENTITY. NO TIKTOK UI, NO TEXT, NO WATERMARKS, NO OVERLAYS ON THE IMAGE.`,
}

// Descriptions pour construire le contexte
const LOCATION_DESCRIPTIONS: Record<string, string> = {
  bedroom: 'In a cozy bedroom, sitting on the bed',
  living_room: 'In a comfortable living room, on the couch',
  kitchen: 'In a bright modern kitchen, standing by the counter',
  bathroom: 'In a bathroom, mirror selfie style',
  office_desk: 'At a home office desk',
  car: 'In a car interior, sitting in driver seat with seatbelt',
  street_urban: 'On a city street, walking casually, urban background',
  cafe: 'In a cozy cafe, sitting at a table',
  park_outdoor: 'In a park outdoors, natural setting',
  neutral_background: 'Against a clean neutral background',
}

const LIGHTING_DESCRIPTIONS: Record<string, string> = {
  soft_warm: 'soft warm lamp light',
  bright_natural: 'bright natural morning light',
  golden_hour: 'golden hour warm sunlight',
  neutral_daylight: 'neutral natural daylight',
  moody_low: 'moody low ambient lighting',
  ring_light: 'professional ring light',
}

const EXPRESSION_DESCRIPTIONS: Record<string, string> = {
  neutral_relaxed: 'looking relaxed and natural',
  thoughtful: 'looking thoughtful',
  excited: 'looking excited and energetic',
  curious: 'looking curious',
  frustrated: 'looking slightly frustrated',
  relieved: 'looking relieved',
  confident: 'looking confident',
  surprised: 'looking surprised',
}

// Construire le prompt complet pour une intention (prend en compte filming_type)
function buildIntentionPrompt(preset: IntentionPreset): string {
  const { first_frame, filming_type } = preset
  const location = LOCATION_DESCRIPTIONS[first_frame.location] || first_frame.location
  const lighting = LIGHTING_DESCRIPTIONS[first_frame.lighting] || first_frame.lighting
  const expression = EXPRESSION_DESCRIPTIONS[first_frame.base_expression] || first_frame.base_expression
  const context = `${location}, ${lighting}, ${expression}, ${first_frame.extra_prompt}`
  const template = FILMING_TYPE_TEMPLATES[filming_type || 'handheld'] || FILMING_TYPE_TEMPLATES.handheld
  return template.replace('{CONTEXT}', context)
}

export default function AdminActorsPage() {
  const [actors, setActors] = useState<Actor[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Actor | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const [generatingIntentions, setGeneratingIntentions] = useState<string | null>(null) // actorId
  const [selectedIntentions, setSelectedIntentions] = useState<string[]>([]) // preset ids
  const [expandedActor, setExpandedActor] = useState<string | null>(null)
  const [showPrompts, setShowPrompts] = useState<string | null>(null) // presetId to show prompt
  const [editingPrompt, setEditingPrompt] = useState<{ actorId: string; presetId: string } | null>(null)
  const [customPrompts, setCustomPrompts] = useState<Record<string, Record<string, string>>>({}) // actorId -> presetId -> prompt
  const [savingPrompt, setSavingPrompt] = useState(false)
  const supabase = createClient()

  // Form state
  const [form, setForm] = useState({
    name: '',
    gender: 'female' as 'female' | 'male' | 'non-binary',
    age_range: '',
    ethnicity: '',
    hair: '',
    distinctive_features: '',
    voice_style: '',
    soul_image_url: '',
    thumbnail_video_url: '',
    voice_reference_url: '',
  })

  useEffect(() => {
    loadActors()
  }, [])

  const loadActors = async () => {
    setLoading(true)
    const { data, error } = await (supabase
      .from('actors') as any)
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setActors(data as Actor[])
    }
    setLoading(false)
  }

  const resetForm = () => {
    setForm({
      name: '',
      gender: 'female',
      age_range: '',
      ethnicity: '',
      hair: '',
      distinctive_features: '',
      voice_style: '',
      soul_image_url: '',
      thumbnail_video_url: '',
      voice_reference_url: '',
    })
  }

  const startNew = () => {
    resetForm()
    setEditing(null)
    setIsNew(true)
  }

  const startEdit = (actor: Actor) => {
    setForm({
      name: actor.name,
      gender: actor.appearance.gender,
      age_range: actor.appearance.age_range,
      ethnicity: actor.appearance.ethnicity,
      hair: actor.appearance.hair,
      distinctive_features: actor.appearance.distinctive_features,
      voice_style: actor.voice.voice_style,
      soul_image_url: actor.soul_image_url,
      thumbnail_video_url: actor.thumbnail_video_url || '',
      voice_reference_url: actor.voice.reference_audio_url,
    })
    setEditing(actor)
    setIsNew(false)
  }

  const cancelEdit = () => {
    setEditing(null)
    setIsNew(false)
    resetForm()
  }

  const handleSave = async () => {
    setSaving(true)

    const actorData = {
      name: form.name,
      soul_image_url: form.soul_image_url,
      thumbnail_video_url: form.thumbnail_video_url || null,
      voice: {
        reference_audio_url: form.voice_reference_url,
        voice_style: form.voice_style,
      },
      appearance: {
        gender: form.gender,
        age_range: form.age_range,
        ethnicity: form.ethnicity,
        hair: form.hair,
        distinctive_features: form.distinctive_features,
      },
      is_custom: false, // Admin-created actors are not "custom" (they're preset)
    }

    if (isNew) {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: newActor, error } = await (supabase
        .from('actors') as any)
        .insert({ ...actorData, user_id: user?.id })
        .select()
        .single()

      if (error) {
        alert('Erreur: ' + error.message)
      } else if (newActor) {
        // Auto-générer les intention_media pour toutes les intentions
        await loadActors()
        cancelEdit()
        
        // Lancer la génération en arrière-plan
        autoGenerateIntentionMedia(newActor.id, form.soul_image_url, form.name)
      }
    } else if (editing) {
      const { error } = await (supabase
        .from('actors') as any)
        .update(actorData)
        .eq('id', editing.id)

      if (error) {
        alert('Erreur: ' + error.message)
      } else {
        await loadActors()
        cancelEdit()
      }
    }

    setSaving(false)
  }

  const handleDelete = async (actor: Actor) => {
    if (!confirm(`Supprimer l'acteur "${actor.name}" ?`)) return

    const { error } = await (supabase
      .from('actors') as any)
      .delete()
      .eq('id', actor.id)

    if (error) {
      alert('Erreur: ' + error.message)
    } else {
      await loadActors()
    }
  }

  const handleFileUpload = async (
    file: File,
    field: 'soul_image_url' | 'thumbnail_video_url' | 'voice_reference_url'
  ) => {
    setUploadingField(field)

    const bucket = field === 'voice_reference_url' ? 'audio' : 'actors'
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file)

    if (error) {
      alert('Erreur upload: ' + error.message)
      setUploadingField(null)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path)

    setForm(prev => ({ ...prev, [field]: publicUrl }))
    setUploadingField(null)
  }

  const handleGenerateIntentionMedia = async (actor: Actor) => {
    if (selectedIntentions.length === 0) {
      alert('Sélectionne au moins une intention à générer')
      return
    }

    setGeneratingIntentions(actor.id)

    try {
      const presetsToGenerate = INTENTION_PRESETS.filter(p => selectedIntentions.includes(p.id))
      
      // Collecter les prompts personnalisés pour les intentions sélectionnées
      const customPromptsToSend: Record<string, string> = {}
      for (const preset of presetsToGenerate) {
        const customPrompt = actor.intention_media?.[preset.id]?.custom_frame_prompt
        if (customPrompt) {
          customPromptsToSend[preset.id] = customPrompt
        }
      }
      
      const response = await fetch('/api/generate/intention-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: actor.id,
          soulImageUrl: actor.soul_image_url,
          presets: presetsToGenerate,
          customPrompts: Object.keys(customPromptsToSend).length > 0 ? customPromptsToSend : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur de génération')
      }

      alert(`✅ ${data.generated.length} images générées !${data.failed.length > 0 ? `\n⚠️ ${data.failed.length} échecs: ${data.failed.join(', ')}` : ''}`)
      await loadActors()
      setSelectedIntentions([])
    } catch (error) {
      alert('Erreur: ' + (error instanceof Error ? error.message : 'Erreur inconnue'))
    } finally {
      setGeneratingIntentions(null)
    }
  }

  const toggleIntentionSelection = (presetId: string) => {
    setSelectedIntentions(prev => 
      prev.includes(presetId) 
        ? prev.filter(id => id !== presetId)
        : [...prev, presetId]
    )
  }

  const selectAllMissingIntentions = (actor: Actor) => {
    const existing = Object.keys(actor.intention_media || {})
    const missing = INTENTION_PRESETS
      .map(p => p.id)
      .filter(id => !existing.includes(id))
    setSelectedIntentions(missing)
  }

  // Récupérer le prompt (personnalisé ou par défaut)
  const getPromptForIntention = (actor: Actor, preset: IntentionPreset): string => {
    // D'abord vérifier si on a un prompt en cours d'édition dans le state local
    const localPrompt = customPrompts[actor.id]?.[preset.id]
    if (localPrompt !== undefined) return localPrompt

    // Ensuite vérifier le prompt personnalisé sauvegardé
    const savedPrompt = actor.intention_media?.[preset.id]?.custom_frame_prompt
    if (savedPrompt) return savedPrompt

    // Sinon retourner le prompt par défaut
    return buildIntentionPrompt(preset)
  }

  // Mettre à jour le prompt localement
  const handlePromptChange = (actorId: string, presetId: string, value: string) => {
    setCustomPrompts(prev => ({
      ...prev,
      [actorId]: {
        ...prev[actorId],
        [presetId]: value
      }
    }))
  }

  // Sauvegarder le prompt personnalisé
  const handleSaveCustomPrompt = async (actor: Actor, presetId: string) => {
    const newPrompt = customPrompts[actor.id]?.[presetId]
    if (newPrompt === undefined) return

    setSavingPrompt(true)
    
    // Récupérer l'intention_media existante
    const existingMedia = actor.intention_media || {}
    const updatedMedia = {
      ...existingMedia,
      [presetId]: {
        ...existingMedia[presetId],
        custom_frame_prompt: newPrompt
      }
    }

    const { error } = await (supabase
      .from('actors') as any)
      .update({ intention_media: updatedMedia })
      .eq('id', actor.id)

    if (error) {
      alert('Erreur: ' + error.message)
    } else {
      await loadActors()
      // Nettoyer le state local pour ce prompt
      setCustomPrompts(prev => {
        const newState = { ...prev }
        if (newState[actor.id]) {
          delete newState[actor.id][presetId]
        }
        return newState
      })
      setEditingPrompt(null)
    }

    setSavingPrompt(false)
  }

  // Réinitialiser au prompt par défaut
  const handleResetPrompt = async (actor: Actor, presetId: string) => {
    setSavingPrompt(true)
    
    const existingMedia = actor.intention_media || {}
    const updatedMedia = {
      ...existingMedia,
      [presetId]: {
        ...existingMedia[presetId],
        custom_frame_prompt: undefined // Supprimer le prompt personnalisé
      }
    }

    const { error } = await (supabase
      .from('actors') as any)
      .update({ intention_media: updatedMedia })
      .eq('id', actor.id)

    if (error) {
      alert('Erreur: ' + error.message)
    } else {
      await loadActors()
      // Nettoyer le state local
      setCustomPrompts(prev => {
        const newState = { ...prev }
        if (newState[actor.id]) {
          delete newState[actor.id][presetId]
        }
        return newState
      })
      setEditingPrompt(null)
    }

    setSavingPrompt(false)
  }

  // Vérifier si un prompt est personnalisé
  const isPromptCustomized = (actor: Actor, presetId: string): boolean => {
    return !!actor.intention_media?.[presetId]?.custom_frame_prompt
  }

  // Auto-génération après création d'un nouvel acteur
  const autoGenerateIntentionMedia = async (actorId: string, soulImageUrl: string, actorName: string) => {
    // Notification de démarrage
    alert(`🎨 Génération automatique des ${INTENTION_PRESETS.length} images d'intentions pour "${actorName}" lancée en arrière-plan.\n\nCela peut prendre quelques minutes. Rafraîchis la page pour voir la progression.`)

    try {
      const response = await fetch('/api/generate/intention-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId,
          soulImageUrl,
          presets: INTENTION_PRESETS,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Auto-generation failed:', data.error)
        return
      }

      console.log(`✅ Auto-generation complete for ${actorName}:`, data)
      await loadActors() // Refresh pour afficher les nouvelles images
    } catch (error) {
      console.error('Auto-generation error:', error)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Gestion des Acteurs</h1>
          <p className="text-muted-foreground mt-2">Ajouter et modifier les acteurs IA</p>
        </div>
        {!isNew && !editing && (
          <Button onClick={startNew} className="rounded-xl h-11 px-5">
            + Nouvel acteur
          </Button>
        )}
      </div>

      {/* Edit/New Form */}
      {(isNew || editing) && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>
              {isNew ? 'Nouvel acteur' : `Modifier ${editing?.name}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Nom</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    className="h-11 rounded-xl bg-muted/50 border-transparent focus:border-foreground"
                    placeholder="Luna"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Genre</Label>
                  <Select
                    value={form.gender}
                    onValueChange={(v) => setForm(prev => ({ ...prev, gender: v as typeof form.gender }))}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-muted/50 border-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Femme</SelectItem>
                      <SelectItem value="male">Homme</SelectItem>
                      <SelectItem value="non-binary">Non-binaire</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tranche d'âge</Label>
                  <Input
                    value={form.age_range}
                    onChange={(e) => setForm(prev => ({ ...prev, age_range: e.target.value }))}
                    className="h-11 rounded-xl bg-muted/50 border-transparent focus:border-foreground"
                    placeholder="25-30"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Ethnicité</Label>
                  <Input
                    value={form.ethnicity}
                    onChange={(e) => setForm(prev => ({ ...prev, ethnicity: e.target.value }))}
                    className="h-11 rounded-xl bg-muted/50 border-transparent focus:border-foreground"
                    placeholder="European"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Cheveux</Label>
                  <Input
                    value={form.hair}
                    onChange={(e) => setForm(prev => ({ ...prev, hair: e.target.value }))}
                    className="h-11 rounded-xl bg-muted/50 border-transparent focus:border-foreground"
                    placeholder="long brown wavy"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Traits distinctifs</Label>
                  <Textarea
                    value={form.distinctive_features}
                    onChange={(e) => setForm(prev => ({ ...prev, distinctive_features: e.target.value }))}
                    className="rounded-xl bg-muted/50 border-transparent focus:border-foreground resize-none"
                    placeholder="warm smile, freckles"
                  />
                </div>
              </div>

              {/* Media */}
              <div className="space-y-5">
                <UploadZone
                  label="🖼️ Image SOUL (référence acteur)"
                  accept="image/*"
                  value={form.soul_image_url}
                  onChange={(url) => setForm(prev => ({ ...prev, soul_image_url: url }))}
                  onUpload={(file) => handleFileUpload(file, 'soul_image_url')}
                  uploading={uploadingField === 'soul_image_url'}
                  previewType="image"
                />

                <UploadZone
                  label="🎬 Vidéo preview (thumbnail acteur)"
                  accept="video/*"
                  value={form.thumbnail_video_url}
                  onChange={(url) => setForm(prev => ({ ...prev, thumbnail_video_url: url }))}
                  onUpload={(file) => handleFileUpload(file, 'thumbnail_video_url')}
                  uploading={uploadingField === 'thumbnail_video_url'}
                  previewType="video"
                />

                <UploadZone
                  label="🎤 Audio référence voix (pour Chatterbox)"
                  accept="audio/*"
                  value={form.voice_reference_url}
                  onChange={(url) => setForm(prev => ({ ...prev, voice_reference_url: url }))}
                  onUpload={(file) => handleFileUpload(file, 'voice_reference_url')}
                  uploading={uploadingField === 'voice_reference_url'}
                  previewType="audio"
                />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Style de voix</Label>
                  <Input
                    value={form.voice_style}
                    onChange={(e) => setForm(prev => ({ ...prev, voice_style: e.target.value }))}
                    className="h-11 rounded-xl bg-muted/50 border-transparent focus:border-foreground"
                    placeholder="warm, friendly, energetic..."
                  />
                </div>
              </div>
            </div>

            {/* Preview Intention Prompts */}
            <div className="border-t border-border pt-6">
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium flex items-center gap-2 mb-4">
                  <span className="group-open:rotate-90 transition-transform">▶</span>
                  📝 Prévisualisation des prompts d'intentions
                  <span className="text-xs text-muted-foreground font-normal">
                    ({INTENTION_PRESETS.length} prompts)
                  </span>
                </summary>
                <div className="space-y-3 pl-4">
                  <p className="text-xs text-muted-foreground mb-4">
                    Ces prompts seront utilisés pour générer les images de l'acteur dans chaque contexte/intention :
                  </p>
                  {INTENTION_PRESETS.map((preset) => (
                    <div key={preset.id} className="p-3 bg-muted/30 rounded-xl border border-border/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium flex items-center gap-2">
                          {INTENTION_EMOJIS[preset.id] || '🎬'} {preset.name}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(buildIntentionPrompt(preset))
                            alert('Prompt copié !')
                          }}
                          className="h-6 text-[10px] px-2"
                        >
                          📋 Copier
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono bg-background/50 p-2 rounded-lg leading-relaxed">
                        {buildIntentionPrompt(preset)}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <Button onClick={handleSave} disabled={saving} className="rounded-xl h-11 px-6">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
              <Button onClick={cancelEdit} variant="ghost" className="rounded-xl h-11">
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actors List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : actors.length === 0 ? (
        <Card className="border-dashed rounded-2xl">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Aucun acteur dans la base de données</p>
            <Button onClick={startNew} className="rounded-xl">
              Créer le premier acteur
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {actors.map((actor) => {
            const intentionMedia = actor.intention_media || {}
            const intentionCount = Object.keys(intentionMedia).length
            const isExpanded = expandedActor === actor.id
            const isGenerating = generatingIntentions === actor.id

            return (
              <Card key={actor.id} className="rounded-2xl hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex gap-4">
                    {/* Preview */}
                    <div className="w-24 h-32 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                      {actor.thumbnail_video_url ? (
                        <video
                          src={actor.thumbnail_video_url}
                          className="w-full h-full object-cover"
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                      ) : actor.soul_image_url ? (
                        <img
                          src={actor.soul_image_url}
                          alt={actor.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          No image
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{actor.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {actor.appearance.gender === 'female' ? 'Femme' : actor.appearance.gender === 'male' ? 'Homme' : 'NB'}
                        {' • '}{actor.appearance.age_range}
                      </p>
                      <p className="text-xs text-muted-foreground/60 truncate mt-1">
                        {actor.appearance.hair}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {actor.is_custom && <Badge variant="secondary">Custom</Badge>}
                        <Badge variant={intentionCount > 0 ? 'default' : 'secondary'}>
                          🎬 {intentionCount}/{INTENTION_PRESETS.length} intentions
                        </Badge>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(actor)}
                          className="text-xs rounded-lg"
                        >
                          Éditer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setExpandedActor(isExpanded ? null : actor.id)
                            setSelectedIntentions([])
                          }}
                          className="text-xs rounded-lg"
                        >
                          {isExpanded ? '▲ Fermer' : '🎬 Intentions'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(actor)}
                          className="text-xs text-destructive hover:text-destructive/80"
                        >
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Intention Media Section (Expanded) */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium">Images par intention</h4>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => selectAllMissingIntentions(actor)}
                          className="text-xs"
                        >
                          Sélectionner manquants
                        </Button>
                      </div>

                      {/* Intentions Grid */}
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {INTENTION_PRESETS.map((preset) => {
                          const media = intentionMedia[preset.id]
                          const hasImage = !!media?.image_url
                          const hasVideo = !!media?.video_url
                          const isSelected = selectedIntentions.includes(preset.id)
                          const emoji = INTENTION_EMOJIS[preset.id] || '🎬'
                          const isShowingPrompt = showPrompts === preset.id
                          
                          return (
                            <div key={preset.id} className="space-y-1">
                              <div
                                onClick={() => !isGenerating && toggleIntentionSelection(preset.id)}
                                className={`
                                  relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer
                                  border-3 transition-all
                                  ${isSelected 
                                    ? 'border-blue-500 ring-2 ring-blue-500/30' 
                                    : hasImage 
                                      ? 'border-green-500' 
                                      : 'border-border bg-muted/50'
                                  }
                                  ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:border-foreground/50'}
                                `}
                              >
                                {hasImage ? (
                                  <img 
                                    src={media.image_url} 
                                    alt={preset.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-2xl bg-muted">
                                    {emoji}
                                  </div>
                                )}
                                
                                {/* Video badge */}
                                {hasVideo && (
                                  <div className="absolute top-1 right-1 bg-foreground rounded-full px-1.5 py-0.5">
                                    <span className="text-[10px] text-background">📹</span>
                                  </div>
                                )}
                                
                                {/* Selection indicator - always visible when selected */}
                                {isSelected && (
                                  <div className="absolute top-1 left-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                                    <span className="text-white text-sm font-bold">✓</span>
                                  </div>
                                )}
                                
                                {/* Selection overlay for items without image */}
                                {isSelected && !hasImage && (
                                  <div className="absolute inset-0 bg-blue-500/20" />
                                )}

                                {/* Label */}
                                <div className="absolute bottom-0 left-0 right-0 bg-foreground/80 py-1 px-1">
                                  <span className="text-[10px] text-background truncate block text-center">
                                    {preset.name}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Show/Hide Prompt Button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setShowPrompts(isShowingPrompt ? null : preset.id)
                                }}
                                className="w-full h-6 text-[10px] px-1 text-muted-foreground hover:text-foreground"
                              >
                                {isShowingPrompt ? '▲ Masquer' : '📝 Prompt'}
                              </Button>
                            </div>
                          )
                        })}
                      </div>

                      {/* Show/Edit Prompt Details */}
                      {showPrompts && (
                        <div className="mb-4 p-3 bg-muted/50 rounded-xl border border-border">
                          {(() => {
                            const preset = INTENTION_PRESETS.find(p => p.id === showPrompts)!
                            const isEditing = editingPrompt?.actorId === actor.id && editingPrompt?.presetId === showPrompts
                            const currentPrompt = getPromptForIntention(actor, preset)
                            const isCustom = isPromptCustomized(actor, showPrompts)
                            const hasLocalChanges = customPrompts[actor.id]?.[showPrompts] !== undefined

                            return (
                              <>
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="text-xs font-medium flex items-center gap-2">
                                    📝 Prompt pour : {preset.name}
                                    {isCustom && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                        Personnalisé
                                      </Badge>
                                    )}
                                  </h5>
                                  <div className="flex gap-1">
                                    {!isEditing ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            navigator.clipboard.writeText(currentPrompt)
                                            alert('Prompt copié !')
                                          }}
                                          className="h-6 text-[10px] px-2"
                                        >
                                          📋 Copier
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setEditingPrompt({ actorId: actor.id, presetId: showPrompts })
                                            // Initialiser avec le prompt actuel si pas déjà en local
                                            if (customPrompts[actor.id]?.[showPrompts] === undefined) {
                                              handlePromptChange(actor.id, showPrompts, currentPrompt)
                                            }
                                          }}
                                          className="h-6 text-[10px] px-2"
                                        >
                                          ✏️ Éditer
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setEditingPrompt(null)
                                            // Nettoyer les changements locaux
                                            setCustomPrompts(prev => {
                                              const newState = { ...prev }
                                              if (newState[actor.id]) {
                                                delete newState[actor.id][showPrompts]
                                              }
                                              return newState
                                            })
                                          }}
                                          disabled={savingPrompt}
                                          className="h-6 text-[10px] px-2"
                                        >
                                          ✕ Annuler
                                        </Button>
                                        {isCustom && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleResetPrompt(actor, showPrompts)}
                                            disabled={savingPrompt}
                                            className="h-6 text-[10px] px-2 text-orange-600 hover:text-orange-700"
                                          >
                                            🔄 Défaut
                                          </Button>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="default"
                                          onClick={() => handleSaveCustomPrompt(actor, showPrompts)}
                                          disabled={savingPrompt || !hasLocalChanges}
                                          className="h-6 text-[10px] px-2"
                                        >
                                          {savingPrompt ? '...' : '💾 Sauvegarder'}
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                                
                                {isEditing ? (
                                  <Textarea
                                    value={customPrompts[actor.id]?.[showPrompts] || currentPrompt}
                                    onChange={(e) => handlePromptChange(actor.id, showPrompts, e.target.value)}
                                    className="text-xs font-mono bg-background p-2 rounded-lg leading-relaxed min-h-[150px] resize-y"
                                    placeholder="Entrez votre prompt personnalisé..."
                                  />
                                ) : (
                                  <p className="text-xs text-muted-foreground font-mono bg-background/50 p-2 rounded-lg leading-relaxed whitespace-pre-wrap">
                                    {currentPrompt}
                                  </p>
                                )}
                                
                                {isEditing && (
                                  <p className="text-[10px] text-muted-foreground mt-2">
                                    💡 Ce prompt sera utilisé lors de la génération de l'image pour cette intention.
                                  </p>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      )}

                      {/* Generate Button */}
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={() => handleGenerateIntentionMedia(actor)}
                          disabled={isGenerating || selectedIntentions.length === 0}
                          className="text-sm rounded-xl"
                        >
                          {isGenerating ? (
                            <>
                              <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin mr-2" />
                              Génération en cours...
                            </>
                          ) : (
                            `🎨 Générer ${selectedIntentions.length} image${selectedIntentions.length > 1 ? 's' : ''}`
                          )}
                        </Button>
                        {selectedIntentions.length > 0 && !isGenerating && (
                          <span className="text-xs text-muted-foreground">
                            {selectedIntentions.map(id => INTENTION_PRESETS.find(p => p.id === id)?.name).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

