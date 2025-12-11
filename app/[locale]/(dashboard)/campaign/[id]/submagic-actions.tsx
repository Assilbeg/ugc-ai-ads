'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { SubmagicModal } from '@/components/modals/submagic-modal'
import { Subtitles, Loader2 } from 'lucide-react'
import type { SubmagicStatus } from '@/types'

interface SubmagicActionsProps {
  campaignId: string
  campaignTitle: string
  submagicStatus?: SubmagicStatus
  submagicVideoUrl?: string
}

/**
 * Composant pour le bouton "Modifier les sous-titres"
 * Affiche différents états selon le statut : ajouter, en cours, modifier
 */
export function SubmagicActions({
  campaignId,
  campaignTitle,
  submagicStatus = 'none',
}: SubmagicActionsProps) {
  const [showModal, setShowModal] = useState(false)
  const [credits, setCredits] = useState(0)

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

    const interval = setInterval(() => {
      window.location.reload()
    }, 30000) // Toutes les 30 secondes

    return () => clearInterval(interval)
  }, [submagicStatus])

  // En cours de traitement
  if (submagicStatus === 'processing') {
    return (
      <Button 
        variant="outline" 
        disabled 
        className="w-full rounded-xl h-11 gap-2"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Sous-titres en cours...
      </Button>
    )
  }

  // Déterminer le label du bouton selon l'état
  const hasSubtitles = submagicStatus === 'completed'
  const hasFailed = submagicStatus === 'failed'
  
  let buttonLabel = '🔤 Ajouter sous-titres'
  if (hasSubtitles) buttonLabel = '🔤 Modifier sous-titres'
  if (hasFailed) buttonLabel = '🔤 Réessayer sous-titres'

  return (
    <>
      <Button 
        variant="outline"
        onClick={() => setShowModal(true)}
        className={`w-full rounded-xl h-11 gap-2 ${
          hasFailed 
            ? 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950'
            : ''
        }`}
      >
        {buttonLabel}
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

