'use client'

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
      <div className="absolute top-5 left-0 right-0 h-0.5 bg-zinc-800">
        <div 
          className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 transition-all duration-500"
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
                    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 border-transparent text-white' 
                    : isCurrent
                      ? 'bg-zinc-900 border-violet-500 text-violet-400'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-500'
                  }
                `}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>

              {/* Label */}
              <div className="mt-2 text-center">
                <div className={`text-sm font-medium ${isCurrent ? 'text-white' : 'text-zinc-500'}`}>
                  {step.title}
                </div>
                <div className="text-xs text-zinc-600 hidden sm:block">
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

