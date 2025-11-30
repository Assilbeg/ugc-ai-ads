'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IntentionPreset, ScriptBeat, ToneType, LocationType, PostureType, LightingType, ExpressionType } from '@/types'
import { INTENTION_PRESETS } from '@/lib/presets'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const LOCATIONS: LocationType[] = ['bedroom', 'living_room', 'kitchen', 'bathroom', 'office_desk', 'car', 'street_urban', 'cafe', 'park_outdoor', 'neutral_background']
const POSTURES: PostureType[] = ['sitting_bed', 'sitting_couch', 'sitting_desk', 'sitting_car', 'standing_casual', 'standing_mirror', 'walking', 'leaning']
const LIGHTINGS: LightingType[] = ['soft_warm', 'bright_natural', 'golden_hour', 'neutral_daylight', 'moody_low', 'ring_light']
const EXPRESSIONS: ExpressionType[] = ['neutral_relaxed', 'thoughtful', 'excited', 'curious', 'frustrated', 'relieved', 'confident', 'surprised']
const TONES: ToneType[] = ['vulnerable', 'energetic', 'conversational', 'authoritative', 'playful', 'urgent']
const BEATS: ScriptBeat[] = ['hook', 'problem', 'agitation', 'solution', 'proof', 'cta']

export default function AdminPresetsPage() {
  const [presets, setPresets] = useState<IntentionPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<IntentionPreset | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const supabase = createClient()

  // Form state
  const [form, setForm] = useState<IntentionPreset>({
    id: '',
    name: '',
    slug: '',
    description: '',
    thumbnail_url: '',
    first_frame: {
      location: 'bedroom',
      posture: 'sitting_bed',
      lighting: 'soft_warm',
      base_expression: 'neutral_relaxed',
      camera_angle: 'selfie_front',
      extra_prompt: '',
      scene_mode: 'single_location',
      camera_style: 'handheld_subtle',
    },
    script: {
      tone: 'conversational',
      structure: ['hook', 'problem', 'solution', 'cta'],
      hook_templates: [''],
      cta_templates: [''],
    },
    ambient_audio: {
      prompt: '',
      intensity: 'subtle',
    },
    suggested_total_duration: 30,
    suggested_clip_count: 4,
  })

  useEffect(() => {
    loadPresets()
  }, [])

  const loadPresets = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('intention_presets')
      .select('*')
      .order('name')

    if (!error && data) {
      setPresets(data as IntentionPreset[])
    }
    setLoading(false)
  }

  const migrateFromCode = async () => {
    if (!confirm('Migrer les 6 presets du code vers Supabase ? Cela écrasera les presets existants avec le même ID.')) return
    
    setMigrating(true)
    
    for (const preset of INTENTION_PRESETS) {
      const { error } = await (supabase
        .from('intention_presets') as any)
        .upsert({
          id: preset.id,
          name: preset.name,
          slug: preset.slug,
          description: preset.description,
          thumbnail_url: preset.thumbnail_url,
          first_frame: preset.first_frame,
          script: preset.script,
          ambient_audio: preset.ambient_audio,
          suggested_total_duration: preset.suggested_total_duration,
          suggested_clip_count: preset.suggested_clip_count,
        })
      
      if (error) {
        alert(`Erreur migration ${preset.name}: ${error.message}`)
      }
    }
    
    await loadPresets()
    setMigrating(false)
    alert('Migration terminée !')
  }

  const resetForm = () => {
    setForm({
      id: '',
      name: '',
      slug: '',
      description: '',
      thumbnail_url: '',
      first_frame: {
        location: 'bedroom',
        posture: 'sitting_bed',
        lighting: 'soft_warm',
        base_expression: 'neutral_relaxed',
        camera_angle: 'selfie_front',
        extra_prompt: '',
        scene_mode: 'single_location',
        camera_style: 'handheld_subtle',
      },
      script: {
        tone: 'conversational',
        structure: ['hook', 'problem', 'solution', 'cta'],
        hook_templates: [''],
        cta_templates: [''],
      },
      ambient_audio: {
        prompt: '',
        intensity: 'subtle',
      },
      suggested_total_duration: 30,
      suggested_clip_count: 4,
    })
  }

  const startNew = () => {
    resetForm()
    setEditing(null)
    setIsNew(true)
  }

  const startEdit = (preset: IntentionPreset) => {
    setForm(preset)
    setEditing(preset)
    setIsNew(false)
  }

  const cancelEdit = () => {
    setEditing(null)
    setIsNew(false)
    resetForm()
  }

  const handleSave = async () => {
    setSaving(true)

    const presetData = {
      id: form.id || form.slug,
      name: form.name,
      slug: form.slug,
      description: form.description,
      thumbnail_url: form.thumbnail_url,
      first_frame: form.first_frame,
      script: form.script,
      ambient_audio: form.ambient_audio,
      suggested_total_duration: form.suggested_total_duration,
      suggested_clip_count: form.suggested_clip_count,
    }

    if (isNew) {
      const { error } = await (supabase
        .from('intention_presets') as any)
        .insert(presetData)

      if (error) {
        alert('Erreur: ' + error.message)
      } else {
        await loadPresets()
        cancelEdit()
      }
    } else if (editing) {
      const { error } = await (supabase
        .from('intention_presets') as any)
        .update(presetData)
        .eq('id', editing.id)

      if (error) {
        alert('Erreur: ' + error.message)
      } else {
        await loadPresets()
        cancelEdit()
      }
    }

    setSaving(false)
  }

  const handleDelete = async (preset: IntentionPreset) => {
    if (!confirm(`Supprimer le preset "${preset.name}" ?`)) return

    const { error } = await (supabase
      .from('intention_presets') as any)
      .delete()
      .eq('id', preset.id)

    if (error) {
      alert('Erreur: ' + error.message)
    } else {
      await loadPresets()
    }
  }

  const updateStructure = (beat: ScriptBeat, checked: boolean) => {
    setForm(prev => ({
      ...prev,
      script: {
        ...prev.script,
        structure: checked 
          ? [...prev.script.structure, beat]
          : prev.script.structure.filter(b => b !== beat)
      }
    }))
  }

  const updateHookTemplates = (value: string) => {
    setForm(prev => ({
      ...prev,
      script: {
        ...prev.script,
        hook_templates: value.split('\n').filter(Boolean)
      }
    }))
  }

  const updateCtaTemplates = (value: string) => {
    setForm(prev => ({
      ...prev,
      script: {
        ...prev.script,
        cta_templates: value.split('\n').filter(Boolean)
      }
    }))
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Gestion des Presets</h1>
          <p className="text-muted-foreground mt-2">Templates d'intention pour les campagnes</p>
        </div>
        <div className="flex gap-2">
          {presets.length === 0 && (
            <Button 
              onClick={migrateFromCode} 
              disabled={migrating}
              variant="outline"
              className="rounded-xl"
            >
              {migrating ? 'Migration...' : '📥 Importer depuis le code'}
            </Button>
          )}
          {!isNew && !editing && (
            <Button onClick={startNew} className="rounded-xl h-11 px-5">
              + Nouveau preset
            </Button>
          )}
        </div>
      </div>

      {/* Edit/New Form */}
      {(isNew || editing) && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>
              {isNew ? 'Nouveau preset' : `Modifier ${editing?.name}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="basic" className="space-y-6">
              <TabsList>
                <TabsTrigger value="basic">Infos de base</TabsTrigger>
                <TabsTrigger value="visual">Visuel</TabsTrigger>
                <TabsTrigger value="script">Script</TabsTrigger>
                <TabsTrigger value="audio">Audio</TabsTrigger>
              </TabsList>

              {/* Basic Info */}
              <TabsContent value="basic" className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300">Nom</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white"
                      placeholder="Confession intime"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300">Slug (ID)</Label>
                    <Input
                      value={form.slug}
                      onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value, id: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white"
                      placeholder="confession-intime"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="Partage personnel et vulnérable..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300">Durée suggérée (s)</Label>
                    <Input
                      type="number"
                      value={form.suggested_total_duration}
                      onChange={(e) => setForm(prev => ({ ...prev, suggested_total_duration: parseInt(e.target.value) || 30 }))}
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300">Nombre de clips suggéré</Label>
                    <Input
                      type="number"
                      value={form.suggested_clip_count}
                      onChange={(e) => setForm(prev => ({ ...prev, suggested_clip_count: parseInt(e.target.value) || 4 }))}
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Visual Config */}
              <TabsContent value="visual" className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300">Lieu</Label>
                    <Select
                      value={form.first_frame.location}
                      onValueChange={(v) => setForm(prev => ({ ...prev, first_frame: { ...prev.first_frame, location: v as LocationType } }))}
                    >
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCATIONS.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300">Posture</Label>
                    <Select
                      value={form.first_frame.posture}
                      onValueChange={(v) => setForm(prev => ({ ...prev, first_frame: { ...prev.first_frame, posture: v as PostureType } }))}
                    >
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POSTURES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300">Lumière</Label>
                    <Select
                      value={form.first_frame.lighting}
                      onValueChange={(v) => setForm(prev => ({ ...prev, first_frame: { ...prev.first_frame, lighting: v as LightingType } }))}
                    >
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LIGHTINGS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300">Expression de base</Label>
                    <Select
                      value={form.first_frame.base_expression}
                      onValueChange={(v) => setForm(prev => ({ ...prev, first_frame: { ...prev.first_frame, base_expression: v as ExpressionType } }))}
                    >
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPRESSIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Extra prompt visuel</Label>
                  <Textarea
                    value={form.first_frame.extra_prompt}
                    onChange={(e) => setForm(prev => ({ ...prev, first_frame: { ...prev.first_frame, extra_prompt: e.target.value } }))}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="cozy atmosphere, soft shadows, intimate setting..."
                  />
                </div>
              </TabsContent>

              {/* Script Config */}
              <TabsContent value="script" className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Ton</Label>
                  <Select
                    value={form.script.tone}
                    onValueChange={(v) => setForm(prev => ({ ...prev, script: { ...prev.script, tone: v as ToneType } }))}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Structure narrative</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {BEATS.map(beat => (
                      <label key={beat} className="flex items-center gap-2 text-zinc-300">
                        <input
                          type="checkbox"
                          checked={form.script.structure.includes(beat)}
                          onChange={(e) => updateStructure(beat, e.target.checked)}
                          className="rounded"
                        />
                        {beat.toUpperCase()}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Ordre actuel : {form.script.structure.join(' → ')}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Templates de hooks (1 par ligne)</Label>
                  <Textarea
                    value={form.script.hook_templates.join('\n')}
                    onChange={(e) => updateHookTemplates(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white min-h-[100px]"
                    placeholder="Franchement j'aurais jamais cru dire ça mais...
Ok faut que je vous avoue un truc..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Templates de CTA (1 par ligne)</Label>
                  <Textarea
                    value={form.script.cta_templates.join('\n')}
                    onChange={(e) => updateCtaTemplates(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white min-h-[100px]"
                    placeholder="Le lien est en bio, sérieux testez
Clique sur le lien, tu me remercieras"
                  />
                </div>
              </TabsContent>

              {/* Audio Config */}
              <TabsContent value="audio" className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Prompt ambiance audio</Label>
                  <Textarea
                    value={form.ambient_audio.prompt}
                    onChange={(e) => setForm(prev => ({ ...prev, ambient_audio: { ...prev.ambient_audio, prompt: e.target.value } }))}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="quiet bedroom at night, soft distant traffic, occasional AC hum, very subtle"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Intensité</Label>
                  <Select
                    value={form.ambient_audio.intensity}
                    onValueChange={(v) => setForm(prev => ({ ...prev, ambient_audio: { ...prev.ambient_audio, intensity: v as 'subtle' | 'moderate' | 'prominent' } }))}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subtle">Subtle</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="prominent">Prominent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex gap-4 mt-6">
              <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-500">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
              <Button onClick={cancelEdit} variant="ghost" className="text-zinc-400">
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Presets List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : presets.length === 0 ? (
        <Card className="border-dashed rounded-2xl">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Aucun preset dans Supabase</p>
            <Button 
              onClick={migrateFromCode} 
              disabled={migrating}
              className="rounded-xl"
            >
              {migrating ? 'Migration...' : '📥 Importer les 6 presets depuis le code'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {presets.map((preset) => (
            <Card key={preset.id} className="rounded-2xl hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-medium">{preset.name}</CardTitle>
                  <Badge variant="secondary">
                    {preset.script.tone}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{preset.description}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {preset.script.structure.map(beat => (
                    <Badge key={beat} variant="outline" className="text-xs rounded-full">{beat}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {preset.suggested_total_duration}s • {preset.suggested_clip_count} clips
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(preset)}
                    className="text-xs rounded-lg"
                  >
                    Éditer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(preset)}
                    className="text-xs text-destructive hover:text-destructive/80"
                  >
                    Supprimer
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

