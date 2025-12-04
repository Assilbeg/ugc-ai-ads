'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Zap, 
  Clock, 
  Check, 
  Loader2,
  X,
  Sparkles,
  Video,
  Shield,
  Gift,
  ArrowRight,
  Star
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

interface FirstPurchaseModalProps {
  isOpen: boolean
  onClose: () => void
  requiredCredits?: number
  currentBalance?: number
  clipCount?: number
  onSuccess?: () => void
}

export function FirstPurchaseModal({
  isOpen,
  onClose,
  requiredCredits = 0,
  currentBalance = 0,
  clipCount = 1,
  onSuccess,
}: FirstPurchaseModalProps) {
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

  // Trouver le plan Early Bird ou le moins cher
  const earlyBirdPlan = plans.find(p => p.is_early_bird && isEarlyBirdEligible)
  const cheapestPlan = plans
    .filter(p => p.stripe_price_id && p.is_one_time)
    .sort((a, b) => a.price_cents - b.price_cents)[0]
  
  const recommendedPlan = earlyBirdPlan || cheapestPlan

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop avec gradient */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-violet-900/90 via-background/95 to-amber-900/90 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card border border-border rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        {/* Gradient top accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-muted transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8">
          {/* Hero section */}
          <div className="text-center mb-8">
            {/* Icon */}
            <div className="relative inline-flex mb-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl shadow-amber-500/30">
                <Video className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center border-4 border-card">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-2">
              🎬 Ta première vidéo t'attend !
            </h2>
            <p className="text-muted-foreground">
              Plus qu'une étape pour générer {clipCount > 1 ? `${clipCount} clips` : 'ton clip'} UGC
            </p>
          </div>

          {/* What you'll get */}
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
            <p className="font-semibold mb-3 flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-500" />
              Ce que tu vas obtenir :
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                <span>{clipCount} vidéo{clipCount > 1 ? 's' : ''} UGC générée{clipCount > 1 ? 's' : ''} par IA</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                <span>Voix clonée + ambiance sonore</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                <span>Export HD prêt pour TikTok/Reels</span>
              </li>
            </ul>
          </div>

          {/* Early Bird Timer */}
          {isEarlyBirdEligible && earlyBirdTimeRemaining > 0 && (
            <div className="mb-6 p-3 rounded-xl bg-gradient-to-r from-rose-500/20 to-amber-500/20 border border-rose-500/30 text-center">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-rose-500">
                <Clock className="w-4 h-4 animate-pulse" />
                <span>Offre Early Bird expire dans</span>
                <span className="font-mono font-bold text-lg">{formatTime(earlyBirdTimeRemaining)}</span>
              </div>
            </div>
          )}

          {/* Plan recommendation */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : recommendedPlan ? (
            <div className="mb-6">
              <div className="relative p-6 rounded-2xl border-2 border-amber-500 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
                {/* Badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-1 text-sm">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    {earlyBirdPlan ? 'Early Bird -50%' : 'Recommandé'}
                  </Badge>
                </div>

                <div className="text-center mt-2">
                  <p className="text-lg font-semibold mb-1">{recommendedPlan.name}</p>
                  <div className="flex items-baseline justify-center gap-2 mb-4">
                    <span className="text-4xl font-bold">{formatPrice(recommendedPlan.price_cents)}</span>
                    {earlyBirdPlan && (
                      <span className="text-lg text-muted-foreground line-through">
                        {formatPrice(recommendedPlan.price_cents * 2)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {formatCredits(recommendedPlan.monthly_credits)} de crédits inclus
                  </p>
                  
                  <Button
                    className="w-full h-14 rounded-xl text-lg font-semibold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/30 transition-all hover:shadow-xl hover:shadow-amber-500/40 hover:scale-[1.02]"
                    onClick={() => handleSelectPlan(recommendedPlan.id)}
                    disabled={processingPlanId !== null}
                  >
                    {processingPlanId === recommendedPlan.id ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Redirection...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5 mr-2" />
                        Générer mes vidéos
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground mb-6">
              Aucun plan disponible pour le moment
            </p>
          )}

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Shield className="w-4 h-4" />
              <span>Paiement sécurisé</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-4 h-4" />
              <span>Activation immédiate</span>
            </div>
          </div>

          {/* Other plans link */}
          {plans.length > 1 && (
            <button 
              className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
              onClick={() => {
                // TODO: Show all plans
              }}
            >
              Voir tous les plans →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}




