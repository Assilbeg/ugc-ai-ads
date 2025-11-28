'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Actor } from '@/types'
import { PRESET_ACTORS } from '@/lib/api/higgsfield'

export function useActors() {
  const [actors, setActors] = useState<Actor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const loadActors = async () => {
    setLoading(true)
    setError(null)

    try {
      // Load custom actors from database
      const { data: customActors, error: dbError } = await supabase
        .from('actors')
        .select('*')
        .order('created_at', { ascending: false })

      if (dbError) throw dbError

      // Format preset actors to match Actor type
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const getActorById = (id: string): Actor | undefined => {
    return actors.find(a => a.id === id)
  }

  useEffect(() => {
    loadActors()
  }, [])

  return {
    actors,
    loading,
    error,
    reload: loadActors,
    getActorById,
  }
}

