---
name: ""
overview: Localiser tout le reste (Step4, Step5, Step6, admin) de façon exhaustive en restant texte-only, sans toucher la logique métier ni les structures clés.
todos: []
---

# Plan i18n – Reste à couvrir (Step4, Step5, Step6, Admin)

## 1) Préparation clés i18n

- Ajouter/compléter les espaces de noms dans `messages/*` : `step4`, `step5`, `step6`, `admin.*`, plus clés transverses manquantes (statuts, CTA, erreurs, tooltips).
- Assurer la cohérence des clés entre locales (mêmes clés, valeurs traduites).

## 2) Step4 (brief) – Formulaire & CTA (textes uniquement)

- Fichier: `components/steps/step4-brief.tsx`.
- Header, CTA Retour/Continuer.
- Labels/placeholder des inputs: produit/offre (`what_selling`), pain point, audience, benefits, angle, objections, offers.
- Sélecteurs: durée (`target_duration`), langue (`language`), produit (avec/sans), éventuels checkboxes (ex: produit offert?).
- Warnings/helps liés au produit/langue/durée/credits.

## 3) Step4 – Génération/états (textes uniquement)

- Overlays/animations (phases script/images, beats, barres de progression).
- Messages de status “création en cours”, “écriture du script”, “préparation des visuels”.
- Erreurs d’extraction URL, erreurs de génération, messages vides/états d’erreur, CTA associés.
- Boutons de reprise/annulation éventuels, labels des sections “versions/first frames” si présents.

## 4) Step5 (plan) – Textes uniquement

- Fichier: `components/steps/step5-plan.tsx`.
- Titres/CTA (valider, régénérer, continuer), tooltips éventuels.
- Labels/colonnes de tableau, statuts, warnings (critiques : laisser logique intacte).
- Messages d’erreur/empty state.

## 5) Step6 (generate) – Textes uniquement

- Fichier: `components/steps/step6-generate.tsx`.
- Titres/CTA (générer, regénérer, assembler, télécharger), statuts, timers.
- Badges et labels (beats, durée, vitesse), tooltips, messages de complétion/échec.
- États vides/erreurs et actions associées. Respect strict des règles UI (pas de changement de logique/map/key/disabled/onClick).

## 6) Admin UI – Labels/Titres (textes seulement)

- Pages admin (actors, presets, prompts, logs, billing admin). Fichiers `app/[locale]/(admin)/admin/...`.
- Localiser uniquement titres/CTA/labels statiques, pas de logique ni de formulaires modifiés.

## 7) Harmonisation & QA

- Vérifier que toutes les locales contiennent les mêmes clés (fr/en/es/de/it/pt/nl).
- Contrôler les formats de dates/nombres (utiliser locale courante lorsque affiché dans les textes ajoutés).
- Lints sur fichiers modifiés (step4, step5, step6, admin pages, messages/*).
- Sanity check visuel (rapide) pour s’assurer qu’aucune chaîne dure n’est oubliée dans les zones touchées.

## 8) Invariants / garde-fous

- Aucune modification de logique, de callbacks, de `key`, de `onClick/disabled`, ni de structure `.map()`/`useEffect`.
- Textes uniquement via `t()`/`getTranslations`, laisser les données et états intacts.
- Ne pas toucher aux prompts métier ou calculs (crédits, génération).