'use client'

import { Check } from 'lucide-react'

interface Step {
  number: number
  title: string
  description: string
}

interface StepIndicatorProps {
  steps: Step[]
  currentStep: number
  onStepClick: (step: number) => void
}

export function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <div className="relative">
      {/* Progress line */}
      <div className="absolute top-5 left-0 right-0 h-0.5 bg-border">
        <div 
          className="h-full bg-foreground transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <div className="relative flex justify-between">
        {steps.map((step) => {
          const isCompleted = step.number < currentStep
          const isCurrent = step.number === currentStep
          const isClickable = step.number <= currentStep

          return (
            <button
              key={step.number}
              onClick={() => isClickable && onStepClick(step.number)}
              disabled={!isClickable}
              className={`flex flex-col items-center ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            >
              {/* Circle */}
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                  transition-all duration-300 border-2
                  ${isCompleted 
                    ? 'bg-foreground border-foreground text-background' 
                    : isCurrent
                      ? 'bg-background border-foreground text-foreground'
                      : 'bg-background border-border text-muted-foreground'
                  }
                `}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  step.number
                )}
              </div>

              {/* Label */}
              <div className="mt-3 text-center">
                <div className={`text-sm font-medium ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.title}
                </div>
                <div className="text-xs text-muted-foreground/60 hidden sm:block mt-0.5">
                  {step.description}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
