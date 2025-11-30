'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'

interface AssemblingAnimationProps {
  campaignId: string
  title: string
  clipCount: number
  presetName?: string
}

const MESSAGES = [
  "Assemblage des clips en cours...",
  "Fusion des pistes vidéo...",
  "Application des transitions...",
  "Optimisation de la qualité...",
  "Finalisation de la vidéo...",
]

export function AssemblingAnimation({ campaignId, title, clipCount, presetName }: AssemblingAnimationProps) {
  const router = useRouter()
  const supabase = createClient()
  const [messageIndex, setMessageIndex] = useState(0)
  const [dots, setDots] = useState('')

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
      
      const { data: campaign, error } = await (supabase
        .from('campaigns') as any)
        .select('status, final_video_url')
        .eq('id', campaignId)
        .single()

      console.log('[Assembling] Poll status:', campaign?.status, 'url:', campaign?.final_video_url?.slice(0, 50))
      
      if (error) {
        console.error('[Assembling] Poll error:', error)
        return
      }

      if (campaign && campaign.status !== 'assembling') {
        // Assemblage terminé ! Rediriger sans le query param pour afficher la vidéo
        console.log('[Assembling] Done! Redirecting to clean URL...')
        isPolling = false
        // Utiliser replace pour ne pas ajouter à l'historique
        window.location.replace(`/campaign/${campaignId}`)
      }
    }

    // Vérifier toutes les 2 secondes
    const interval = setInterval(checkStatus, 2000)
    
    // Vérifier immédiatement aussi
    checkStatus()

    return () => {
      isPolling = false
      clearInterval(interval)
    }
  }, [campaignId, router, supabase])

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
          Ça ne devrait prendre que quelques secondes...
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

