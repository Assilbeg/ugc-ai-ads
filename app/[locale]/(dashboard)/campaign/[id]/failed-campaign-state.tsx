'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { useCredits } from '@/hooks/use-credits'
import { FirstPurchaseModal } from '@/components/modals/first-purchase-modal'
import { UpgradeModal } from '@/components/modals/upgrade-modal'
import { 
  Zap, 
  Play,
  Clock, 
  Film,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Video,
  RefreshCw
} from 'lucide-react'

interface Clip {
  id: string
  order: number
  beat: string
  script: { text: string; word_count?: number }
  first_frame: { prompt: string; image_url?: string }
  video: { duration: number; raw_url?: string }
  status: string
}

interface FailedCampaignStateProps {
  campaignId: string
  clips: Clip[]
  presetName?: string
  totalDuration: number
  title: string
  targetDuration: number
  hasProduct: boolean
}

const BEAT_LABELS: Record<string, string> = {
  hook: 'HOOK',
  problem: 'PROBLÈME',
  agitation: 'AGITATION',
  solution: 'SOLUTION',
  proof: 'PREUVE',
  cta: 'CTA',
}

const BEAT_COLORS: Record<string, string> = {
  hook: 'bg-amber-500',
  problem: 'bg-red-500',
  agitation: 'bg-orange-500',
  solution: 'bg-emerald-500',
  proof: 'bg-blue-500',
  cta: 'bg-violet-500',
}

export function FailedCampaignState({ 
  campaignId, 
  clips, 
  presetName,
  totalDuration,
  title,
  targetDuration,
  hasProduct
}: FailedCampaignStateProps) {
  const { credits, isLoading: creditsLoading } = useCredits()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [isFirstPurchase, setIsFirstPurchase] = useState(false)

  // Déterminer si c'est un premier achat
  useEffect(() => {
    if (credits) {
      setIsFirstPurchase(credits.balance === 0)
    }
  }, [credits])

  const hasNoCredits = !creditsLoading && credits && credits.balance === 0
  const clipsWithVideo = clips.filter(c => c.video?.raw_url).length
  const clipsWithImages = clips.filter(c => c.first_frame?.image_url).length

  return (
    <div className="space-y-8">
      {/* Titre de la campagne */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-4 bg-red-50 text-red-700">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Échec
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
          {title}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          {presetName && (
            <Badge variant="secondary" className="rounded-lg">{presetName}</Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {targetDuration}s • {hasProduct ? 'Avec produit' : 'Sans produit'}
          </span>
        </div>
      </div>

      {/* Banner d'erreur principal */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500/10 via-orange-500/5 to-amber-500/10 border border-red-500/20 p-6 sm:p-8">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(239,68,68,0.1),transparent_50%)]" />
        
        <div className="relative flex flex-col sm:flex-row items-start gap-6">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shrink-0 shadow-lg shadow-red-500/30">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>

          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
              La génération a échoué
            </h2>
            <p className="text-muted-foreground mb-6 max-w-xl">
              {hasNoCredits ? (
                <>
                  Tu n'as pas assez de crédits pour générer les vidéos. 
                  <span className="text-amber-600 font-medium"> Recharge tes crédits</span> pour continuer.
                </>
              ) : (
                <>
                  Une erreur est survenue lors de la génération. 
                  Tu peux réessayer ou modifier ta campagne.
                </>
              )}
            </p>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              {hasNoCredits ? (
                <>
                  <Button 
                    size="lg"
                    className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/30"
                    onClick={() => setShowUpgradeModal(true)}
                  >
                    <Zap className="w-5 h-5 mr-2" />
                    Recharger mes crédits
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Link href={`/new/${campaignId}`}>
                    <Button variant="outline" size="lg" className="rounded-xl">
                      <Play className="w-4 h-4 mr-2" />
                      Continuer la campagne
                    </Button>
                  </Link>
                </>
              ) : (
                <Link href={`/new/${campaignId}`}>
                  <Button size="lg" className="rounded-xl">
                    <Play className="w-4 h-4 mr-2" />
                    Continuer la campagne
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Stats rapides */}
          <div className="hidden lg:flex flex-col gap-3 text-right">
            <div className="bg-background/80 backdrop-blur rounded-xl px-4 py-2 border border-border">
              <div className="text-2xl font-bold">{clips.length}</div>
              <div className="text-xs text-muted-foreground">clips prévus</div>
            </div>
            <div className="bg-background/80 backdrop-blur rounded-xl px-4 py-2 border border-border">
              <div className="text-2xl font-bold">{totalDuration}s</div>
              <div className="text-xs text-muted-foreground">durée cible</div>
            </div>
          </div>
        </div>
      </div>

      {/* Section crédits si vide */}
      {hasNoCredits && (
        <Card className="p-6 border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Première campagne ?</h3>
              <p className="text-sm text-muted-foreground">
                Profite d'une offre spéciale pour tester la plateforme
              </p>
            </div>
            <Button 
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
              onClick={() => setShowUpgradeModal(true)}
            >
              Voir les offres
            </Button>
          </div>
        </Card>
      )}

      {/* Résumé du script généré */}
      {clips.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Film className="w-5 h-5" />
              Script de ta campagne
            </h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Video className="w-4 h-4" />
                {clipsWithVideo}/{clips.length} vidéos
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {totalDuration}s
              </span>
            </div>
          </div>

          {/* Liste des clips */}
          <div className="grid gap-3">
            {clips.map((clip, index) => (
              <Card 
                key={clip.id || index}
                className="p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Thumbnail ou placeholder */}
                  <div className="w-20 h-28 rounded-lg bg-muted overflow-hidden shrink-0 relative">
                    {clip.first_frame?.image_url ? (
                      <img 
                        src={clip.first_frame.image_url}
                        alt={`Clip ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    {/* Status indicator */}
                    {clip.video?.raw_url ? (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                        <span className="text-[10px] text-white">⏳</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <Badge className={`${BEAT_COLORS[clip.beat]} text-white text-xs`}>
                        {BEAT_LABELS[clip.beat] || clip.beat}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {clip.video?.duration || 4}s
                      </span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                      "{clip.script?.text}"
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* CTA final */}
      <div className="text-center py-6 border-t border-border mt-8">
        <p className="text-muted-foreground mb-4 mt-6">
          {hasNoCredits 
            ? "Recharge tes crédits pour terminer cette campagne"
            : "Prêt à terminer ta campagne ?"}
        </p>
        {hasNoCredits ? (
          <div className="flex justify-center gap-3">
            <Button 
              size="lg"
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
              onClick={() => setShowUpgradeModal(true)}
            >
              <Zap className="w-5 h-5 mr-2" />
              Recharger mes crédits
            </Button>
            <Link href={`/new/${campaignId}`}>
              <Button size="lg" variant="outline" className="rounded-xl">
                Continuer quand même
              </Button>
            </Link>
          </div>
        ) : (
          <Link href={`/new/${campaignId}`}>
            <Button size="lg" className="rounded-xl">
              <Play className="w-4 h-4 mr-2" />
              Continuer la campagne
            </Button>
          </Link>
        )}
      </div>

      {/* Modals */}
      {isFirstPurchase ? (
        <FirstPurchaseModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          clipCount={clips.length}
          onSuccess={() => {
            setShowUpgradeModal(false)
            window.location.reload()
          }}
        />
      ) : (
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          onSuccess={() => {
            setShowUpgradeModal(false)
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}

