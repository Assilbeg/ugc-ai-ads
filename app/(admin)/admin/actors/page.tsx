'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Actor } from '@/types'
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
    <div className="space-y-1.5">
      <Label className="text-zinc-300">{label}</Label>
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
            ? 'border-violet-500 bg-violet-500/10' 
            : value 
              ? 'border-green-600/50 bg-green-900/10' 
              : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50'
          }
          ${uploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        {uploading ? (
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-sm text-zinc-400">Upload en cours...</span>
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
            <p className="text-xs text-green-400 text-center mt-2">✓ Fichier uploadé</p>
            <p className="text-xs text-zinc-500 text-center truncate max-w-full px-2">{value.split('/').pop()}</p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-zinc-700/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <span className="text-sm text-zinc-400">Glisser-déposer ou cliquer</span>
            <span className="text-xs text-zinc-500">{accept.replace(/,/g, ', ')}</span>
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
        <span className="text-xs text-zinc-500">ou URL :</span>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-zinc-800 border-zinc-700 text-white text-xs h-8 flex-1"
          placeholder="https://..."
        />
        {value && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange('')}
            className="h-8 px-2 text-red-400 hover:text-red-300"
          >
            ✕
          </Button>
        )}
      </div>
    </div>
  )
}

export default function AdminActorsPage() {
  const [actors, setActors] = useState<Actor[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Actor | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingField, setUploadingField] = useState<string | null>(null)
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
    const { data, error } = await supabase
      .from('actors')
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
      const { error } = await supabase
        .from('actors')
        .insert({ ...actorData, user_id: user?.id })

      if (error) {
        alert('Erreur: ' + error.message)
      } else {
        await loadActors()
        cancelEdit()
      }
    } else if (editing) {
      const { error } = await supabase
        .from('actors')
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

    const { error } = await supabase
      .from('actors')
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestion des Acteurs</h1>
          <p className="text-zinc-400 mt-1">Ajouter et modifier les acteurs IA</p>
        </div>
        {!isNew && !editing && (
          <Button onClick={startNew} className="bg-violet-600 hover:bg-violet-500">
            + Nouvel acteur
          </Button>
        )}
      </div>

      {/* Edit/New Form */}
      {(isNew || editing) && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">
              {isNew ? 'Nouvel acteur' : `Modifier ${editing?.name}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Nom</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="Luna"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Genre</Label>
                  <Select
                    value={form.gender}
                    onValueChange={(v) => setForm(prev => ({ ...prev, gender: v as typeof form.gender }))}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Femme</SelectItem>
                      <SelectItem value="male">Homme</SelectItem>
                      <SelectItem value="non-binary">Non-binaire</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Tranche d'âge</Label>
                  <Input
                    value={form.age_range}
                    onChange={(e) => setForm(prev => ({ ...prev, age_range: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="25-30"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Ethnicité</Label>
                  <Input
                    value={form.ethnicity}
                    onChange={(e) => setForm(prev => ({ ...prev, ethnicity: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="European"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Cheveux</Label>
                  <Input
                    value={form.hair}
                    onChange={(e) => setForm(prev => ({ ...prev, hair: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="long brown wavy"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Traits distinctifs</Label>
                  <Textarea
                    value={form.distinctive_features}
                    onChange={(e) => setForm(prev => ({ ...prev, distinctive_features: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white"
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

                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Style de voix</Label>
                  <Input
                    value={form.voice_style}
                    onChange={(e) => setForm(prev => ({ ...prev, voice_style: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="warm, friendly, energetic..."
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
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

      {/* Actors List */}
      {loading ? (
        <div className="text-center py-12 text-zinc-400">Chargement...</div>
      ) : actors.length === 0 ? (
        <Card className="bg-zinc-900/50 border-zinc-800 border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-zinc-400 mb-4">Aucun acteur dans la base de données</p>
            <Button onClick={startNew} className="bg-violet-600 hover:bg-violet-500">
              Créer le premier acteur
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {actors.map((actor) => (
            <Card key={actor.id} className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Preview */}
                  <div className="w-24 h-32 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
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
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        No image
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{actor.name}</h3>
                    <p className="text-sm text-zinc-400">
                      {actor.appearance.gender === 'female' ? 'Femme' : actor.appearance.gender === 'male' ? 'Homme' : 'NB'}
                      {' • '}{actor.appearance.age_range}
                    </p>
                    <p className="text-xs text-zinc-500 truncate mt-1">
                      {actor.appearance.hair}
                    </p>
                    <div className="flex gap-2 mt-3">
                      {actor.is_custom && <Badge className="bg-fuchsia-600">Custom</Badge>}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(actor)}
                        className="text-xs"
                      >
                        Éditer
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(actor)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

