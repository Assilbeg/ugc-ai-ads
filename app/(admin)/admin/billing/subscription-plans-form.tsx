'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, Sparkles, Check, X } from 'lucide-react'

interface SubscriptionPlan {
  id: string
  name: string
  description: string | null
  price_cents: number
  monthly_credits: number
  stripe_price_id: string | null
  is_early_bird: boolean
  is_one_time: boolean
  is_active: boolean
  display_order: number
  features: string[]
}

interface SubscriptionPlansFormProps {
  plans: SubscriptionPlan[]
}

export function SubscriptionPlansForm({ plans: initialPlans }: SubscriptionPlansFormProps) {
  const [plans, setPlans] = useState(initialPlans)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2)
  }

  const handlePlanChange = (
    id: string, 
    field: keyof SubscriptionPlan, 
    value: string | number | boolean
  ) => {
    setPlans(prev => prev.map(plan => {
      if (plan.id !== id) return plan
      
      if (field === 'price_cents' || field === 'monthly_credits') {
        return { ...plan, [field]: Math.round(parseFloat(value as string || '0') * 100) }
      }
      
      return { ...plan, [field]: value }
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/subscription-plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans }),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde')
      }

      setMessage({ type: 'success', text: 'Plans mis à jour avec succès' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`p-4 rounded-xl border bg-card ${
              !plan.is_active ? 'opacity-50' : ''
            } ${
              plan.is_early_bird ? 'border-amber-500/50 bg-amber-500/5' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <h4 className="font-semibold text-lg">{plan.name}</h4>
                {plan.is_early_bird && (
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-600">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Early Bird
                  </Badge>
                )}
                {plan.is_one_time && (
                  <Badge variant="outline">One-time</Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePlanChange(plan.id, 'is_active', !plan.is_active)}
              >
                {plan.is_active ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <X className="w-4 h-4 text-red-500" />
                )}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Prix (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formatPrice(plan.price_cents)}
                  onChange={(e) => handlePlanChange(plan.id, 'price_cents', e.target.value)}
                  className="h-9"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Crédits mensuels (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formatPrice(plan.monthly_credits)}
                  onChange={(e) => handlePlanChange(plan.id, 'monthly_credits', e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs text-muted-foreground">Stripe Price ID</Label>
                <Input
                  type="text"
                  placeholder="price_xxx..."
                  value={plan.stripe_price_id || ''}
                  onChange={(e) => handlePlanChange(plan.id, 'stripe_price_id', e.target.value)}
                  className="h-9 font-mono text-sm"
                />
              </div>
            </div>

            <div className="mt-3 text-sm text-muted-foreground">
              <p>{plan.description}</p>
              {plan.features && plan.features.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {plan.features.map((feature, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
          {message.text}
        </p>
      )}

      <Button onClick={handleSave} disabled={isSaving} className="h-11 rounded-xl">
        {isSaving ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        Sauvegarder les plans
      </Button>
    </div>
  )
}







