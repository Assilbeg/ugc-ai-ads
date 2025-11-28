'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Actor } from '@/types'
import { PRESET_ACTORS } from '@/lib/api/higgsfield'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface Step1ActorProps {
  selectedActorId?: string
  onSelect: (actorId: string) => void
  onNext: () => void
}

export function Step1Actor({ selectedActorId, onSelect, onNext }: Step1ActorProps) {
  const [actors, setActors] = useState<Actor[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadActors()
  }, [])

  const loadActors = async () => {
    setLoading(true)
    
    // Load custom actors from database
    const { data: customActors } = await supabase
      .from('actors')
      .select('*')
      .order('created_at', { ascending: false })

    // Combine preset actors with custom actors
    const presetActorsFormatted: Actor[] = PRESET_ACTORS.map(pa => ({
      id: pa.id,
      user_id: 'system',
      name: pa.name,
      thumbnail_video_url: pa.thumbnail_video_url,
      soul_image_url: pa.soul_image_url,
      voice: {
        reference_audio_url: pa.voice_reference_url,
        voice_style: 'natural',
      },
      appearance: pa.appearance,
      is_custom: false,
      created_at: new Date().toISOString(),
    }))

    setActors([...presetActorsFormatted, ...(customActors || [])])
    setLoading(false)
  }

  const handleContinue = () => {
    if (selectedActorId) {
      onNext()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Choisis ton créateur</h2>
        <p className="text-zinc-400 mt-2">
          Sélectionne un acteur IA pour ta publicité UGC
        </p>
      </div>

      {/* Actors grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[3/4] bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {actors.map((actor) => (
            <Card
              key={actor.id}
              className={`
                cursor-pointer transition-all duration-200 overflow-hidden
                ${selectedActorId === actor.id
                  ? 'ring-2 ring-violet-500 bg-violet-500/10 border-violet-500'
                  : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                }
              `}
              onClick={() => onSelect(actor.id)}
            >
              <CardContent className="p-0">
                {/* Video/Image preview */}
                <div className="aspect-[3/4] relative bg-zinc-800 overflow-hidden">
                  {actor.thumbnail_video_url ? (
                    <video
                      src={actor.thumbnail_video_url}
                      className="w-full h-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={actor.soul_image_url || '/placeholder-actor.jpg'}
                      alt={actor.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  
                  {/* Selection indicator */}
                  {selectedActorId === actor.id && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-violet-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  {/* Custom badge */}
                  {actor.is_custom && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-fuchsia-600 rounded text-xs text-white">
                      Custom
                    </div>
                  )}
                </div>

                {/* Actor info */}
                <div className="p-3">
                  <h3 className="font-medium text-white">{actor.name}</h3>
                  <p className="text-xs text-zinc-500">
                    {actor.appearance.gender === 'female' ? 'Femme' : actor.appearance.gender === 'male' ? 'Homme' : 'Non-binaire'}
                    {' • '}{actor.appearance.age_range}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Create new actor card */}
          <Card
            className="cursor-pointer transition-all duration-200 bg-zinc-900/30 border-zinc-800 border-dashed hover:border-violet-500/50 hover:bg-violet-500/5"
            onClick={() => {/* TODO: Open create actor modal */}}
          >
            <CardContent className="p-0">
              <div className="aspect-[3/4] flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-sm text-zinc-400">Créer un acteur</span>
                <span className="text-xs text-zinc-600">avec SOUL AI</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Continue button */}
      <div className="flex justify-end">
        <Button
          onClick={handleContinue}
          disabled={!selectedActorId}
          className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50"
        >
          Continuer
        </Button>
      </div>
    </div>
  )
}

