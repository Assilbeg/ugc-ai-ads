---
name: Product System Integration
overview: "Integration complete du systeme produit : enrichissement des prompts Claude, ajout du champ description dans l'UI, et upload de l'image produit vers Supabase Storage."
todos:
  - id: doc-features
    content: Documenter le systeme produit dans docs/FEATURES.md
    status: pending
  - id: prompt-system
    content: Ajouter section produit dans le system prompt Claude
    status: pending
  - id: prompt-user
    content: Enrichir la section produit dans le user prompt
    status: pending
  - id: prompt-rules
    content: Ajouter instruction finale sur coherence produit/geste
    status: pending
  - id: ui-description
    content: Ajouter champ description dans step2-product.tsx
    status: pending
  - id: bucket-create
    content: Creer le bucket Supabase Storage 'products'
    status: pending
  - id: api-upload
    content: Creer endpoint API upload/product-image
    status: pending
  - id: ui-upload
    content: Modifier handleImageUpload pour utiliser Supabase
    status: pending
  - id: doc-critical
    content: Documenter les regles dans CRITICAL_BEHAVIORS.md
    status: pending
---

# Integration Complete du Systeme Produit

## Contexte et Etat Actuel

### Structure des donnees produit

Le type `ProductConfig` dans [types/index.ts](types/index.ts) (lignes 181-187) :

```typescript
export interface ProductConfig {
  has_product: boolean;
  image_url?: string;        // Actuellement stocke en base64, sera URL Supabase
  holding_type?: ProductHoldingType;  // 'holding_box' | 'holding_bottle' | 'showing_phone_screen' | 'pointing_at'
  name?: string;
  description?: string;      // Existe dans le type mais PAS dans l'UI
}
```

### Etat actuel par composant

| Composant | Fichier | Status |

|-----------|---------|--------|

| UI collecte | [components/steps/step2-product.tsx](components/steps/step2-product.tsx) | Manque champ `description` |

| Stockage BDD | `campaigns.product` (JSONB) | OK |

| Prompts Claude | [lib/api/claude.ts](lib/api/claude.ts) | 1 ligne basique (ligne 486-489) |

| Upload image | - | Non implemente (base64 local) |

### Code actuel du prompt produit (a remplacer)

Dans [lib/api/claude.ts](lib/api/claude.ts) lignes 483-489 :

```typescript
════════════════════════════════════════
PRODUIT VISIBLE
════════════════════════════════════════
${product.has_product 
  ? `Oui - Type de tenue : ${product.holding_type} - Nom : ${product.name || 'produit'} - Description : ${product.description || 'N/A'}`
  : 'Non - Talking head sans produit visible'
}
```

### Pattern Supabase Storage existant (a suivre)

Dans [app/api/assemble/route.ts](app/api/assemble/route.ts) lignes 112-161, fonction `uploadThumbnailToSupabase` :

```typescript
import { createServiceClient } from '@/lib/supabase/server'

async function uploadThumbnailToSupabase(url: string, campaignId: string): Promise<string | null> {
  const supabaseService = createServiceClient()
  
  // Upload vers bucket
  const { data, error } = await supabaseService.storage
    .from('thumbnails')
    .upload(fileName, imageBuffer, {
      contentType: 'image/jpeg',
      upsert: true
    })
  
  // Obtenir URL publique
  const { data: { publicUrl } } = supabaseService.storage
    .from('thumbnails')
    .getPublicUrl(data.path)
  
  return publicUrl
}
```

### Gestes disponibles (ligne 323-324 de claude.ts)

```
neutral, pointing_camera, pointing_self, open_palm, thumbs_up, 
counting_fingers, holding_product, showing_phone, thinking_pose, shrug, hand_on_chest, waving
```

---

## Fichiers a Modifier

| Fichier | Modifications |

|---------|---------------|

| [lib/api/claude.ts](lib/api/claude.ts) | Enrichir prompts (lignes 319-337 et 483-527) |

| [components/steps/step2-product.tsx](components/steps/step2-product.tsx) | Ajouter description + upload Supabase |

