'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { SubmagicModal } from '@/components/modals/submagic-modal'
import { Subtitles, Loader2, Download, RefreshCw } from 'lucide-react'
import type { SubmagicStatus } from '@/types'

interface SubmagicActionsProps {
  campaignId: string
  campaignTitle: string
  submagicStatus?: SubmagicStatus
  submagicVideoUrl?: string
  variant?: 'small' | 'large'
}

export function SubmagicActions({
  campaignId,
  campaignTitle,
  submagicStatus = 'none',
  submagicVideoUrl,
  variant = 'small',
}: SubmagicActionsProps) {
  const isLarge = variant === 'large'
  const [showModal, setShowModal] = useState(false)
  const [credits, setCredits] = useState(0)
  const [isPolling, setIsPolling] = useState(false)

  // Fetch credits on mount
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const res = await fetch('/api/credits')
        const data = await res.json()
        setCredits(data.balance || 0)
      } catch (error) {
        console.error('Error fetching credits:', error)
      }
    }
    fetchCredits()
  }, [])

  // Poll for status when processing
  useEffect(() => {
    if (submagicStatus !== 'processing') return

    setIsPolling(true)
    const interval = setInterval(() => {
      // Rafraîchir la page pour obtenir le nouveau statut
      window.location.reload()
    }, 30000) // Toutes les 30 secondes

    return () => {
      clearInterval(interval)
      setIsPolling(false)
    }
  }, [submagicStatus])

  // Pas encore de sous-titres
  if (submagicStatus === 'none' || !submagicStatus) {
    return (
      <>
        <Button 
          size={isLarge ? 'default' : 'sm'}
          variant={isLarge ? 'default' : 'outline'}
          onClick={() => setShowModal(true)}
          className={isLarge 
            ? "w-full rounded-xl h-11 gap-2 bg-violet-600 hover:bg-violet-700 text-white" 
            : "gap-2 rounded-lg"
          }
        >
          <Subtitles className="w-4 h-4" />
          Sous-titres
        </Button>

        <SubmagicModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          campaignId={campaignId}
          campaignTitle={campaignTitle}
          currentBalance={credits}
        />
      </>
    )
  }

  // En cours de traitement
  if (submagicStatus === 'processing') {
    return (
      <Button 
        size={isLarge ? 'default' : 'sm'} 
        variant={isLarge ? 'default' : 'outline'} 
        disabled 
        className={isLarge 
          ? "w-full rounded-xl h-11 gap-2 bg-violet-600/50 text-white" 
          : "gap-2 rounded-lg"
        }
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Sous-titres en cours...
      </Button>
    )
  }

  // Terminé avec succès
  if (submagicStatus === 'completed' && submagicVideoUrl) {
    if (isLarge) {
      // Version large : bouton violet avec téléchargement + icône refresh
      return (
        <>
          <div className="flex gap-2 w-full">
            <a 
              href={submagicVideoUrl} 
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button className="w-full rounded-xl h-11 gap-2 bg-violet-600 hover:bg-violet-700 text-white">
                <Subtitles className="w-4 h-4" />
                Avec sous-titres
                <Download className="w-4 h-4" />
              </Button>
            </a>
            <Button 
              variant="outline"
              onClick={() => setShowModal(true)}
              className="rounded-xl h-11 px-4 gap-2 border-2 border-violet-300 text-violet-700 hover:bg-violet-50 hover:border-violet-400 dark:border-violet-600 dark:text-violet-300 dark:hover:bg-violet-950"
            >
              <RefreshCw className="w-4 h-4" />
              Autre style
            </Button>
          </div>

          <SubmagicModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            campaignId={campaignId}
            campaignTitle={campaignTitle}
            currentBalance={credits}
          />
        </>
      )
    }
    
    // Version small
    return (
      <>
        <a 
          href={submagicVideoUrl} 
          download
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="sm" variant="outline" className="gap-2 rounded-lg border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950">
            <Subtitles className="w-4 h-4" />
            Avec sous-titres
            <Download className="w-3 h-3" />
          </Button>
        </a>
        
        {/* Bouton pour regénérer avec d'autres paramètres */}
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={() => setShowModal(true)}
          className="gap-2 rounded-lg text-muted-foreground hover:text-foreground"
          title="Regénérer les sous-titres avec d'autres paramètres"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>

        <SubmagicModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          campaignId={campaignId}
          campaignTitle={campaignTitle}
          currentBalance={credits}
        />
      </>
    )
  }

  // Échec - permettre de réessayer
  if (submagicStatus === 'failed') {
    return (
      <>
        <Button 
          size={isLarge ? 'default' : 'sm'}
          variant="outline" 
          onClick={() => setShowModal(true)}
          className={isLarge 
            ? "w-full rounded-xl h-11 gap-2 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
            : "gap-2 rounded-lg border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
          }
        >
          <RefreshCw className="w-4 h-4" />
          Réessayer sous-titres
        </Button>

        <SubmagicModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          campaignId={campaignId}
          campaignTitle={campaignTitle}
          currentBalance={credits}
        />
      </>
    )
  }

  return null
}

