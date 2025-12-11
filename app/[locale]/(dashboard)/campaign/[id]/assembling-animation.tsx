'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface AssemblingAnimationProps {
  campaignId: string
  title: string
  clipCount: number
  presetName?: string
}

const MESSAGES = [
  "Assemblage des clips en cours...",
  "Upload vers Cloudinary...",
  "Application des ajustements trim/vitesse...",
  "Fusion des pistes vidéo...",
  "Optimisation de la qualité...",
  "Finalisation de la vidéo...",
]

export function AssemblingAnimation({ campaignId, title, clipCount, presetName }: AssemblingAnimationProps) {
  const supabase = createClient()
  const [messageIndex, setMessageIndex] = useState(0)
  const [dots, setDots] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pollCountRef = useRef(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Rotation des messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Animation des points
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Polling pour vérifier si l'assemblage est terminé
  useEffect(() => {
    let isPolling = true
    
    const checkStatus = async () => {
      if (!isPolling) return
      
      pollCountRef.current += 1
      const currentPoll = pollCountRef.current
      
      const { data: campaign, error: fetchError } = await (supabase
        .from('campaigns') as any)
        .select('status, final_video_url')
        .eq('id', campaignId)
        .single()

      console.log('[Assembling] Poll #', currentPoll, 'status:', campaign?.status, 'url:', campaign?.final_video_url?.slice(0, 50))
      
      if (fetchError) {
        console.error('[Assembling] Poll error:', fetchError)
        return
      }

      // Si le status est "completed" ET on a une URL vidéo, c'est bon !
      if (campaign?.status === 'completed' && campaign?.final_video_url) {
        console.log('[Assembling] Done! Redirecting to clean URL...')
        isPolling = false
        if (intervalRef.current) clearInterval(intervalRef.current)
        window.location.replace(`/campaign/${campaignId}`)
        return
      }
      
      // Si le status est "failed", afficher l'erreur
      if (campaign?.status === 'failed') {
        console.error('[Assembling] Assembly failed!')
        isPolling = false
        if (intervalRef.current) clearInterval(intervalRef.current)
        setError('L\'assemblage a échoué. Veuillez réessayer.')
        return
      }
      
      // Si on poll depuis plus de 2 minutes (60 polls * 2s), timeout
      if (currentPoll > 60) {
        console.error('[Assembling] Timeout!')
        isPolling = false
        if (intervalRef.current) clearInterval(intervalRef.current)
        setError('L\'assemblage prend trop de temps. Veuillez réessayer.')
        return
      }
    }

    // Attendre 2 secondes avant le premier poll (laisser le temps à l'API de démarrer)
    const initialDelay = setTimeout(() => {
      checkStatus()
      // Puis vérifier toutes les 2 secondes
      intervalRef.current = setInterval(checkStatus, 2000)
    }, 2000)

    return () => {
      isPolling = false
      clearTimeout(initialDelay)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [campaignId, supabase])

  // Affichage erreur
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Échec de l'assemblage
        </h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          {error}
        </p>
        <div className="flex gap-3">
          <Link href={`/new/${campaignId}`}>
            <Button variant="outline" className="rounded-xl">
              ← Retourner à l'édition
            </Button>
          </Link>
          <Button 
            onClick={() => window.location.reload()}
            className="rounded-xl"
          >
            🔄 Réessayer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      {/* Animation principale */}
      <div className="relative mb-8">
        {/* Cercles animés */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full border-4 border-violet-200 animate-ping opacity-20" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full border-4 border-violet-300 animate-pulse" />
        </div>
        
        {/* Icône centrale */}
        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl shadow-violet-500/30">
          <svg 
            className="w-14 h-14 text-white animate-pulse" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" 
            />
          </svg>
        </div>
      </div>

      {/* Titre */}
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
        🎬 Assemblage en cours
      </h1>
      
      {/* Message rotatif */}
      <p className="text-lg text-muted-foreground mb-6 h-7">
        {MESSAGES[messageIndex]}{dots}
      </p>

      {/* Infos campagne */}
      <div className="bg-muted/50 rounded-2xl p-6 max-w-md w-full mb-6">
        <h2 className="font-medium text-foreground mb-3 truncate">
          {title}
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {presetName && (
            <Badge variant="secondary" className="rounded-lg">
              🎬 {presetName}
            </Badge>
          )}
          <Badge variant="outline" className="rounded-lg">
            📹 {clipCount} clips
          </Badge>
        </div>
      </div>

      {/* Barre de progression simulée */}
      <div className="w-full max-w-md">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full animate-progress"
            style={{
              animation: 'progress 2s ease-in-out infinite',
            }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          Ça peut prendre jusqu'à 30 secondes...
        </p>
      </div>

      {/* Style pour l'animation de progression */}
      <style jsx>{`
        @keyframes progress {
          0% {
            width: 0%;
            margin-left: 0%;
          }
          50% {
            width: 60%;
            margin-left: 20%;
          }
          100% {
            width: 0%;
            margin-left: 100%;
          }
        }
      `}</style>
    </div>
  )
}

