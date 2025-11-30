'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { NewCampaignState, ProductConfig, CampaignBrief, CampaignClip, GeneratedFirstFrames } from '@/types'
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

const STEPS = [
  { number: 1, title: 'Acteur', description: 'Choisis ton créateur IA' },
  { number: 2, title: 'Produit', description: 'Avec ou sans produit' },
  { number: 3, title: 'Intention', description: 'Style de la vidéo' },
  { number: 4, title: 'Brief', description: 'Décris ton offre' },
  { number: 5, title: 'Plan', description: 'Valide le script' },
  { number: 6, title: 'Génération', description: 'Créer les vidéos' },
]

export default function NewCampaignPage() {
  const router = useRouter()
  const { getActorById } = useActors()
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

  const updateState = (updates: Partial<NewCampaignState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }

  const nextStep = () => {
    if (state.step < 6) {
      setState(prev => ({ ...prev, step: (prev.step + 1) as 1 | 2 | 3 | 4 | 5 | 6 }))
    }
  }

  // Vérifier si on a besoin de confirmation pour aller à une étape
  const needsConfirmation = useCallback((targetStep: number): boolean => {
    // Confirmation seulement si on revient AVANT step5 avec des données générées
    return targetStep < 5 && state.step >= 5 && !!(state.generated_clips && state.generated_clips.length > 0)
  }, [state.step, state.generated_clips])

  // Confirmer le changement d'étape
  const confirmStepChange = useCallback(() => {
    setState(prev => ({ ...prev, step: confirmModal.targetStep as 1 | 2 | 3 | 4 | 5 | 6 }))
    setConfirmModal({ isOpen: false, targetStep: 0 })
  }, [confirmModal.targetStep])

  // Annuler le changement d'étape
  const cancelStepChange = useCallback(() => {
    setConfirmModal({ isOpen: false, targetStep: 0 })
  }, [])

  // Retour en arrière
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

  // Clic sur une étape dans l'indicateur
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
            onClipsGenerated={(clips) => updateState({ generated_clips: clips })}
            onFirstFramesUpdate={(frames) => updateState({ generated_first_frames: frames })}
          />
        )
      case 5:
        return (
          <Step5Plan
            state={state}
            onClipsGenerated={(clips) => updateState({ generated_clips: clips })}
            onFirstFramesUpdate={(frames) => updateState({ generated_first_frames: frames })}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 6:
        return (
          <Step6Generate
            state={state}
            onComplete={(campaignId) => router.push(`/campaign/${campaignId}`)}
            onBack={prevStep}
          />
        )
      default:
        return null
    }
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

      {/* Modal de confirmation pour revenir en arrière */}
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