| [app/api/upload/product-image/route.ts](app/api/upload/product-image/route.ts) | NOUVEAU - endpoint upload |

| [docs/FEATURES.md](docs/FEATURES.md) | Documentation systeme produit |

| [docs/CRITICAL_BEHAVIORS.md](docs/CRITICAL_BEHAVIORS.md) | Regles produit |

---

## Phase 1 : Documentation (docs/FEATURES.md)

Ajouter une section "## Systeme Produit" documentant :

- Les 4 types de holding (`holding_box`, `holding_bottle`, `showing_phone_screen`, `pointing_at`)
- Le mapping vers les gestes (`holding_product` ou `showing_phone`)
- Les beats ou le produit doit apparaitre (solution, proof, cta - PAS hook ni problem)
- Le format de stockage en BDD

---

## Phase 2 : Enrichissement des Prompts Claude

### 2.1 Ajouter section dans system prompt (apres ligne 337)

Ajouter apres la section "MAPPING GESTE -> SCRIPT" :

```typescript
══════════════════════════════════════════════════════════════════
5.2 INTEGRATION PRODUIT VISIBLE (si has_product = true)
══════════════════════════════════════════════════════════════════

Quand le brief indique un produit visible, tu DOIS :

1. GESTE OBLIGATOIRE selon le type de tenue :
   - holding_box / holding_bottle → geste "holding_product"
   - showing_phone_screen → geste "showing_phone"
   - pointing_at → geste "pointing_camera" (vers le produit hors champ)

2. BEATS OU MONTRER LE PRODUIT :
   - Solution (order=3) : OBLIGATOIRE - c'est la revelation du produit
   - Proof (order=4) : RECOMMANDE - montrer le resultat/utilisation
   - CTA (order=5) : OPTIONNEL - rappel visuel
   - Hook (order=1) et Problem (order=2) : JAMAIS de produit visible

3. DESCRIPTION VISUELLE dans first_frame.prompt :
   - Decrire comment l'acteur tient/montre le produit
   - Inclure le nom du produit si fourni
   - Ex: "holding a white skincare box in her hands, showing it to camera"

4. COHERENCE : Le produit doit etre le MEME dans tous les clips ou il apparait.
```

### 2.2 Enrichir user prompt (remplacer lignes 483-489)

Remplacer par :

```typescript
════════════════════════════════════════
PRODUIT VISIBLE
════════════════════════════════════════
${product.has_product 
  ? `OUI - L'acteur doit montrer/tenir un produit physique

TYPE DE PRODUIT : ${
    product.holding_type === 'holding_box' ? 'Boite/Packaging (l\'acteur tient une boite)' 
    : product.holding_type === 'holding_bottle' ? 'Bouteille/Tube (l\'acteur tient un contenant)' 
    : product.holding_type === 'showing_phone_screen' ? 'Application mobile (l\'acteur montre son ecran de telephone)' 
    : 'Produit pose (l\'acteur pointe du doigt vers le produit)'
  }

NOM DU PRODUIT : ${product.name || 'Non specifie'}
DESCRIPTION : ${product.description || 'Non specifiee'}

GESTE A UTILISER : ${
    product.holding_type === 'showing_phone_screen' ? 'showing_phone' : 'holding_product'
  }

INSTRUCTIONS :
- Beat "solution" (order=3) : DOIT montrer le produit avec le geste ci-dessus
- Beat "proof" (order=4) : PEUT montrer le produit
- Beats "hook" et "problem" : PAS de produit visible
- Decrire le produit dans first_frame.prompt des clips concernes`
  : 'Non - Talking head simple sans produit visible'
}
```

### 2.3 Ajouter instruction finale (apres ligne 518)

Ajouter une nouvelle regle :

```typescript
11. ${product.has_product 
  ? `PRODUIT OBLIGATOIRE : Le clip "solution" (order=3) DOIT utiliser le geste "${product.holding_type === 'showing_phone_screen' ? 'showing_phone' : 'holding_product'}" et decrire le produit dans first_frame.prompt`
  : ''}
```

---

## Phase 3 : Amelioration UI (step2-product.tsx)

### 3.1 Ajouter handler description (apres ligne 55)

