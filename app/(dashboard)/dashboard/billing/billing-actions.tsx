'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard, Settings, Sparkles } from 'lucide-react'
import { UpgradeModal } from '@/components/modals/upgrade-modal'

interface BillingActionsProps {
  hasStripeCustomer: boolean
  showEarlyBird: boolean
}

export function BillingActions({ hasStripeCustomer, showEarlyBird }: BillingActionsProps) {
  const [isLoadingPortal, setIsLoadingPortal] = useState(false)
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true)
    
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.error) {
        alert(data.error)
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Error opening portal:', error)
      alert('Erreur lors de l\'ouverture du portail')
    } finally {
      setIsLoadingPortal(false)
    }
  }

  if (showEarlyBird) {
    return (
      <>
        <Button
          onClick={() => setIsUpgradeModalOpen(true)}
          className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Profiter de l'offre
        </Button>
        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
        />
      </>
    )
  }

  return (
    <>
      <Button
        onClick={() => setIsUpgradeModalOpen(true)}
        className="h-11 rounded-xl"
      >
        <CreditCard className="w-4 h-4 mr-2" />
        Recharger des crédits
      </Button>
      
      {hasStripeCustomer && (
        <Button
          variant="outline"
          onClick={handleManageSubscription}
          disabled={isLoadingPortal}
          className="h-11 rounded-xl"
        >
          {isLoadingPortal ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Settings className="w-4 h-4 mr-2" />
          )}
          Gérer l'abonnement
        </Button>
      )}

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </>
  )
}

