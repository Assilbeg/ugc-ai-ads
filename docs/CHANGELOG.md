# 📜 Changelog - Décisions Architecturales Majeures

> Ce document trace les **décisions importantes** et les **changements de comportement**.
> Utile pour comprendre POURQUOI certaines choses sont faites d'une certaine manière.

---

## Décembre 2025

### 2025-12-10 - Push forcé intégration image produit
- **Commit**: `0d88c6d` (push déjà effectué)
- **Changement**: Intégration upload image produit Supabase + prompts produit Claude + UI Step 2 + docs système produit.
- **Pourquoi**: Push effectué à contrecoeur pour débloquer, documenté ici pour trace.
- **Règle établie**: Documenter tout push non souhaité dans le changelog pour traçabilité.

---

## Décembre 2024

### 2024-12-05 - Documentation Ground Truth
- **Commit**: `339bcc0`
- **Changement**: Centralisation de toute la documentation dans `/docs/`
- **Pourquoi**: Éviter de casser des comportements établis lors de modifications futures
- **Fichiers créés**: `CRITICAL_BEHAVIORS.md`, `FEATURES.md`, `ARCHITECTURE.md`, `DATABASE.md`

### 2024-12-05 - Versioning des clips (navigation + comptage)
- **Commits**: `81785dc`, `53749b0`, `91ae571`
- **Changement**: Fix du comptage des clips par beats + chargement des versions archivées
- **Pourquoi**: L'UI affichait un mauvais compteur et les flèches de navigation ne fonctionnaient pas
- **Règle établie**: Itérer sur `uniqueBeats`, pas sur `clips` pour l'affichage

### 2024-12-04 - Archivage version APRÈS succès
- **Commit**: `26f5f86`
- **Changement**: L'archivage de la version précédente se fait APRÈS la régénération réussie
- **Pourquoi**: Si on archive avant et que la régénération échoue, on perd la version
- **Règle établie**: Toujours archiver APRÈS succès, jamais avant

### 2024-12-03 - Ajustements par clip.id
- **Commit**: `c3c5549`
- **Changement**: Les ajustements sont indexés par `clip.id`, pas par `beat/order`
- **Pourquoi**: Plusieurs clips peuvent avoir le même beat (versioning)
- **Règle établie**: Utiliser `getClipKey(clip)` qui retourne l'ID unique

---

## Novembre 2024

### 2024-11-xx - Système de versioning des clips
- **Commit**: `25957ca`
- **Changement**: Introduction de `is_selected` et possibilité d'avoir plusieurs clips par beat
- **Pourquoi**: Permettre de régénérer un clip sans perdre l'ancien
- **Règle établie**: Un seul `is_selected=true` par beat, fallback au plus récent

### 2024-11-xx - Auto-adjustments V2
- **Commit**: `070217a`
- **Changement**: Séparation `auto_adjustments` vs `user_adjustments` avec timestamps
- **Pourquoi**: Distinguer les ajustements calculés par IA de ceux modifiés par l'utilisateur
- **Règle établie**: `user > auto` SI `user.updated_at > auto.updated_at`

### 2024-11-xx - Resize 9:16 APRÈS concat
- **Commit**: `08f7d82`
- **Changement**: Le resize est fait dans une étape séparée après le concat
- **Pourquoi**: Mettre le resize dans le concat causait `INTERNAL_COMMAND_ERROR`
- **Règle établie**: Concat d'abord (preset ipad-high), resize ensuite

### 2024-11-xx - Transloadit au lieu de fal.ai compose
- **Commit**: `04c0851`
- **Changement**: Utilisation de Transloadit pour la concaténation
- **Pourquoi**: fal.ai compose ne respectait pas les timestamps, causant des vidéos mal coupées
- **Règle établie**: Toujours utiliser Transloadit pour concat avec ré-encodage forcé

### 2024-11-xx - Normalisation timestamps FFmpeg
- **Commit**: `698152f`
- **Changement**: Ajout de `setpts=PTS-STARTPTS` avant chaque trim
- **Pourquoi**: Les vidéos Veo ont des timestamps qui ne commencent pas à 0
- **Règle établie**: Toujours normaliser AVANT trim, puis après trim, puis après speed

### 2024-11-xx - Balance négative autorisée
- **Commit**: `f0852cd`
- **Changement**: La balance de crédits peut être négative
- **Pourquoi**: Une génération déjà payée côté fal.ai DOIT être facturée même en race condition
- **Règle établie**: Vérifier crédits AVANT, mais autoriser le négatif après

### 2024-11-xx - Préservation vidéos en step5
- **Commit**: `7390684`
- **Changement**: Les vidéos existantes ne sont jamais écrasées lors de la sauvegarde en step5
- **Pourquoi**: Retourner à step5 effaçait les vidéos générées en step6
- **Règle établie**: Toujours vérifier `video.raw_url || video.final_url` avant d'écraser

### 2024-11-xx - Instructions négatives sur l'accent
- **Commit**: `5b7c01b`
- **Changement**: Suppression des instructions négatives dans les prompts Claude
- **Pourquoi**: "Don't use Canadian accent" → Claude fait l'inverse
- **Règle établie**: Formuler positivement : "Use French from France (metropolitan)"

---

## Comment ajouter une entrée

```markdown
### YYYY-MM-DD - Titre court
- **Commit**: `xxxxxxx`
- **Changement**: Description du changement
- **Pourquoi**: Raison / problème résolu
- **Règle établie**: Ce qu'il faut retenir pour le futur
```

---

*Dernière mise à jour : 10 décembre 2025*

