'use client'

import { useState } from 'react'
import { ProductConfig, ProductHoldingType } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Step2ProductProps {
  product: ProductConfig
  onChange: (product: ProductConfig) => void
  onNext: () => void
  onBack: () => void
}

const HOLDING_TYPES: { value: ProductHoldingType; label: string; icon: string }[] = [
  { value: 'holding_box', label: 'Tenir une boîte', icon: '📦' },
  { value: 'holding_bottle', label: 'Tenir une bouteille', icon: '🧴' },
  { value: 'showing_phone_screen', label: 'Montrer un écran', icon: '📱' },
  { value: 'pointing_at', label: 'Pointer du doigt', icon: '👆' },
]

export function Step2Product({ product, onChange, onNext, onBack }: Step2ProductProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(product.image_url || null)

  const handleToggle = (hasProduct: boolean) => {
    onChange({
      ...product,
      has_product: hasProduct,
      holding_type: hasProduct ? product.holding_type || 'holding_box' : undefined,
    })
  }

  const handleHoldingTypeChange = (holdingType: ProductHoldingType) => {
    onChange({ ...product, holding_type: holdingType })
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        setImagePreview(dataUrl)
        onChange({ ...product, image_url: dataUrl })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleNameChange = (name: string) => {
    onChange({ ...product, name })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Produit visible ?</h2>
        <p className="text-zinc-400 mt-2">
          Est-ce que ton acteur doit tenir ou montrer un produit ?
        </p>
      </div>

      {/* Toggle cards */}
      <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
        <Card
          className={`
            cursor-pointer transition-all duration-200
            ${!product.has_product
              ? 'ring-2 ring-violet-500 bg-violet-500/10 border-violet-500'
              : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
            }
          `}
          onClick={() => handleToggle(false)}
        >
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-3">🗣️</div>
            <h3 className="font-medium text-white">Sans produit</h3>
            <p className="text-xs text-zinc-500 mt-1">Talking head simple</p>
          </CardContent>
        </Card>

        <Card
          className={`
            cursor-pointer transition-all duration-200
            ${product.has_product
              ? 'ring-2 ring-violet-500 bg-violet-500/10 border-violet-500'
              : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
            }
          `}
          onClick={() => handleToggle(true)}
        >
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-3">📦</div>
            <h3 className="font-medium text-white">Avec produit</h3>
            <p className="text-xs text-zinc-500 mt-1">Unboxing / Démo</p>
          </CardContent>
        </Card>
      </div>

      {/* Product configuration (if has_product) */}
      {product.has_product && (
        <div className="space-y-6 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Holding type selection */}
          <div className="space-y-3">
            <Label className="text-zinc-300">Comment l'acteur tient le produit ?</Label>
            <div className="grid grid-cols-2 gap-3">
              {HOLDING_TYPES.map((type) => (
                <Card
                  key={type.value}
                  className={`
                    cursor-pointer transition-all duration-200
                    ${product.holding_type === type.value
                      ? 'ring-2 ring-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500'
                      : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                    }
                  `}
                  onClick={() => handleHoldingTypeChange(type.value)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl mb-2">{type.icon}</div>
                    <span className="text-sm text-white">{type.label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Product image upload */}
          <div className="space-y-3">
            <Label className="text-zinc-300">Image du produit (optionnel)</Label>
            <div className="flex items-center gap-4">
              <div 
                className="w-24 h-24 rounded-lg bg-zinc-800 border-2 border-dashed border-zinc-700 flex items-center justify-center overflow-hidden cursor-pointer hover:border-zinc-600"
                onClick={() => document.getElementById('product-image')?.click()}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Product" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                )}
              </div>
              <input
                id="product-image"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <div className="flex-1">
                <Input
                  placeholder="Nom du produit"
                  value={product.name || ''}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="bg-zinc-800/50 border-zinc-700 text-white"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Aide l'IA à générer un meilleur prompt
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="text-zinc-400 hover:text-white">
          ← Retour
        </Button>
        <Button
          onClick={onNext}
          className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
        >
          Continuer
        </Button>
      </div>
    </div>
  )
}

