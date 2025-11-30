'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Actor } from '@/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowRight, Check, Plus, User } from 'lucide-react'

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
    
    // Load all actors from database
    const { data, error } = await (supabase
      .from('actors') as any)
      .select('*')
      .order('is_custom', { ascending: true }) // Preset actors first, then custom
      .order('name', { ascending: true })

    if (error) {
      console.error('Error loading actors:', error)
    }

    setActors((data || []) as Actor[])
    setLoading(false)
  }

  const handleContinue = () => {
    if (selectedActorId) {
      onNext()
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-2xl font-semibold tracking-tight">Choisis ton créateur</h2>
        <p className="text-muted-foreground mt-2">
          Sélectionne un acteur IA pour ta publicité UGC
        </p>
      </div>

      {/* Actors grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[9/16] bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {actors.map((actor) => (
            <Card
              key={actor.id}
              className={`
                cursor-pointer transition-all duration-200 overflow-hidden rounded-2xl
                p-0 gap-0 border-0 aspect-[9/16]
                ${selectedActorId === actor.id
                  ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background shadow-lg'
                  : 'hover:shadow-md'
                }
              `}
              onClick={() => onSelect(actor.id)}
            >
              {/* Video/Image preview */}
              <div className="relative w-full h-full bg-muted">
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
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-12 h-12 text-muted-foreground/40" />
                  </div>
                )}
                
                {/* Selection indicator */}
                {selectedActorId === actor.id && (
                  <div className="absolute top-3 right-3 w-7 h-7 bg-foreground rounded-full flex items-center justify-center shadow-lg">
                    <Check className="w-4 h-4 text-background" />
                  </div>
                )}

                {/* Custom badge */}
                {actor.is_custom && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-foreground rounded-full text-xs text-background font-medium">
                    Custom
                  </div>
                )}
                
                {/* Actor info overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-10">
                  <h3 className="font-medium text-white">{actor.name}</h3>
                  <p className="text-xs text-white/70 mt-0.5">
                    {actor.appearance.gender === 'female' ? 'Femme' : actor.appearance.gender === 'male' ? 'Homme' : 'Non-binaire'}
                    {' • '}{actor.appearance.age_range}
                  </p>
                </div>
              </div>
            </Card>
          ))}

          {/* Create new actor card */}
          <Card
            className="cursor-pointer transition-all duration-200 border-2 border-dashed hover:border-foreground/30 hover:bg-muted/50 rounded-2xl p-0 gap-0 aspect-[9/16]"
            onClick={() => {/* TODO: Open create actor modal */}}
          >
            <div className="w-full h-full flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Plus className="w-6 h-6 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">Créer un acteur</span>
              <span className="text-xs text-muted-foreground mt-1">avec SOUL AI</span>
            </div>
          </Card>
        </div>
      )}

      {/* Continue button */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleContinue}
          disabled={!selectedActorId}
          className="h-11 px-6 rounded-xl font-medium group"
        >
          Continuer
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  )
}
