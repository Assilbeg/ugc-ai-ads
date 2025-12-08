'use client'

import { useState, useEffect, useCallback } from 'react'
import { GenerationType } from '@/lib/credits'

interface CreditsInfo {
  balance: number
  subscription: {
    tier: string
    status: string
    currentPeriodEnd: string | null
  }
  earlyBird: {
    eligible: boolean
    used: boolean
    deadline: string | null
    timeRemaining: number
  }
  costs: Record<GenerationType, number>
  remaining: {
    firstFrames: number
    videos: number
    fullCampaigns: number
  }
}

interface CreditsCheckResult {
  hasEnough: boolean
  currentBalance: number
  requiredAmount: number
  missingAmount: number
  isEarlyBirdEligible: boolean
  earlyBirdUsed: boolean
}

export function useCredits() {
  const [credits, setCredits] = useState<CreditsInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCredits = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch('/api/credits')
      
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des crédits')
      }
      
      const data = await response.json()
      setCredits(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const checkCredits = useCallback(async (
    generationType: GenerationType
  ): Promise<CreditsCheckResult | null> => {
    try {
      const response = await fetch('/api/credits/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationType }),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la vérification des crédits')
      }

      return response.json()
    } catch (err) {
      console.error('Error checking credits:', err)
      return null
    }
  }, [])

  const checkMultipleCredits = useCallback(async (
    generations: { type: GenerationType; count: number }[]
  ): Promise<CreditsCheckResult | null> => {
    try {
      const response = await fetch('/api/credits/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generations }),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la vérification des crédits')
      }

      return response.json()
    } catch (err) {
      console.error('Error checking credits:', err)
      return null
    }
  }, [])

  useEffect(() => {
    fetchCredits()
  }, [fetchCredits])

  return {
    credits,
    isLoading,
    error,
    refetch: fetchCredits,
    checkCredits,
    checkMultipleCredits,
  }
}

// Hook for managing the upgrade modal
export function useUpgradeModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [requiredCredits, setRequiredCredits] = useState(0)
  const [currentBalance, setCurrentBalance] = useState(0)

  const openModal = useCallback((required: number = 0, balance: number = 0) => {
    setRequiredCredits(required)
    setCurrentBalance(balance)
    setIsOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsOpen(false)
    setRequiredCredits(0)
    setCurrentBalance(0)
  }, [])

  return {
    isOpen,
    requiredCredits,
    currentBalance,
    openModal,
    closeModal,
  }
}







