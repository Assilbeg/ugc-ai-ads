'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Actor } from '@/types'

export function useActors() {
  const [actors, setActors] = useState<Actor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const loadActors = async () => {
    setLoading(true)
    setError(null)

    try {
      // Load all actors from database
      const { data, error: dbError } = await (supabase
        .from('actors') as any)
        .select('*')
        .order('is_custom', { ascending: true }) // Preset actors first
        .order('name', { ascending: true })

      if (dbError) throw dbError

      setActors((data || []) as Actor[])
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

