'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NewCampaignState, ProductConfig, CampaignBrief, CampaignClip } from '@/types'
import { StepIndicator } from '@/components/steps/step-indicator'
import { Step1Actor } from '@/components/steps/step1-actor'
import { Step2Product } from '@/components/steps/step2-product'
import { Step3Preset } from '@/components/steps/step3-preset'
import { Step4Brief } from '@/components/steps/step4-brief'
import { Step5Plan } from '@/components/steps/step5-plan'
import { Step6Generate } from '@/components/steps/step6-generate'

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
  const [state, setState] = useState<NewCampaignState>({
    step: 1,
    product: { has_product: false },
    brief: {},
  })

  const updateState = (updates: Partial<NewCampaignState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }

  const nextStep = () => {
    if (state.step < 6) {
      setState(prev => ({ ...prev, step: (prev.step + 1) as 1 | 2 | 3 | 4 | 5 | 6 }))
    }
  }

  const prevStep = () => {
    if (state.step > 1) {
      setState(prev => ({ ...prev, step: (prev.step - 1) as 1 | 2 | 3 | 4 | 5 | 6 }))
    }
  }

  const goToStep = (step: number) => {
    if (step >= 1 && step <= state.step) {
      setState(prev => ({ ...prev, step: step as 1 | 2 | 3 | 4 | 5 | 6 }))
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
            onSelect={(presetId) => updateState({ preset_id: presetId })}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 4:
        return (
          <Step4Brief
            brief={state.brief}
            onChange={(brief) => updateState({ brief })}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 5:
        return (
          <Step5Plan
            state={state}
            onClipsGenerated={(clips) => updateState({ generated_clips: clips })}
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
    </div>
  )
}

