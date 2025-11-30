'use client'

import { useState } from 'react'
import { ProductConfig, ProductHoldingType } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ArrowRight, Plus, Check, MessageSquare, Package } from 'lucide-react'

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
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-2xl font-semibold tracking-tight">Produit visible ?</h2>
        <p className="text-muted-foreground mt-2">
          Est-ce que ton acteur doit tenir ou montrer un produit ?
        </p>
      </div>

      {/* Toggle cards */}
      <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
        <Card
          className={`
            cursor-pointer transition-all duration-200 rounded-2xl
            ${!product.has_product
              ? 'ring-2 ring-foreground shadow-lg'
              : 'hover:shadow-md hover:border-foreground/20'
            }
          `}
          onClick={() => handleToggle(false)}
        >
          <CardContent className="p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-medium">Sans produit</h3>
            <p className="text-xs text-muted-foreground mt-1">Talking head simple</p>
            {!product.has_product && (
              <div className="mt-4">
                <div className="w-6 h-6 rounded-full bg-foreground flex items-center justify-center mx-auto">
                  <Check className="w-4 h-4 text-background" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          className={`
            cursor-pointer transition-all duration-200 rounded-2xl
            ${product.has_product
              ? 'ring-2 ring-foreground shadow-lg'
              : 'hover:shadow-md hover:border-foreground/20'
            }
          `}
          onClick={() => handleToggle(true)}
        >
          <CardContent className="p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Package className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-medium">Avec produit</h3>
            <p className="text-xs text-muted-foreground mt-1">Unboxing / Démo</p>
            {product.has_product && (
              <div className="mt-4">
                <div className="w-6 h-6 rounded-full bg-foreground flex items-center justify-center mx-auto">
                  <Check className="w-4 h-4 text-background" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Product configuration (if has_product) */}
      {product.has_product && (
        <div className="space-y-6 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Holding type selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Comment l'acteur tient le produit ?</Label>
            <div className="grid grid-cols-2 gap-3">
              {HOLDING_TYPES.map((type) => (
                <Card
                  key={type.value}
                  className={`
                    cursor-pointer transition-all duration-200 rounded-xl
                    ${product.holding_type === type.value
                      ? 'ring-2 ring-foreground shadow-md'
                      : 'hover:border-foreground/20'
                    }
                  `}
                  onClick={() => handleHoldingTypeChange(type.value)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl mb-2">{type.icon}</div>
                    <span className="text-sm font-medium">{type.label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Product image upload */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Image du produit (optionnel)</Label>
            <div className="flex items-center gap-4">
              <div 
                className="w-24 h-24 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-foreground/30 transition-colors"
                onClick={() => document.getElementById('product-image')?.click()}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Product" className="w-full h-full object-cover" />
                ) : (
                  <Plus className="w-6 h-6 text-muted-foreground" />
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
                  className="h-11 rounded-xl bg-muted/50 border-transparent focus:border-foreground"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Aide l'IA à générer un meilleur prompt
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="h-11 px-5 rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button
          onClick={onNext}
          className="h-11 px-6 rounded-xl font-medium group"
        >
          Continuer
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  )
}
