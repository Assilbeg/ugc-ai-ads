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
}

export function SubmagicActions({
  campaignId,
  campaignTitle,
  submagicStatus = 'none',
  submagicVideoUrl,
}: SubmagicActionsProps) {
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
          size="sm" 
          variant="outline" 
          onClick={() => setShowModal(true)}
          className="gap-2 rounded-lg"
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
      <Button size="sm" variant="outline" disabled className="gap-2 rounded-lg">
        <Loader2 className="w-4 h-4 animate-spin" />
        Sous-titres en cours...
      </Button>
    )
  }

  // Terminé avec succès
  if (submagicStatus === 'completed' && submagicVideoUrl) {
    return (
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
    )
  }

  // Échec - permettre de réessayer
  if (submagicStatus === 'failed') {
    return (
      <>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={() => setShowModal(true)}
          className="gap-2 rounded-lg border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
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