```typescript
const handleDescriptionChange = (description: string) => {
  onChange({ ...product, description })
}
```

### 3.2 Ajouter textarea description (apres ligne 181, dans le bloc product image)

```tsx
{/* Product description */}
<div className="space-y-3 mt-4">
  <Label className="text-sm font-medium">Description du produit (optionnel)</Label>
  <textarea
    placeholder="Decris ton produit : couleur, forme, texte visible sur le packaging..."
    value={product.description || ''}
    onChange={(e) => handleDescriptionChange(e.target.value)}
    className="w-full h-20 px-3 py-2 rounded-xl bg-muted/50 border-transparent focus:border-foreground resize-none text-sm"
  />
  <p className="text-xs text-muted-foreground">
    Plus la description est precise, meilleur sera le rendu dans la video
  </p>
</div>
```

### 3.3 Modifier handleImageUpload pour upload vers Supabase

Remplacer lignes 40-51 par :

```typescript
const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  
  // Preview local immediat
  const reader = new FileReader()
  reader.onload = (e) => setImagePreview(e.target?.result as string)
  reader.readAsDataURL(file)
  
  // Upload vers Supabase
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await fetch('/api/upload/product-image', {
      method: 'POST',
      body: formData,
    })
    
    if (!response.ok) throw new Error('Upload failed')
    
    const { url } = await response.json()
    onChange({ ...product, image_url: url })
  } catch (err) {
    console.error('Failed to upload product image:', err)
    // Fallback : garder le base64 en local
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      onChange({ ...product, image_url: dataUrl })
    }
    reader.readAsDataURL(file)
  }
}
```

---

## Phase 4 : Endpoint Upload Supabase

### 4.1 Creer bucket via MCP ou dashboard

Executer via MCP Supabase :

```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products', 'products', true);
```

### 4.2 Creer [app/api/upload/product-image/route.ts](app/api/upload/product-image/route.ts)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    // Verifier authentification
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    
    // Recuperer le fichier
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    }
    
    // Generer nom unique
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${user.id}/${uuidv4()}.${ext}`
    
    // Convertir en buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Upload avec service client (bypass RLS)
    const supabaseService = createServiceClient()
    
    const { data, error } = await supabaseService.storage
      .from('products')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true
      })
    
    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Obtenir URL publique
    const { data: { publicUrl } } = supabaseService.storage
      .from('products')
      .getPublicUrl(data.path)
    
    return NextResponse.json({ url: publicUrl })
    
  } catch (err) {
    console.error('Product image upload error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur upload' },
      { status: 500 }
    )
  }
}
```

---

## Phase 5 : Documentation CRITICAL_BEHAVIORS.md

Ajouter section :

```markdown
## 16. Systeme Produit

### Regles d'integration

| Type de tenue | Geste a utiliser | Description |
|---------------|------------------|-------------|
| holding_box | holding_product | L'acteur tient une boite/packaging |
| holding_bottle | holding_product | L'acteur tient une bouteille/tube |
| showing_phone_screen | showing_phone | L'acteur montre son ecran |
| pointing_at | pointing_camera | L'acteur pointe vers le produit |

### Beats et produit

| Beat | Order | Produit visible |
|------|-------|-----------------|
| hook | 1 | JAMAIS |
| problem | 2 | JAMAIS |
| solution | 3 | OBLIGATOIRE si has_product=true |
| proof | 4 | RECOMMANDE |
| cta | 5 | OPTIONNEL |

### Stockage image produit

- **Bucket Supabase** : `products` (public)
- **Format nom** : `{user_id}/{uuid}.{ext}`
- **Backward compatibility** : Le code gere les anciennes images en base64
```

---

## Points d'Attention

1. **Backward compatibility** : `product.description` peut etre `undefined` - toujours utiliser `|| ''`
2. **Images base64 existantes** : Le code doit detecter si `image_url` commence par `data:` ou `https://`
3. **Bucket RLS** : Le bucket `products` doit etre public pour que les URLs fonctionnent
4. **Cast Supabase** : Utiliser `(supabase.from('table') as any)` pour les updates