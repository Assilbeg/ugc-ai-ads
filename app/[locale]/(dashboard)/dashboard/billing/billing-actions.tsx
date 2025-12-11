'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, CreditCard, Settings, Sparkles, Shield } from 'lucide-react'
import { UpgradeModal } from '@/components/modals/upgrade-modal'

interface BillingActionsProps {
  hasStripeCustomer: boolean
  showEarlyBird: boolean
  isAdmin?: boolean
}

export function BillingActions({ hasStripeCustomer, showEarlyBird, isAdmin = false }: BillingActionsProps) {
  const [isLoadingPortal, setIsLoadingPortal] = useState(false)
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [isLoadingCustom, setIsLoadingCustom] = useState(false)

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

  const handleCustomPayment = async () => {
    const amount = parseFloat(customAmount)
    if (isNaN(amount) || amount < 1) {
      alert('Montant minimum: 1€')
      return
    }

    setIsLoadingCustom(true)
    
    try {
      const response = await fetch('/api/stripe/custom-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(amount * 100) }), // Convert to cents
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
      console.error('Error creating custom checkout:', error)
      alert('Erreur lors de la création du paiement')
    } finally {
      setIsLoadingCustom(false)
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

      {/* Admin custom payment */}
      {isAdmin && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <Shield className="w-5 h-5 text-violet-500" />
          <Input
            type="number"
            placeholder="Montant €"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="w-24 h-9"
            min="1"
            step="0.01"
          />
          <Button
            onClick={handleCustomPayment}
            disabled={isLoadingCustom}
            size="sm"
            className="bg-violet-500 hover:bg-violet-600"
          >
            {isLoadingCustom ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Payer'
            )}
          </Button>
        </div>
      )}

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </>
  )
}

