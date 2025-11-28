'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

interface SystemPrompt {
  id: string
  name: string
  description: string
  prompt: string
  updated_at: string
}

const DEFAULT_PROMPTS: SystemPrompt[] = [
  {
    id: 'claude_script',
    name: 'Claude - Génération Script',
    description: 'System prompt pour la génération du plan et des scripts avec Claude',
    prompt: `Tu es un expert en publicité UGC...`, // Sera chargé depuis Supabase
    updated_at: new Date().toISOString(),
  },
  {
    id: 'nanobanana_frame',
    name: 'NanoBanana - First Frame',
    description: 'Prompt template pour la génération des first frames avec NanoBanana Pro',
    prompt: 'UGC selfie video first frame...',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'negatives_default',
    name: 'Negatives - Défaut',
    description: 'Liste des negatives par défaut pour les prompts vidéo',
    prompt: 'subtitles, captions, readable text...',
    updated_at: new Date().toISOString(),
  },
]

export default function AdminPromptsPage() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<SystemPrompt | null>(null)
  const [saving, setSaving] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const supabase = createClient()

  // Form state
  const [form, setForm] = useState({
    id: '',
    name: '',
    description: '',
    prompt: '',
  })

  useEffect(() => {
    loadPrompts()
  }, [])

  const loadPrompts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('system_prompts')
      .select('*')
      .order('name')

    if (!error && data) {
      setPrompts(data as SystemPrompt[])
    }
    setLoading(false)
  }

  const initializePrompts = async () => {
    setInitializing(true)
    
    // Insert default prompts
    const defaultPrompts = [
      {
        id: 'claude_script',
        name: 'Claude - Génération Script',
        description: 'System prompt pour la génération du plan et des scripts avec Claude',
        prompt: `Tu es un expert en publicité UGC (TikTok / Reels / Shorts) ET un "Sora 2 / Veo 3.1 Prompt Engineer" d'élite.

TA MISSION :
Générer un plan de campagne complet au format JSON, avec des prompts vidéo optimisés pour Sora 2 / Veo 3.1.

════════════════════════════════════════
0. SÉCURITÉ / CONFORMITÉ (OBLIGATOIRE)
════════════════════════════════════════

Tu génères uniquement du contenu publicitaire sûr et conforme :
- Pas de nudité explicite, pas de contenu sexualisé
- Adultes uniquement : jamais de mineurs
- Pas de violence graphique / gore / armes / drogues
- Pas de promesses mensongères : éviter "garanti", "100% sûr"

════════════════════════════════════════
1. RÈGLES D'OR DU SCRIPT AUDIO
════════════════════════════════════════

Le Script audio doit être LITTÉRAL ET FERMÉ :
- Tu n'ajoutes aucun filler (euh, genre, quoi, tu vois)
- Tu écris exactement ce qui doit être dit

PRONONCIATION FRANÇAISE "SAFE" :
- TOUTES LETTRES : "quarante-huit heures" pas "48h"
- PAS D'ANGLICISMES : "application" pas "app"

════════════════════════════════════════
2. CONTRAINTES DE TEMPS
════════════════════════════════════════

BORNES DE MOTS :
- 4s = 12-15 mots
- 6s = 18-22 mots
- 8s = 25-30 mots
- 12s = 40-45 mots

════════════════════════════════════════
3. RÈGLES PROMPT VIDÉO
════════════════════════════════════════

- Clean Feed : pas de texte/sous-titres générés
- Style UGC : 9:16, selfie handheld, lumière naturelle
- Smartphone Realism : iPhone-like, micro-jitters, grain discret

════════════════════════════════════════
4. TEMPLATE PROMPT VIDÉO
════════════════════════════════════════

1. Scene Overview
2. UGC Authenticity keywords
3. Descriptive Scene
4. Actions + Script audio
5. NEGATIVES obligatoires à la fin

Tu retournes UNIQUEMENT du JSON valide.`,
      },
      {
        id: 'nanobanana_frame',
        name: 'NanoBanana - First Frame',
        description: 'Prompt template pour la génération des first frames. Utilisez {PROMPT} comme placeholder.',
        prompt: `UGC selfie video first frame, smartphone front camera selfie. {PROMPT}. Vertical portrait format, natural lighting, authentic casual look, person looking at camera as if starting to record a TikTok video, realistic skin texture, high quality photograph, same person as reference.`,
      },
      {
        id: 'negatives_default',
        name: 'Negatives - Défaut',
        description: 'Liste des negatives par défaut pour les prompts vidéo Veo/Sora',
        prompt: `subtitles, captions, readable text, watermark, logo, UI overlays, floating icons, unrealistic lighting, cartoonish look, low resolution, poor focus, AI distortion, extra fingers, face warping, hard cuts, loud music, audio desync, inconsistent actor appearance, sexualized content, nudity, 3d render, professional studio lighting, tripod stability`,
      },
    ]

    for (const p of defaultPrompts) {
      const { error } = await supabase
        .from('system_prompts')
        .upsert(p)
      
      if (error) {
        console.error('Error inserting prompt:', error)
      }
    }

    await loadPrompts()
    setInitializing(false)
    alert('Prompts initialisés !')
  }

  const startEdit = (prompt: SystemPrompt) => {
    setForm({
      id: prompt.id,
      name: prompt.name,
      description: prompt.description,
      prompt: prompt.prompt,
    })
    setEditing(prompt)
  }

  const cancelEdit = () => {
    setEditing(null)
    setForm({ id: '', name: '', description: '', prompt: '' })
  }

  const handleSave = async () => {
    setSaving(true)

    const { error } = await supabase
      .from('system_prompts')
      .update({
        name: form.name,
        description: form.description,
        prompt: form.prompt,
      })
      .eq('id', form.id)

    if (error) {
      alert('Erreur: ' + error.message)
    } else {
      await loadPrompts()
      cancelEdit()
    }

    setSaving(false)
  }

  const countWords = (text: string) => {
    return text.split(/\s+/).filter(Boolean).length
  }

  const countLines = (text: string) => {
    return text.split('\n').length
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestion des Prompts</h1>
          <p className="text-zinc-400 mt-1">Éditer les prompts système (Claude, NanoBanana, etc.)</p>
        </div>
        {prompts.length === 0 && (
          <Button 
            onClick={initializePrompts}
            disabled={initializing}
            className="bg-orange-600 hover:bg-orange-500"
          >
            {initializing ? 'Initialisation...' : '📥 Initialiser les prompts'}
          </Button>
        )}
      </div>

      {/* Warning */}
      <Card className="bg-amber-900/20 border-amber-700">
        <CardContent className="p-4">
          <p className="text-amber-400 text-sm">
            ⚠️ <strong>Attention :</strong> Modifier ces prompts affecte directement la qualité des scripts et vidéos générés. 
            Testez toujours après modification.
          </p>
        </CardContent>
      </Card>

      {/* Edit Form */}
      {editing && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Modifier : {editing.name}</CardTitle>
            <CardDescription>{editing.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Nom</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">ID (non modifiable)</Label>
                <Input
                  value={form.id}
                  disabled
                  className="bg-zinc-800 border-zinc-700 text-zinc-500"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-zinc-300">Prompt</Label>
                <span className="text-xs text-zinc-500">
                  {countWords(form.prompt)} mots • {countLines(form.prompt)} lignes
                </span>
              </div>
              <Textarea
                value={form.prompt}
                onChange={(e) => setForm(prev => ({ ...prev, prompt: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm min-h-[400px]"
              />
            </div>
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

      {/* Prompts List */}
      {loading ? (
        <div className="text-center py-12 text-zinc-400">Chargement...</div>
      ) : prompts.length === 0 ? (
        <Card className="bg-zinc-900/50 border-zinc-800 border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-zinc-400 mb-4">
              La table system_prompts n'existe pas encore ou est vide.
            </p>
            <p className="text-zinc-500 text-sm mb-4">
              Exécutez d'abord le SQL dans <code className="bg-zinc-800 px-1 rounded">supabase/system_prompts.sql</code>
            </p>
            <Button 
              onClick={initializePrompts}
              disabled={initializing}
              className="bg-orange-600 hover:bg-orange-500"
            >
              {initializing ? 'Initialisation...' : 'Initialiser les prompts'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {prompts.map((prompt) => (
            <Card key={prompt.id} className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      {prompt.name}
                      <Badge variant="secondary" className="bg-zinc-800 text-xs">
                        {prompt.id}
                      </Badge>
                    </CardTitle>
                    <CardDescription>{prompt.description}</CardDescription>
                  </div>
                  <Button
                    onClick={() => startEdit(prompt)}
                    variant="outline"
                    size="sm"
                  >
                    Éditer
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-zinc-800 rounded-lg p-4 max-h-[200px] overflow-y-auto">
                  <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono">
                    {prompt.prompt.slice(0, 500)}
                    {prompt.prompt.length > 500 && '...'}
                  </pre>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                  <span>{countWords(prompt.prompt)} mots</span>
                  <span>•</span>
                  <span>{countLines(prompt.prompt)} lignes</span>
                  <span>•</span>
                  <span>Modifié : {new Date(prompt.updated_at).toLocaleDateString('fr-FR')}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

