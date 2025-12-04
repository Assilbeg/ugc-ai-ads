'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Zap, 
  Clock, 
  CreditCard, 
  Check, 
  Loader2,
  X,
  Sparkles,
  TrendingUp
} from 'lucide-react'

interface Plan {
  id: string
  name: string
  description: string | null
  price_cents: number
  monthly_credits: number
  stripe_price_id: string | null
  is_early_bird: boolean
  is_one_time: boolean
  features: string[]
}

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  requiredCredits?: number
  currentBalance?: number
  onSuccess?: () => void
}

export function UpgradeModal({
  isOpen,
  onClose,
  requiredCredits = 0,
  currentBalance = 0,
  onSuccess,
}: UpgradeModalProps) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEarlyBirdEligible, setIsEarlyBirdEligible] = useState(false)
  const [earlyBirdTimeRemaining, setEarlyBirdTimeRemaining] = useState(0)
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null)

  // Fetch plans
  useEffect(() => {
    if (isOpen) {
      fetchPlans()
      fetchCreditsInfo()
    }
  }, [isOpen])

  // Update Early Bird countdown
  useEffect(() => {
    if (earlyBirdTimeRemaining <= 0) return

    const interval = setInterval(() => {
      setEarlyBirdTimeRemaining(prev => Math.max(0, prev - 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [earlyBirdTimeRemaining])

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/plans')
      const data = await response.json()
      setPlans(data.plans || [])
      setIsEarlyBirdEligible(data.isEarlyBirdEligible)
    } catch (error) {
      console.error('Error fetching plans:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCreditsInfo = async () => {
    try {
      const response = await fetch('/api/credits')
      const data = await response.json()
      if (data.earlyBird?.timeRemaining) {
        setEarlyBirdTimeRemaining(data.earlyBird.timeRemaining)
      }
    } catch (error) {
      console.error('Error fetching credits info:', error)
    }
  }

  const handleSelectPlan = async (planId: string) => {
    setProcessingPlanId(planId)
    
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
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
      console.error('Error creating checkout session:', error)
      alert('Erreur lors de la création de la session de paiement')
    } finally {
      setProcessingPlanId(null)
    }
  }

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((ms % (1000 * 60)) / 1000)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m ${seconds}s`
  }

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100)
  }

  const formatCredits = (cents: number) => {
    return formatPrice(cents)
  }

  // Bloquer le scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Fermer avec Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const missingCredits = Math.max(0, requiredCredits - currentBalance)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-muted transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Rechargez vos crédits</h2>
              <p className="text-muted-foreground">
                Choisissez un plan pour continuer vos générations
              </p>
            </div>
          </div>

          {/* Credits info */}
          {requiredCredits > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Solde actuel</p>
                  <p className="text-lg font-semibold">{formatCredits(currentBalance)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Requis pour cette génération</p>
                  <p className="text-lg font-semibold text-amber-500">{formatCredits(requiredCredits)}</p>
                </div>
              </div>
              {missingCredits > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Il vous manque </span>
                    <span className="font-semibold text-destructive">{formatCredits(missingCredits)}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Early Bird Banner */}
          {isEarlyBirdEligible && earlyBirdTimeRemaining > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-500">Offre Early Bird disponible !</p>
                  <p className="text-sm text-muted-foreground">
                    Prix réduit pour votre première campagne
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="font-mono font-semibold text-amber-500">
                    {formatTime(earlyBirdTimeRemaining)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Plans Grid */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`relative overflow-hidden transition-all hover:shadow-lg ${
                    plan.is_early_bird 
                      ? 'border-2 border-amber-500 ring-2 ring-amber-500/20' 
                      : plan.id === 'pro' 
                        ? 'border-2 border-primary' 
                        : ''
                  }`}
                >
                  {/* Popular badge */}
                  {plan.id === 'pro' && !plan.is_early_bird && (
                    <div className="absolute top-0 right-0">
                      <Badge className="rounded-none rounded-bl-lg bg-primary">
                        Populaire
                      </Badge>
                    </div>
                  )}
                  
                  {/* Early Bird badge */}
                  {plan.is_early_bird && (
                    <div className="absolute top-0 right-0">
                      <Badge className="rounded-none rounded-bl-lg bg-gradient-to-r from-amber-500 to-orange-600">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Early Bird
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Price */}
                    <div>
                      <span className="text-3xl font-bold">
                        {formatPrice(plan.price_cents)}
                      </span>
                      {!plan.is_one_time && (
                        <span className="text-muted-foreground">/mois</span>
                      )}
                    </div>

                    {/* Credits */}
                    <div className="flex items-center gap-2 text-sm">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <span>
                        <span className="font-semibold">{formatCredits(plan.monthly_credits)}</span>
                        <span className="text-muted-foreground"> de crédits</span>
                      </span>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2">
                      {(plan.features || []).map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA Button */}
                    <Button
                      className={`w-full h-11 rounded-xl ${
                        plan.is_early_bird 
                          ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700' 
                          : ''
                      }`}
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={processingPlanId !== null || !plan.stripe_price_id}
                    >
                      {processingPlanId === plan.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Redirection...
                        </>
                      ) : !plan.stripe_price_id ? (
                        'Non disponible'
                      ) : plan.is_one_time ? (
                        'Acheter'
                      ) : (
                        'S\'abonner'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Help text */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Paiement sécurisé par Stripe. Annulez à tout moment.
          </p>
        </div>
      </div>
    </div>
  )
}




