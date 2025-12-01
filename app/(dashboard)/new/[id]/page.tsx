'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NewCampaignState, ProductConfig, CampaignBrief, CampaignClip, GeneratedFirstFrames, Campaign } from '@/types'
import { StepIndicator } from '@/components/steps/step-indicator'
import { Step1Actor } from '@/components/steps/step1-actor'
import { Step2Product } from '@/components/steps/step2-product'
import { Step3Preset } from '@/components/steps/step3-preset'
import { Step4Brief } from '@/components/steps/step4-brief'
import { Step5Plan } from '@/components/steps/step5-plan'
import { Step6Generate } from '@/components/steps/step6-generate'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useActors } from '@/hooks/use-actors'
import { getPresetById } from '@/lib/presets'
import { Loader2 } from 'lucide-react'

const STEPS = [
  { number: 1, title: 'Acteur', description: 'Choisis ton créateur IA' },
  { number: 2, title: 'Produit', description: 'Avec ou sans produit' },
  { number: 3, title: 'Intention', description: 'Style de la vidéo' },
  { number: 4, title: 'Brief', description: 'Décris ton offre' },
  { number: 5, title: 'Plan', description: 'Valide le script' },
  { number: 6, title: 'Génération', description: 'Créer les vidéos' },
]

export default function ExistingCampaignPage() {
  const router = useRouter()
  const params = useParams()
  const campaignId = params.id as string
  const supabase = createClient()
  
  const { getActorById } = useActors()
  
  // État de chargement initial
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  
  const [state, setState] = useState<NewCampaignState>({
    step: 1,
    product: { has_product: false },
    brief: {},
  })
  
  // Modal de confirmation
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    targetStep: number
  }>({ isOpen: false, targetStep: 0 })
  
  // Récupérer l'acteur sélectionné
  const selectedActor = state.actor_id ? getActorById(state.actor_id) : undefined

  // ══════════════════════════════════════════════════════════════
  // CHARGER LA CAMPAGNE DEPUIS SUPABASE
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    async function loadCampaign() {
      if (!campaignId) {
        setLoadError('ID de campagne manquant')
        setLoading(false)
        return
      }

      try {
        // Charger la campagne
        const { data: campaign, error: campaignError } = await (supabase
          .from('campaigns') as any)
          .select('*')
          .eq('id', campaignId)
          .single()

        if (campaignError || !campaign) {
          console.error('Erreur chargement campagne:', campaignError)
          setLoadError('Campagne introuvable')
          setLoading(false)
          return
        }

        // Charger les clips associés
        const { data: clips, error: clipsError } = await (supabase
          .from('campaign_clips') as any)
          .select('*')
          .eq('campaign_id', campaignId)
          .order('order', { ascending: true })

        if (clipsError) {
          console.error('Erreur chargement clips:', clipsError)
        }

        // Déterminer l'étape en fonction des données présentes
        let step: 1 | 2 | 3 | 4 | 5 | 6 = 2 // Par défaut step 2 après création

        // Récupérer le preset_id (depuis la colonne OU depuis le brief si hardcoded)
        const presetId = campaign.preset_id || (campaign.brief as any)?._preset_id || undefined
        const briefData = campaign.brief || {}

        // Déterminer l'étape en fonction de ce qui est rempli
        if (!presetId) {
          // Pas de preset → step 3 (ou 2 si pas de product choice fait)
          step = 2
        } else if (!(briefData as any).what_selling) {
          // Pas de brief → step 4
          step = 4
        } else if (!clips || clips.length === 0) {
          // Pas de clips générés → step 5
          step = 5
        } else {
          // On a des clips
          const hasGeneratedVideos = clips.some((c: any) => c.video?.raw_url)
          if (hasGeneratedVideos || campaign.status === 'completed' || campaign.status === 'generating') {
            step = 6
          } else {
            step = 5
          }
        }

        // Reconstruire les first frames depuis les clips
        const generatedFirstFrames: GeneratedFirstFrames = {}
        clips?.forEach((clip: any, index: number) => {
          if (clip.first_frame?.image_url) {
            generatedFirstFrames[index] = {
              url: clip.first_frame.image_url,
              generatedAt: new Date(clip.created_at).getTime()
            }
          }
        })

        // Reconstituer le state
        setState({
          step,
          campaign_id: campaignId,
          actor_id: campaign.actor_id,
          preset_id: presetId,
          product: campaign.product || { has_product: false },
          brief: campaign.brief || {},
          generated_clips: clips as CampaignClip[] || [],
          generated_first_frames: Object.keys(generatedFirstFrames).length > 0 ? generatedFirstFrames : undefined,
        })

        console.log('✓ Campagne chargée:', campaignId, 'step:', step, 'clips:', clips?.length || 0)
        setLoading(false)
      } catch (err) {
        console.error('Erreur inattendue:', err)
        setLoadError('Erreur lors du chargement')
        setLoading(false)
      }
    }

    loadCampaign()
  }, [campaignId, supabase])

  // ══════════════════════════════════════════════════════════════
  // SAUVEGARDER LES CHANGEMENTS EN BASE
  // ══════════════════════════════════════════════════════════════
  const saveToDb = useCallback(async (updates: Partial<NewCampaignState>) => {
    if (!campaignId) return

    try {
      const campaignUpdates: Record<string, unknown> = {}
      
      if (updates.actor_id !== undefined) campaignUpdates.actor_id = updates.actor_id
      if (updates.product !== undefined) campaignUpdates.product = updates.product
      
      // Pour preset_id, on le stocke dans brief._preset_id (car FK peut échouer)
      if (updates.preset_id !== undefined) {
        // Vérifier si le preset existe en DB
        const { data: presetData } = await (supabase
          .from('intention_presets') as any)
          .select('id')
          .eq('id', updates.preset_id)
          .maybeSingle()
        
        if (presetData) {
          campaignUpdates.preset_id = updates.preset_id
        } else {
          // Stocker dans brief comme backup
          campaignUpdates.brief = { ...state.brief, _preset_id: updates.preset_id }
        }
      }
      
      if (updates.brief !== undefined) {
        // Garder le _preset_id si présent
        campaignUpdates.brief = { ...updates.brief, _preset_id: state.preset_id }
      }

      if (Object.keys(campaignUpdates).length > 0) {
        await (supabase
          .from('campaigns') as any)
          .update(campaignUpdates)
          .eq('id', campaignId)
      }
    } catch (err) {
      console.warn('Erreur sauvegarde auto:', err)
    }
  }, [campaignId, supabase, state.brief, state.preset_id])

  const updateState = useCallback((updates: Partial<NewCampaignState>) => {
    setState(prev => ({ ...prev, ...updates }))
    // Sauvegarder en arrière-plan
    saveToDb(updates)
  }, [saveToDb])
  
  // Callbacks stables
  const handleClipsGenerated = useCallback((clips: CampaignClip[]) => {
    setState(prev => ({ ...prev, generated_clips: clips }))
  }, [])
  
  const handleFirstFramesUpdate = useCallback((frames: GeneratedFirstFrames) => {
    setState(prev => ({ ...prev, generated_first_frames: frames }))
  }, [])

  const nextStep = () => {
    if (state.step < 6) {
      setState(prev => ({ ...prev, step: (prev.step + 1) as 1 | 2 | 3 | 4 | 5 | 6 }))
    }
  }

  // Vérifier si on a besoin de confirmation pour aller à une étape
  const needsConfirmation = useCallback((targetStep: number): boolean => {
    return targetStep < 5 && state.step >= 5 && !!(state.generated_clips && state.generated_clips.length > 0)
  }, [state.step, state.generated_clips])

  const confirmStepChange = useCallback(() => {
    setState(prev => ({ ...prev, step: confirmModal.targetStep as 1 | 2 | 3 | 4 | 5 | 6 }))
    setConfirmModal({ isOpen: false, targetStep: 0 })
  }, [confirmModal.targetStep])

  const cancelStepChange = useCallback(() => {
    setConfirmModal({ isOpen: false, targetStep: 0 })
  }, [])

  const prevStep = () => {
    if (state.step > 1) {
      const targetStep = state.step - 1
      
      if (needsConfirmation(targetStep)) {
        setConfirmModal({ isOpen: true, targetStep })
      } else {
        setState(prev => ({ ...prev, step: (prev.step - 1) as 1 | 2 | 3 | 4 | 5 | 6 }))
      }
    }
  }

  const goToStep = (step: number) => {
    if (step >= 1 && step <= state.step) {
      if (needsConfirmation(step)) {
        setConfirmModal({ isOpen: true, targetStep: step })
      } else {
        setState(prev => ({ ...prev, step: step as 1 | 2 | 3 | 4 | 5 | 6 }))
      }
    }
  }

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return (
          <Step1Actor
            selectedActorId={state.actor_id}
            onSelect={(actorId) => updateState({ actor_id: actorId })}
            onNext={nextStep}
          />
        )
      case 2:
        return (
          <Step2Product
            product={state.product}
            onChange={(product) => updateState({ product })}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 3:
        return (
          <Step3Preset
            selectedPresetId={state.preset_id}
            selectedActor={selectedActor}
            onSelect={(presetId) => updateState({ preset_id: presetId })}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 4:
        const currentPreset = state.preset_id ? getPresetById(state.preset_id) : undefined
        return (
          <Step4Brief
            brief={state.brief}
            onChange={(brief) => updateState({ brief })}
            onNext={nextStep}
            onBack={prevStep}
            actor={selectedActor}
            preset={currentPreset}
            product={state.product}
            onClipsGenerated={handleClipsGenerated}
            onFirstFramesUpdate={handleFirstFramesUpdate}
          />
        )
      case 5:
        return (
          <Step5Plan
            state={state}
            onClipsGenerated={handleClipsGenerated}
            onFirstFramesUpdate={handleFirstFramesUpdate}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 6:
        return (
          <Step6Generate
            state={state}
            onClipsUpdate={handleClipsGenerated}
            onComplete={(id) => router.push(`/campaign/${id}`)}
            onBack={prevStep}
          />
        )
      default:
        return null
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ÉTATS DE CHARGEMENT / ERREUR
  // ══════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Chargement de la campagne...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-6xl">😕</div>
        <h2 className="text-xl font-semibold">{loadError}</h2>
        <p className="text-muted-foreground">Cette campagne n'existe pas ou tu n'y as pas accès.</p>
        <button 
          onClick={() => router.push('/new')}
          className="mt-4 px-6 py-2 bg-foreground text-background rounded-xl font-medium hover:opacity-90 transition"
        >
          Créer une nouvelle campagne
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Step indicator */}
      <StepIndicator 
        steps={STEPS} 
        currentStep={state.step}
        onStepClick={goToStep}
      />

      {/* Step content */}
      <div className="min-h-[500px]">
        {renderStep()}
      </div>

      {/* Modal de confirmation */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Modifier les étapes précédentes ?"
        message="Tu as un plan généré. Si tu modifies le brief ou les étapes précédentes, tu devras regénérer le plan avec un nouveau script."
        confirmText="Continuer"
        cancelText="Rester ici"
        variant="warning"
        onConfirm={confirmStepChange}
        onCancel={cancelStepChange}
      />
    </div>
  )
}

