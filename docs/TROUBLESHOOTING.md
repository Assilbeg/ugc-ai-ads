# 🔧 Troubleshooting - Erreurs Courantes

> Guide de résolution des erreurs fréquentes. Pour les comportements critiques, voir [`CRITICAL_BEHAVIORS.md`](./CRITICAL_BEHAVIORS.md).

---

## 📋 Table des matières

1. [Erreurs Transloadit / FFmpeg](#erreurs-transloadit--ffmpeg)
2. [Erreurs de Crédits](#erreurs-de-crédits)
3. [Erreurs de Génération IA](#erreurs-de-génération-ia)
4. [Erreurs BDD / Supabase](#erreurs-bdd--supabase)
5. [Erreurs UI / Frontend](#erreurs-ui--frontend)
6. [Erreurs Stripe / Webhooks](#erreurs-stripe--webhooks)
7. [Patterns de Debug (Git History)](#patterns-de-debug-git-history)

---

## Erreurs Transloadit / FFmpeg

### INTERNAL_COMMAND_ERROR

| Aspect | Détails |
|--------|---------|
| **Erreur** | `INTERNAL_COMMAND_ERROR` dans Transloadit |
| **Cause probable** | Resize 9:16 dans la même étape que le concat |
| **Solution** | Séparer le resize du concat en 2 étapes distinctes |
| **Commit de fix** | `08f7d82`, `616ee96` |

```typescript
// ❌ INCORRECT - Cause INTERNAL_COMMAND_ERROR
"/video/concat": {
  use: { steps: clips },
  preset: 'ipad-high',
  width: 1080,   // ← Ne pas mettre ici
  height: 1920   // ← Ne pas mettre ici
}

// ✅ CORRECT - Resize en étape séparée
"/video/concat": {
  use: { steps: clips },
  preset: 'ipad-high'
},
"/video/encode": {
  use: ":parent",
  ffmpeg_stack: "v6.0.0",
  vf: "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
}
```

---

### Vidéo coupée au début

| Aspect | Détails |
|--------|---------|
| **Erreur** | Le début de la vidéo est coupé après trim |
| **Cause probable** | Timestamps non normalisés (vidéos IA ne commencent pas à 0) |
| **Solution** | Ajouter `setpts=PTS-STARTPTS` AVANT le trim |
| **Commit de fix** | `698152f`, `a9a0b46` |

```typescript
// ❌ INCORRECT - Timestamps non normalisés
videoFilters.push(`trim=end=${trimEnd}`)

// ✅ CORRECT - Normaliser d'abord
videoFilters.push('setpts=PTS-STARTPTS')   // ← Normalise à 0
videoFilters.push(`trim=start=0:end=${trimEnd}`)
videoFilters.push('setpts=PTS-STARTPTS')   // ← Re-normalise après trim
```

---

### Assembly failed / URL invalide

| Aspect | Détails |
|--------|---------|
| **Erreur** | `Assembly failed`, `Could not fetch URL` |
| **Cause probable** | URL de clip invalide ou inaccessible |
| **Solution** | Vérifier les URLs avec HEAD request avant assemblage |
| **Fichier** | `app/api/assemble/route.ts` |

```typescript
// Validation HEAD avant assemblage
const checkUrl = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

// Si échec, retirer le clip ou retry
```

---

### igndts coupe les vidéos

| Aspect | Détails |
|--------|---------|
| **Erreur** | Vidéos tronquées au début après concat |
| **Cause probable** | Flag `igndts` (ignore DTS) mal utilisé |
| **Solution** | Ne JAMAIS utiliser `igndts`, utiliser `fflags: '+genpts+discardcorrupt'` |
| **Commit de revert** | `94daeca` |

```typescript
// ❌ INTERDIT
ffmpegParams['fflags'] = '+igndts'

// ✅ CORRECT
ffmpegParams['fflags'] = '+genpts+discardcorrupt'
```

---

## Erreurs de Crédits

### INSUFFICIENT_CREDITS

| Aspect | Détails |
|--------|---------|
| **Erreur** | `INSUFFICIENT_CREDITS`, `Not enough credits` |
| **Cause probable** | Balance < coût de la génération |
| **Solution** | Recharger crédits ou vérifier le calcul du coût |

```typescript
// Vérification côté client
const { data: credits } = await supabase
  .from('user_credits')
  .select('balance')
  .eq('user_id', userId)
  .single()

if (credits.balance < estimatedCost) {
  throw new Error('INSUFFICIENT_CREDITS')
}
```

> **Note** : La balance peut être négative après une génération (race condition acceptée). Voir [CRITICAL_BEHAVIORS.md #7](./CRITICAL_BEHAVIORS.md#7-système-de-crédits).

---

### Balance négative inattendue

| Aspect | Détails |
|--------|---------|
| **Situation** | Balance négative après génération |
| **C'est normal si** | Race condition entre check et déduction |
| **C'est un bug si** | Balance très négative (> -500 crédits) sans génération en cours |

```sql
-- Vérifier les transactions récentes
SELECT amount, balance_after, description, created_at
FROM credit_transactions
WHERE user_id = 'USER_UUID'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Erreurs de Génération IA

### Voix robotique / pas clonée

| Aspect | Détails |
|--------|---------|
| **Erreur** | La voix dans la vidéo finale est robotique |
| **Cause probable** | ChatterboxHD a échoué, on garde l'audio Veo original |
| **Solution** | Vérifier les logs de génération, régénérer la voix |

```sql
-- Vérifier si la voix a été générée
SELECT audio->>'voice_url' as voice_url, status
FROM campaign_clips
WHERE id = 'CLIP_UUID';

-- Si voice_url est null → ChatterboxHD a échoué
```

---

### First Frame généré mais pas la vidéo

| Aspect | Détails |
|--------|---------|
| **Erreur** | Image visible mais pas de vidéo |
| **Cause probable** | Veo a échoué (timeout, moderation, quota) |
| **Solution** | Vérifier `generation_logs`, régénérer |

```sql
SELECT status, error_message, created_at
FROM generation_logs
WHERE clip_id = 'CLIP_UUID'
  AND generation_type LIKE '%video%'
ORDER BY created_at DESC;
```

---

### Transcription vide ou incorrecte

| Aspect | Détails |
|--------|---------|
| **Erreur** | `transcription` null ou `auto_adjustments` absurdes |
| **Cause probable** | Whisper n'a rien détecté (vidéo muette ou audio corrompu) |
| **Solution** | Vérifier que la vidéo a de l'audio, régénérer |

```sql
-- Vérifier la transcription
SELECT transcription, auto_adjustments
FROM campaign_clips
WHERE id = 'CLIP_UUID';
```

---

## Erreurs BDD / Supabase

### .single() retourne plusieurs rows

| Aspect | Détails |
|--------|---------|
| **Erreur** | `PGRST116: Results contain X rows, application/json requires 1` |
| **Cause probable** | `.single()` utilisé sur `campaign_clips` filtré par `order` |
| **Solution** | Utiliser `.limit(1)` au lieu de `.single()` |
| **Commit de fix** | `91ae571` |

```typescript
// ❌ INTERDIT - Plusieurs clips peuvent avoir le même order
const { data } = await supabase
  .from('campaign_clips')
  .select('*')
  .eq('campaign_id', id)
  .eq('order', 1)
  .single()  // 💥 ERREUR

// ✅ CORRECT
const { data } = await supabase
  .from('campaign_clips')
  .select('*')
  .eq('campaign_id', id)
  .eq('order', 1)
  .order('is_selected', { ascending: false })
  .limit(1)

const clip = data?.[0]
```

---

### RLS policy denied

| Aspect | Détails |
|--------|---------|
| **Erreur** | `new row violates row-level security policy` |
| **Cause probable** | User essaie d'accéder à des données d'un autre user |
| **Solution** | Vérifier les policies RLS, s'assurer que `user_id` correspond |

```sql
-- Vérifier les policies sur une table
SELECT * FROM pg_policies WHERE tablename = 'campaigns';
```

---

## Erreurs UI / Frontend

### Tuiles dupliquées dans Step 6

| Aspect | Détails |
|--------|---------|
| **Erreur** | Plusieurs tuiles pour le même beat |
| **Cause probable** | Itération sur `clips` au lieu de `uniqueBeats` |
| **Solution** | Utiliser `uniqueBeats` pour l'affichage |
| **Commit de fix** | `91ae571` |

```typescript
// ❌ INCORRECT - Affiche toutes les versions
{clips.map(clip => <ClipTile key={clip.id} clip={clip} />)}

// ✅ CORRECT - Une tuile par beat
const uniqueBeats = [...new Set(clips.map(c => c.order))]
{uniqueBeats.map(order => {
  const clip = getSelectedClip(clips, order)
  return <ClipTile key={order} clip={clip} />
})}
```

---

### Ajustements pas sauvegardés

| Aspect | Détails |
|--------|---------|
| **Erreur** | Les sliders de trim/speed ne persistent pas |
| **Cause probable** | Ajustements indexés par `order` au lieu de `clip.id` |
| **Solution** | Toujours utiliser `clip.id` comme clé |
| **Commit de fix** | `c3c5549` |

```typescript
// ❌ INCORRECT - Se mélange entre versions
const adjustments = { [clip.order]: { trimStart, speed } }

// ✅ CORRECT - Unique par version
const adjustments = { [clip.id]: { trimStart, speed } }
```

---

### Race condition sur setState

| Aspect | Détails |
|--------|---------|
| **Erreur** | Certaines mises à jour de state sont perdues |
| **Cause probable** | Mises à jour concurrentes sans functional updater |
| **Solution** | Utiliser le pattern functional updater |
| **Commit de fix** | `2df633e`, `ec11682` |

```typescript
// ❌ INCORRECT - Race condition possible
setAdjustments({
  ...adjustments,
  [clipId]: newValue
})

// ✅ CORRECT - Functional updater
setAdjustments(prev => ({
  ...prev,
  [clipId]: newValue
}))
```

---

## Erreurs Stripe / Webhooks

### Crédits non ajoutés après paiement

| Aspect | Détails |
|--------|---------|
| **Erreur** | L'utilisateur paye mais ne reçoit pas ses crédits |
| **Causes probables** | 1. Plan non trouvé en BDD 2. Metadata manquant 3. Webhook pas déclenché |
| **Fichier** | `app/api/stripe/webhook/route.ts` |
| **Commit de debug** | `fb14bd6` |

```sql
-- Vérifier si le plan existe
SELECT * FROM subscription_plans WHERE id = 'early_bird';

-- Vérifier les transactions récentes
SELECT * FROM credit_transactions 
WHERE user_id = 'USER_UUID' 
ORDER BY created_at DESC LIMIT 5;

-- Vérifier le stripe_customer_id
SELECT stripe_customer_id, balance FROM user_credits 
WHERE user_id = 'USER_UUID';
```

**Solution** : Les plans doivent être créés dans `subscription_plans` via `billing.sql` **avant** que les webhooks Stripe ne les référencent.

---

### Missing metadata in checkout session

| Aspect | Détails |
|--------|---------|
| **Erreur** | `Missing metadata in checkout session: { userId: undefined, planId: undefined }` |
| **Cause probable** | Metadata `user_id` et `plan_id` non passés lors de la création de la session Stripe |
| **Fichier** | `app/api/stripe/checkout/route.ts` |

```typescript
// ✅ CORRECT - Toujours passer les metadata
const session = await stripe.checkout.sessions.create({
  metadata: {
    user_id: userId,    // OBLIGATOIRE
    plan_id: planId,    // OBLIGATOIRE
  },
  // ...
})
```

---

### Webhook signature verification failed

| Aspect | Détails |
|--------|---------|
| **Erreur** | `Webhook signature verification failed` |
| **Cause probable** | Secret webhook incorrect dans les env vars |
| **Solution** | Vérifier `STRIPE_WEBHOOK_SECRET` dans Vercel |

```bash
# Récupérer le webhook secret dans Stripe Dashboard
# Stripe Dashboard > Developers > Webhooks > Click endpoint > Signing secret
```

---

### Lazy-load supabaseAdmin erreur au build

| Aspect | Détails |
|--------|---------|
| **Erreur** | Erreur au build Vercel sur la route webhook |
| **Cause** | `createClient` appelé au niveau module (pas lazy) |
| **Commit de fix** | `1841d99` |

```typescript
// ❌ INCORRECT - Erreur au build
const supabaseAdmin = createClient(...)

// ✅ CORRECT - Lazy-load
let _supabaseAdmin: SupabaseClient | null = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabaseAdmin
}
```

---

## Patterns de Debug (Git History)

### Pattern "Fix puis Revert"

Certains bugs ont un pattern récurrent : un fix qui semblait correct mais qui cause d'autres problèmes, suivi d'un revert.

| Commit Fix | Commit Revert | Leçon |
|------------|---------------|-------|
| `825a268` (clips avec ajustements réels) | `f22023c` | Ne pré-traiter que certains clips causait des incohérences |
| (igndts flag) | `94daeca` | igndts coupe le début des vidéos |
| (resize dans concat) | `616ee96` | Resize dans concat → INTERNAL_COMMAND_ERROR |

**Leçon** : Avant d'optimiser pour "éviter le timeout", vérifier que le comportement reste correct pour TOUS les cas.

---

### Commits de debug utiles

Ces commits contiennent des patterns de debug réutilisables :

| Commit | Description | Pattern de debug |
|--------|-------------|------------------|
| `8f7bc11` | Supprimer filtre status + logs | Enlever les filtres pour voir toutes les données |
| `fb14bd6` | Verbose logging Stripe webhook | Logger chaque étape du webhook |
| `40b66d5` | Log duration update | Tracer une valeur à travers tout le flow |
| `540fbff` | Log raw adjustments | Comparer indices et longueurs d'array |
| `5339cc0` | Delay avant redirect | Garder la console ouverte pour voir les logs |
| `d9bdc48` | Compare original vs processed URLs | Vérifier que le traitement a eu lieu |

---

### Checklist debug par symptôme

#### "Ça marchait hier"

1. `git log --oneline -20` - Voir les commits récents
2. `git diff HEAD~5 -- <fichier>` - Voir les changements récents
3. Chercher des reverts : `git log --oneline --grep="revert"`

#### "Timeout Vercel"

1. Vérifier `maxDuration` dans la route (`export const maxDuration = 300`)
2. Vérifier si on fait trop de requêtes séquentielles
3. Commit de référence : `62bc728` (ajout maxDuration à toutes les routes)

#### "Données incohérentes"

1. Vérifier RLS avec une requête directe Supabase Dashboard
2. Chercher `.single()` qui devrait être `.limit(1)`
3. Vérifier les race conditions (functional updater pattern)

---

## 🔍 Debug rapide

### Checklist avant debug

1. **Vérifier les logs Supabase** : `generation_logs` pour les erreurs IA
2. **Vérifier Transloadit** : Dashboard pour les assemblies échouées
3. **Vérifier la console** : Erreurs réseau, CORS
4. **Vérifier les crédits** : Balance suffisante

### Commandes utiles

```bash
# Voir les logs serveur Next.js
npm run dev

# Vérifier les types TypeScript
npm run type-check

# Lancer les lints
npm run lint
```

### URLs utiles

- **Supabase Dashboard** : https://supabase.com/dashboard/project/xresijptcptdilwecklf
- **Transloadit Dashboard** : https://transloadit.com/c/
- **fal.ai Dashboard** : https://fal.ai/dashboard

---

## 📝 Ajouter une erreur

Quand tu rencontres une nouvelle erreur récurrente :

1. L'ajouter dans ce fichier avec :
   - Description de l'erreur
   - Cause probable
   - Solution
   - Commit de fix (si applicable)
2. Si c'est un comportement **critique** → L'ajouter aussi dans [`CRITICAL_BEHAVIORS.md`](./CRITICAL_BEHAVIORS.md)

---

*Dernière mise à jour : 5 décembre 2024*

