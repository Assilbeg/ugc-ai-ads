'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { NewCampaignState, CampaignClip, ClipStatus, ClipAdjustments, ClipVersionAction, ClipVersion, AutoAdjustments, UserAdjustments, getEffectiveAdjustments } from '@/types'
import { useVideoGeneration, RegenerateWhat, VideoQuality, GenerationProgress } from '@/hooks/use-video-generation'
import { useCredits } from '@/hooks/use-credits'
import { triggerCreditsRefresh } from '@/components/credits-display'
import { useActors } from '@/hooks/use-actors'
import { useCampaignCreation } from '@/hooks/use-campaign-creation'
import { getPresetById } from '@/lib/presets'
import { createClient } from '@/lib/supabase/client'
import { calculateAdjustedDuration, calculateSyllablesPerSecond } from '@/lib/api/video-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Loader2, Play, X, Video, Mic, Music, Maximize2, Clock, Scissors, Gauge, Eye, Check, RefreshCw, Film, Sparkles, Zap, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { UpgradeModal } from '@/components/modals/upgrade-modal'
import { FirstPurchaseModal } from '@/components/modals/first-purchase-modal'

// Messages rotatifs pour l'assemblage
const ASSEMBLY_MESSAGE_KEYS = [
  'assembly.messages.upload',
  'assembly.messages.adjust',
  'assembly.messages.merge',
  'assembly.messages.optimize',
  'assembly.messages.finish',
]

// Helper: un seul clip par beat (is_selected prioritaire, sinon le plus récent)
function getPrimaryClips(clips: CampaignClip[] = []): CampaignClip[] {
  const byBeat = new Map<number, CampaignClip[]>()
  clips.forEach(c => {
    const list = byBeat.get(c.order) || []
    list.push(c)
    byBeat.set(c.order, list)
  })
  return Array.from(byBeat.entries())
    .sort(([a], [b]) => a - b)
    .map(([_, list]) => {
      const selected = list.find(c => c.is_selected)
      if (selected) return selected
      return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    })
    .filter(Boolean) as CampaignClip[]
}

// Composant Modale d'assemblage
function AssemblyModal({ isOpen, clipCount }: { isOpen: boolean; clipCount: number }) {
  const [messageIndex, setMessageIndex] = useState(0)
  const [dots, setDots] = useState('')
  const t = useTranslations('step6')

  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % ASSEMBLY_MESSAGE_KEYS.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)
    return () => clearInterval(interval)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div className="relative bg-background rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-border">
        {/* Animation */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border-4 border-violet-200 animate-ping opacity-20" />
            </div>
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl shadow-violet-500/30">
              <Film className="w-10 h-10 text-white animate-pulse" />
            </div>
          </div>
        </div>

        {/* Titre */}
        <h2 className="text-xl font-bold text-center text-foreground mb-2">
          {t('assembly.title')}
        </h2>

        {/* Message rotatif */}
        <p className="text-center text-muted-foreground mb-6 h-6">
          {t(ASSEMBLY_MESSAGE_KEYS[messageIndex] as any)}{dots}
        </p>

        {/* Info */}
        <div className="bg-muted/50 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-violet-500" />
              <span>{t('assembly.clipCount', { count: clipCount })}</span>
            </div>
            <div className="text-muted-foreground">•</div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{t('assembly.withAdjustments')}</span>
            </div>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="w-full">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
              style={{
                animation: 'assemblyProgress 2s ease-in-out infinite',
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            {t('assembly.hint')}
          </p>
        </div>

        <style jsx>{`
          @keyframes assemblyProgress {
            0% { width: 0%; margin-left: 0%; }
            50% { width: 60%; margin-left: 20%; }
            100% { width: 0%; margin-left: 100%; }
          }
        `}</style>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// HELPER: S'assurer que le script est TOUJOURS dans le video.prompt
// Le prompt DOIT contenir le script avec le format: 
// "speaks in ... accent: [SCRIPT]" ou "[SCRIPT OVERRIDE]: ..."
// ══════════════════════════════════════════════════════════════
function replaceScriptInPrompt(originalPrompt: string, oldScript: string, newScript: string): string {
  if (!originalPrompt) {
    // Pas de prompt original → créer un prompt minimal avec le script
    console.warn('[replaceScriptInPrompt] No original prompt, creating minimal prompt with script')
    return `speaks in standard metropolitan French accent, Parisian pronunciation, clear and neutral: ${newScript}`
  }
  
  // Vérifier si le prompt contient DÉJÀ le nouveau script
  if (originalPrompt.includes(newScript)) {
    console.log('[replaceScriptInPrompt] ✓ Prompt already contains the new script')
    return originalPrompt
  }
  
  // Le prompt ne contient PAS le nouveau script → on doit l'ajouter/remplacer
  
  // Méthode 1: Replace direct de l'ancien script par le nouveau
  if (oldScript && oldScript !== newScript && originalPrompt.includes(oldScript)) {
    const updatedPrompt = originalPrompt.replace(oldScript, newScript)
    console.log('[replaceScriptInPrompt] ✓ Direct replace succeeded')
    return updatedPrompt
  }
  
  console.warn('[replaceScriptInPrompt] Direct replace failed, trying regex pattern...')
  
  // Méthode 2: Chercher le pattern avec instruction d'accent et remplacer
  // Pattern: "speaks in ... accent, ... pronunciation, clear and neutral: [script]"
  const accentPattern = /(speaks in[^:]+:)\s*/g
  const matches = [...originalPrompt.matchAll(accentPattern)]
  
  if (matches.length > 0) {
    // Trouver la dernière occurrence du pattern d'accent
    const lastMatch = matches[matches.length - 1]
    const accentEndIndex = lastMatch.index! + lastMatch[0].length
    
    // Le script commence après "clear and neutral: " et peut finir avant la prochaine section
    const afterAccent = originalPrompt.substring(accentEndIndex)
    const beforeAccent = originalPrompt.substring(0, accentEndIndex)
    
    // Trouver où finit le script (après le texte parlé)
    // Chercher la fin: généralement avant "NEGATIVES:" ou une section majeure
    const endMarkers = ['NEGATIVES:', '\n\n', 'Sound:', 'Background:', '\n7.', '\n8.']
    let scriptEndIndex = afterAccent.length
    for (const marker of endMarkers) {
      const markerIndex = afterAccent.indexOf(marker)
      if (markerIndex !== -1 && markerIndex < scriptEndIndex) {
        scriptEndIndex = markerIndex
      }
    }
    
    const afterScript = afterAccent.substring(scriptEndIndex)
    const updatedPrompt = beforeAccent + newScript + afterScript
    console.log('[replaceScriptInPrompt] ✓ Replaced using accent pattern method')
    return updatedPrompt
  }
  
  // Méthode 3: Aucun pattern trouvé → AJOUTER le script avec le format standard
  // C'est CRITIQUE car le prompt original ne contenait peut-être jamais le script !
  console.warn('[replaceScriptInPrompt] No accent pattern found, ADDING script with standard format')
  
  // Chercher où insérer (avant NEGATIVES si présent, sinon à la fin)
  const negativesIndex = originalPrompt.indexOf('NEGATIVES:')
  const negativePromptIndex = originalPrompt.indexOf('Negative prompt:')
  const insertIndex = negativesIndex !== -1 ? negativesIndex : 
                      negativePromptIndex !== -1 ? negativePromptIndex : 
                      originalPrompt.length
  
  const beforeInsert = originalPrompt.substring(0, insertIndex).trimEnd()
  const afterInsert = originalPrompt.substring(insertIndex)
  
  // Ajouter le script avec le format standard
  const scriptSection = `\n\nSpeech/Dialogue: speaks in standard metropolitan French accent, Parisian pronunciation, clear and neutral: "${newScript}"\n\n`
  
  return beforeInsert + scriptSection + afterInsert
}

// Vitesses disponibles (UGC TikTok = dynamique, JAMAIS de ralentissement)
// On n'utilise JAMAIS 0.8x ou 0.9x - ça tue l'énergie du contenu
const SPEED_OPTIONS = [
  { value: 1.0, label: '1x' },
  { value: 1.1, label: '1.1x' },
  { value: 1.2, label: '1.2x' },
]

// Garantit une vitesse minimum de 1.0 (pas de ralentissement)
const ensureMinSpeed = (speed: number): number => Math.max(1.0, speed)

// Helper pour obtenir la clé d'un clip (pour les ajustements)
// Utilise clip.id si disponible, sinon un ID temporaire basé sur l'order
// IMPORTANT: Cette clé doit être cohérente entre l'initialisation et l'UI
const getClipKey = (clip: { id?: string; order: number } | null | undefined): string => {
  if (!clip) return ''
  return clip.id || `temp-order-${clip.order}`
}

interface Step6GenerateProps {
  state: NewCampaignState
  onClipsUpdate: (clips: CampaignClip[]) => void
  onComplete: (campaignId: string) => void
  onBack: () => void
}

const BEAT_LABEL_KEYS: Record<string, string> = {
  hook: 'beats.hook',
  problem: 'beats.problem',
  agitation: 'beats.agitation',
  solution: 'beats.solution',
  proof: 'beats.proof',
  cta: 'beats.cta',
}

// Palette plus sobre et professionnelle
const BEAT_COLORS: Record<string, string> = {
  hook: 'bg-slate-800',
  problem: 'bg-rose-600/90',
  agitation: 'bg-amber-600/90',
  solution: 'bg-emerald-600/90',
  proof: 'bg-sky-600/90',
  cta: 'bg-violet-600/90',
}

const STATUS_STEPS = [
  { status: 'generating_video', labelKey: 'status.video', icon: Video, color: 'text-blue-500' },
  { status: 'generating_voice', labelKey: 'status.voice', icon: Mic, color: 'text-violet-500' },
  { status: 'generating_ambient', labelKey: 'status.ambient', icon: Music, color: 'text-fuchsia-500' },
]

export function Step6Generate({ state, onClipsUpdate, onComplete, onBack }: Step6GenerateProps) {
  const t = useTranslations('step6')
  const tCommon = useTranslations('common')
  const { getActorById } = useActors()
  const { generating, isClipRegenerating, progress, generateAllClips, regenerateSingleClip, cancel, getOverallProgress } = useVideoGeneration()
  const { saving } = useCampaignCreation()
  const { credits, checkMultipleCredits, refetch: refetchCredits } = useCredits()
  const supabase = createClient()
  
  const actor = state.actor_id ? getActorById(state.actor_id) : undefined
  const preset = state.preset_id ? getPresetById(state.preset_id) : undefined
  const clips = state.generated_clips || []
  
  // Vérifier si des vidéos ont déjà été générées (clips avec raw_url OU final_url)
  const hasExistingVideos = clips.some(c => c.video?.raw_url || c.video?.final_url)
  
  // La campagne est déjà "started" si elle a un status qui indique une génération passée
  const campaignAlreadyStarted = state.campaign_status === 'completed' || 
                                  state.campaign_status === 'generating' || 
                                  state.campaign_status === 'assembling' ||
                                  state.campaign_status === 'failed'
  
  // Initialiser avec les clips existants s'ils ont des vidéos OU si la campagne est déjà complétée
  const [generatedClips, setGeneratedClips] = useState<CampaignClip[]>(() => {
    return (hasExistingVideos || campaignAlreadyStarted) ? clips : []
  })
  
  // Resynchroniser generatedClips quand state.generated_clips change
  // (ex: quand on revient de step5 avec des first frames modifiées)
  // Note: On fusionne par ID et beat, PAS par index (car on a plusieurs versions par beat)
  // CRITIQUE: Si le plan a invalidé la vidéo (raw_url = undefined), on prend le clip du plan
  // pour utiliser le nouveau video.prompt. Voir CRITICAL_BEHAVIORS.md §8.2
  useEffect(() => {
    if (clips.length > 0) {
      // Créer une map des clips existants par ID pour une fusion rapide
      const existingById = new Map(generatedClips.map(c => [c.id, c]))
      
      // Fusionner les nouvelles données avec les vidéos générées existantes
      const mergedClips = clips.map(clip => {
        const existingGenerated = existingById.get(clip.id)
        
        // ══════════════════════════════════════════════════════════════
        // FIX: Si le plan a invalidé la vidéo (raw_url = undefined),
        // NE PAS garder l'ancienne vidéo du state local. Cela arrive quand
        // le script ou le prompt visuel a été modifié en step5.
        // On doit prendre le clip du plan avec son nouveau video.prompt.
        // ══════════════════════════════════════════════════════════════
        if (!clip.video?.raw_url && !clip.video?.final_url) {
          return clip
        }
        
        // Si on a une vidéo générée existante, garder les données de génération
        // mais mettre à jour first_frame, script ET video.prompt
        if (existingGenerated?.video?.raw_url || existingGenerated?.video?.final_url) {
          return {
            ...existingGenerated,
            first_frame: clip.first_frame, // Toujours prendre la first frame la plus récente
            script: clip.script, // Prendre le script mis à jour aussi
            video: {
              ...existingGenerated.video,
              prompt: clip.video?.prompt || existingGenerated.video?.prompt, // Prendre le prompt du plan si mis à jour
            },
          }
        }
        return clip
      })
      
      // Ne mettre à jour que si quelque chose a changé (comparer les IDs et les données clés)
      const hasChanges = mergedClips.length !== generatedClips.length || 
        mergedClips.some(clip => {
          const existing = existingById.get(clip.id)
          return !existing || 
                 clip.first_frame?.image_url !== existing.first_frame?.image_url ||
                 clip.script?.text !== existing.script?.text
        })
      
      if (hasChanges) {
        console.log('[Step6] Resync clips from state:', {
          total: mergedClips.length,
          selected: mergedClips.filter(c => c.is_selected).length,
          versions: mergedClips.filter(c => !c.is_selected).length
        })
        setGeneratedClips(mergedClips)
      }
    }
  }, [clips])
  const [campaignId, setCampaignId] = useState<string | null>(state.campaign_id || null)
  const [started, setStarted] = useState(hasExistingVideos || campaignAlreadyStarted) // Déjà "started" si on a des vidéos OU si la campagne est completed/generating
  const [fullscreenVideo, setFullscreenVideo] = useState<string | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  
  // Ajustements vidéo (trim + vitesse) par clip - clé = clip.id (unique par version)
  const [adjustments, setAdjustments] = useState<Record<string, ClipAdjustments>>({})
  const [previewingClip, setPreviewingClip] = useState<string | null>(null) // clip.id pour la preview
  const [assembling, setAssembling] = useState(false)
  
  // Modal de confirmation pour régénération
  // FIX: Utiliser beatOrder au lieu de clipIndex pour éviter le bug d'index
  // (voir CRITICAL_BEHAVIORS.md section 12)
  const [confirmRegen, setConfirmRegen] = useState<{
    beatOrder: number // FIX: L'order du beat, pas l'index dans le tableau
    what: RegenerateWhat
    label: string
    warning?: string
    clipToRegenerate?: CampaignClip // Clip avec les dernières modifications (script, prompt, etc.)
  } | null>(null)
  
  // Qualité vidéo sélectionnée
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('fast')
  
  // Analyse de clips (transcription + auto-trim) - clé = clip.id
  const [analyzingClips, setAnalyzingClips] = useState<Set<string>>(new Set())
  
  // Modal d'achat de crédits
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [creditsNeeded, setCreditsNeeded] = useState<{ required: number; current: number } | null>(null)
  const [isFirstPurchase, setIsFirstPurchase] = useState(false)
  const [checkingCredits, setCheckingCredits] = useState(false)
  
  // ══════════════════════════════════════════════════════════════
  // ÉDITION DU SCRIPT (ce que dit l'acteur)
  // ══════════════════════════════════════════════════════════════
  const [editingScript, setEditingScript] = useState<number | null>(null) // beat order en édition
  const [editScriptText, setEditScriptText] = useState('')
  
  // ══════════════════════════════════════════════════════════════
  // VERSIONING: Navigation entre versions de clips
  // ══════════════════════════════════════════════════════════════
  const [displayedVersionIndex, setDisplayedVersionIndex] = useState<Record<number, number>>({})
  
  // Source d'affichage robuste : garder le state local mais réinjecter
  // les beats générés du parent s'ils disparaissent du state local (race React)
  const clipsForDisplay = useMemo(() => {
    if (generatedClips.length === 0) return clips

    const ordersWithVideo = new Set<number>()
    generatedClips.forEach(c => {
      if (c?.order !== undefined && (c.video?.raw_url || c.video?.final_url)) {
        ordersWithVideo.add(c.order)
      }
    })

    const missingWithVideo = clips.filter(c => {
      if (c?.order === undefined) return false
      if (!c.video?.raw_url && !c.video?.final_url) return false
      return !ordersWithVideo.has(c.order)
    })

    if (missingWithVideo.length === 0) return generatedClips
    return [...generatedClips, ...missingWithVideo]
  }, [generatedClips, clips])

  // Grouper les clips par beat (pour afficher toutes les versions)
  const clipsByBeat = useMemo(() => {
    const map = new Map<number, CampaignClip[]>()
    clipsForDisplay.forEach(c => {
      if (!c?.video?.raw_url && !c?.video?.final_url) return // Ignorer clips sans vidéo
      const list = map.get(c.order) || []
      list.push(c)
      // Trier par is_selected d'abord, puis par date de création décroissante
      // Cela garantit que le clip sélectionné est toujours à l'index 0
      map.set(c.order, list.sort((a, b) => {
        // Priorité 1: is_selected = true en premier
        if (a.is_selected && !b.is_selected) return -1
        if (!a.is_selected && b.is_selected) return 1
        // Priorité 2: plus récent en premier
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }))
    })
    return map
  }, [clipsForDisplay])
  
  // Liste des beats UNIQUES pour l'affichage (un par order)
  // On prend le clip le plus représentatif par beat (selected ou plus récent)
  // Cela évite d'afficher plusieurs tuiles pour le même beat
  const uniqueBeats = useMemo(() => {
    // Utiliser les clips du plan original comme base
    const seenOrders = new Set<number>()
    const result: CampaignClip[] = []
    
    // D'abord, prendre les clips du plan (state.generated_clips)
    clips.forEach(c => {
      if (!seenOrders.has(c.order)) {
        seenOrders.add(c.order)
        result.push(c)
      }
    })
    
    // Trier par order
    return result.sort((a, b) => a.order - b.order)
  }, [clips])

  // Initialiser les ajustements quand les clips changent
  // LOGIQUE V2: user_adjustments > auto_adjustments (si timestamp plus récent)
  // IMPORTANT: Utiliser clip.id comme clé (unique par version de clip)
  // NOTE: Ne PAS inclure 'adjustments' dans les dépendances pour éviter boucle infinie
  useEffect(() => {
    const clipsToUse = generatedClips.length > 0 ? generatedClips : clips
    
    // Utiliser setAdjustments avec prev pour éviter la dépendance sur adjustments
    setAdjustments(prev => {
      const newAdjustments: Record<string, ClipAdjustments> = { ...prev }
      let hasChanges = false
      
      clipsToUse.forEach((clip) => {
        // IMPORTANT: Utiliser le helper getClipKey pour cohérence avec l'UI
        const clipId = getClipKey(clip)
        if (!clipId) return
        
        // Utiliser la durée de la vidéo générée si disponible
        const videoDuration = clip?.video?.duration
        if (!videoDuration) return
        
        // ═══════════════════════════════════════════════════════════════
        // V2: Utiliser getEffectiveAdjustments pour déterminer la source
        // Priorité: user_adjustments (si plus récent) > auto_adjustments > default
        // ═══════════════════════════════════════════════════════════════
        const effective = getEffectiveAdjustments(
          clip.auto_adjustments,
          clip.user_adjustments,
          videoDuration
        )
        
        // Vérifier si les ajustements ont changé
        const current = prev[clipId]
        const hasChanged = !current || 
          current.trimStart !== effective.trimStart ||
          current.trimEnd !== effective.trimEnd ||
          current.speed !== effective.speed
        
        if (hasChanged) {
          console.log(`[Adjustments] ✓ Loading ${effective.source} adjustments for clip id=${clipId} (order=${clip.order})`)
          newAdjustments[clipId] = {
            trimStart: effective.trimStart,
            trimEnd: effective.trimEnd,
            speed: ensureMinSpeed(effective.speed),
          }
          hasChanges = true
        }
        
        // ═══════════════════════════════════════════════════════════════
        // MIGRATION: Quand le clip obtient son vrai ID (après sauvegarde BDD),
        // copier les ajustements du temp-order vers le vrai ID
        // ET sauvegarder en BDD si des modifications ont été faites
        // ═══════════════════════════════════════════════════════════════
        if (clip.id) {
          const tempKey = `temp-order-${clip.order}`
          // Si on a des ajustements sous la clé temp mais pas sous le vrai ID
          if (prev[tempKey] && !newAdjustments[clip.id] && !prev[clip.id]) {
            console.log(`[Adjustments] ✓ Migrating from ${tempKey} to ${clip.id}`)
            newAdjustments[clip.id] = prev[tempKey]
            hasChanges = true
            
            // Sauvegarder en BDD les ajustements migrés (async, fire-and-forget)
            // Cela garantit que les modifications faites sur temp-order sont persistées
            const migratedAdj = prev[tempKey]
            if (migratedAdj) {
              const userAdj = {
                trim_start: migratedAdj.trimStart,
                trim_end: migratedAdj.trimEnd,
                speed: migratedAdj.speed,
                updated_at: new Date().toISOString(),
              }
              // Note: On ne peut pas appeler saveUserAdjustmentsToDb ici (pas dans les deps)
              // Donc on fait l'appel Supabase directement
              ;(supabase.from('campaign_clips') as any)
                .update({ user_adjustments: userAdj, adjustments: migratedAdj })
                .eq('id', clip.id)
                .then(() => console.log(`[Adjustments] ✓ Migrated adjustments saved to DB for ${clip.id}`))
            }
          }
        }
        
        // ═══════════════════════════════════════════════════════════════
        // FALLBACK LEGACY: Si pas de V2 mais ancien adjustments existe
        // ═══════════════════════════════════════════════════════════════
        if (!clip.auto_adjustments && !clip.user_adjustments && clip.adjustments) {
          const clipAdjustments: ClipAdjustments = {
            trimStart: clip.adjustments.trimStart,
            trimEnd: clip.adjustments.trimEnd,
            speed: ensureMinSpeed(clip.adjustments.speed || 1.0),
            processedUrl: clip.adjustments.processedUrl,
          }
          
          const currentLegacy = prev[clipId]
          const hasChangedLegacy = !currentLegacy || 
            currentLegacy.trimStart !== clipAdjustments.trimStart ||
            currentLegacy.trimEnd !== clipAdjustments.trimEnd ||
            currentLegacy.speed !== clipAdjustments.speed
          
          if (hasChangedLegacy) {
            console.log(`[Adjustments] ✓ Loading LEGACY adjustments for clip id=${clipId}`)
            newAdjustments[clipId] = clipAdjustments
            hasChanges = true
          }
        }
      })
      
      // Ne retourner un nouvel objet que si quelque chose a changé
      return hasChanges ? newAdjustments : prev
    })
  }, [clips.length, generatedClips]) // Retiré 'adjustments' des dépendances

  // Sauvegarder un ajustement LEGACY en BDD (pour compatibilité)
  const saveAdjustmentToDb = useCallback(async (clipId: string, adjustment: ClipAdjustments) => {
    if (!clipId) return
    
    try {
      const { error } = await (supabase
        .from('campaign_clips') as any)
        .update({ adjustments: adjustment })
        .eq('id', clipId)
      
      if (error) {
        console.error('[Adjustments] Failed to save LEGACY to DB:', error)
      } else {
        console.log('[Adjustments] ✓ Saved LEGACY to DB for clip:', clipId)
      }
    } catch (err) {
      console.error('[Adjustments] Error saving LEGACY to DB:', err)
    }
  }, [supabase])

  // V2: Sauvegarder user_adjustments en BDD (modifications utilisateur)
  const saveUserAdjustmentsToDb = useCallback(async (clipId: string, userAdj: UserAdjustments) => {
    if (!clipId) return
    
    try {
      const { error } = await (supabase
        .from('campaign_clips') as any)
        .update({ user_adjustments: userAdj })
        .eq('id', clipId)
      
      if (error) {
        console.error('[Adjustments] Failed to save user_adjustments to DB:', error)
      } else {
        console.log('[Adjustments] ✓ Saved user_adjustments to DB for clip:', clipId, 'at', userAdj.updated_at)
      }
    } catch (err) {
      console.error('[Adjustments] Error saving user_adjustments to DB:', err)
    }
  }, [supabase])

  // ══════════════════════════════════════════════════════════════
  // VERSIONING: Archiver une version de clip avant régénération
  // ══════════════════════════════════════════════════════════════
  const archiveClipVersion = useCallback(async (
    clip: CampaignClip, 
    action: ClipVersionAction
  ): Promise<number> => {
    // Si le clip n'a pas d'ID valide, on ne peut pas archiver
    const hasValidId = clip.id && !clip.id.startsWith('temp-') && !clip.id.startsWith('clip-')
    if (!hasValidId) {
      console.log('[Version] Clip has no valid ID, skipping archive')
      return 1 // Première version
    }

    // Ne pas archiver si pas de vidéo générée (rien à sauvegarder)
    if (!clip.video?.raw_url && !clip.video?.final_url) {
      console.log('[Version] Clip has no video, skipping archive')
      return clip.current_version || 1
    }

    try {
      // Récupérer le numéro de version actuel
      const currentVersion = clip.current_version || 1
      const newVersion = currentVersion + 1

      // Créer l'archive de la version actuelle
      const versionData = {
        clip_id: clip.id,
        version_number: currentVersion,
        first_frame: clip.first_frame,
        script: clip.script,
        video: clip.video,
        audio: clip.audio || {},
        transcription: clip.transcription || null,
        adjustments: clip.adjustments || null,
        created_by_action: action,
      }

      const { error: insertError } = await (supabase
        .from('clip_versions') as any)
        .insert(versionData)

      if (insertError) {
        // Si la version existe déjà (contrainte unique), c'est OK
        if (!insertError.message?.includes('unique_clip_version')) {
          console.error('[Version] Error archiving version:', insertError)
        }
      } else {
        console.log(`[Version] ✓ Archived version ${currentVersion} for clip ${clip.order}`)
      }

      // Mettre à jour le numéro de version dans le clip
      await (supabase
        .from('campaign_clips') as any)
        .update({ current_version: newVersion })
        .eq('id', clip.id)

      return newVersion
    } catch (err) {
      console.error('[Version] Error:', err)
      return clip.current_version || 1
    }
  }, [supabase])

  // Récupérer l'historique des versions d'un clip
  const getClipVersions = useCallback(async (clipId: string): Promise<ClipVersion[]> => {
    if (!clipId) return []

    try {
      const { data, error } = await (supabase
        .from('clip_versions') as any)
        .select('*')
        .eq('clip_id', clipId)
        .order('version_number', { ascending: false })

      if (error) {
        console.error('[Version] Error fetching versions:', error)
        return []
      }

      return data || []
    } catch (err) {
      console.error('[Version] Error:', err)
      return []
    }
  }, [supabase])

  // Restaurer une version précédente
  const restoreClipVersion = useCallback(async (
    clipId: string, 
    version: ClipVersion
  ): Promise<CampaignClip | null> => {
    if (!clipId || !version) return null

    try {
      // D'abord, archiver la version actuelle
      const { data: currentClip } = await (supabase
        .from('campaign_clips') as any)
        .select('*')
        .eq('id', clipId)
        .single()

      if (currentClip) {
        await archiveClipVersion(currentClip as CampaignClip, 'regenerate_all')
      }

      // Restaurer les données de la version
      const { data: restoredClip, error } = await (supabase
        .from('campaign_clips') as any)
        .update({
          first_frame: version.first_frame,
          script: version.script,
          video: version.video,
          audio: version.audio,
          transcription: version.transcription,
          adjustments: version.adjustments,
          current_version: (currentClip?.current_version || version.version_number) + 1,
        })
        .eq('id', clipId)
        .select()
        .single()

      if (error) {
        console.error('[Version] Error restoring version:', error)
        return null
      }

      console.log(`[Version] ✓ Restored version ${version.version_number} for clip`)
      return restoredClip as CampaignClip
    } catch (err) {
      console.error('[Version] Error:', err)
      return null
    }
  }, [supabase, archiveClipVersion])

  // ══════════════════════════════════════════════════════════════
  // VERSIONING: Désélectionner tous les clips d'un beat sauf un
  // ══════════════════════════════════════════════════════════════
  const deselectOtherVersions = useCallback(async (clipId: string, beat: number) => {
    if (!campaignId) return
    
    try {
      // Mettre tous les clips du même beat à is_selected = false
      await (supabase
        .from('campaign_clips') as any)
        .update({ is_selected: false })
        .eq('campaign_id', campaignId)
        .eq('order', beat)
      
      // Mettre le clip choisi à is_selected = true
      await (supabase
        .from('campaign_clips') as any)
        .update({ is_selected: true })
        .eq('id', clipId)
        
      console.log(`[Versioning] ✓ Selected clip ${clipId} for beat ${beat}`)
    } catch (err) {
      console.error('[Versioning] Error selecting version:', err)
    }
  }, [campaignId, supabase])

  // ══════════════════════════════════════════════════════════════
  // VERSIONING: Naviguer entre les versions d'un beat
  // ══════════════════════════════════════════════════════════════
  const navigateVersion = useCallback((beat: number, direction: 'prev' | 'next') => {
    const versions = clipsByBeat.get(beat) || []
    if (versions.length <= 1) return
    
    const currentIndex = displayedVersionIndex[beat] || 0
    let newIndex: number
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : versions.length - 1
    } else {
      newIndex = currentIndex < versions.length - 1 ? currentIndex + 1 : 0
    }
    
    setDisplayedVersionIndex(prev => ({ ...prev, [beat]: newIndex }))
  }, [clipsByBeat, displayedVersionIndex])

  // ══════════════════════════════════════════════════════════════
  // VERSIONING: Sélectionner une version spécifique pour l'assemblage
  // ══════════════════════════════════════════════════════════════
  const selectVersion = useCallback(async (clipId: string, beat: number) => {
    if (!campaignId) return
    
    try {
      // ═══════════════════════════════════════════════════════════════
      // CAS 1: Version archivée (ID préfixé "version-")
      // Ces versions viennent de clip_versions et doivent être restaurées
      // ═══════════════════════════════════════════════════════════════
      if (clipId.startsWith('version-')) {
        const versionId = clipId.replace('version-', '')
        console.log(`[Versioning] Restoring archived version ${versionId}`)
        
        // Trouver la version archivée dans le state
        const archivedClip = generatedClips.find(c => c.id === clipId)
        if (!archivedClip) {
          console.error('[Versioning] Archived version not found in state')
          return
        }
        
        // Trouver le clip parent (celui qui a current_version le plus élevé pour ce beat)
        const parentClip = generatedClips
          .filter(c => c.order === beat && !c.id?.startsWith('version-'))
          .sort((a, b) => (b.current_version || 0) - (a.current_version || 0))[0]
        
        if (!parentClip) {
          console.error('[Versioning] Parent clip not found for beat', beat)
          return
        }
        
        // Récupérer les données de la version archivée
        const { data: versionData, error: versionError } = await (supabase
          .from('clip_versions') as any)
          .select('*')
          .eq('id', versionId)
          .single()
        
        if (versionError || !versionData) {
          console.error('[Versioning] Error fetching version data:', versionError)
          return
        }
        
        // Restaurer la version dans le clip parent
        const restored = await restoreClipVersion(parentClip.id, versionData)
        if (restored) {
          // Mettre à jour le state local avec le clip restauré
          setGeneratedClips(prev => prev.map(c => {
            if (c.id === parentClip.id) {
              return { ...restored, is_selected: true }
            }
            if (c.order === beat) {
              return { ...c, is_selected: false }
            }
            return c
          }))
          
          // Réinitialiser l'index affiché à 0 (le clip restauré sera trié en premier)
          setDisplayedVersionIndex(prev => ({
            ...prev,
            [beat]: 0
          }))
          
          console.log(`[Versioning] ✓ Restored archived version ${versionData.version_number} for beat ${beat}`)
        }
        return
      }
      
      // ═══════════════════════════════════════════════════════════════
      // CAS 2: Clip normal dans campaign_clips
      // ═══════════════════════════════════════════════════════════════
      
      // 1. Mettre tous les clips du même beat à is_selected = false
      await (supabase
        .from('campaign_clips') as any)
        .update({ is_selected: false })
        .eq('campaign_id', campaignId)
        .eq('order', beat)
      
      // 2. Mettre le clip choisi à is_selected = true
      await (supabase
        .from('campaign_clips') as any)
        .update({ is_selected: true })
        .eq('id', clipId)
      
      // 3. Mettre à jour le state local
      setGeneratedClips(prev => prev.map(c => ({
        ...c,
        is_selected: c.id === clipId ? true : (c.order === beat ? false : c.is_selected)
      })))
      
      // 4. Réinitialiser l'index affiché à 0 (le clip sélectionné sera trié en premier)
      setDisplayedVersionIndex(prev => ({
        ...prev,
        [beat]: 0
      }))
      
      console.log(`[Versioning] ✓ Selected version ${clipId} for beat ${beat}`)
    } catch (err) {
      console.error('[Versioning] Error selecting version:', err)
    }
  }, [campaignId, supabase, generatedClips, restoreClipVersion])

  // Mettre à jour un ajustement par clip.id (unique par version)
  // V2: Sauvegarde dans user_adjustments avec timestamp pour tracking
  const updateAdjustment = useCallback((clipId: string, update: Partial<ClipAdjustments>) => {
    if (!clipId) return
    
    // Vérifier si c'est un vrai ID ou une clé temporaire
    const isRealId = !clipId.startsWith('temp-order-')
    
    setAdjustments(prev => {
      const newAdjustment = { ...prev[clipId], ...update, isApplied: false }
      
      // Sauvegarder en BDD SEULEMENT si c'est un vrai ID
      if (isRealId) {
        // V2: Créer user_adjustments avec timestamp
        const userAdjustments: UserAdjustments = {
          trim_start: newAdjustment.trimStart,
          trim_end: newAdjustment.trimEnd,
          speed: newAdjustment.speed,
          updated_at: new Date().toISOString(),
        }
        
        // Sauvegarder user_adjustments en BDD (async)
        saveUserAdjustmentsToDb(clipId, userAdjustments)
        
        // LEGACY: Aussi sauvegarder dans adjustments pour compatibilité
        saveAdjustmentToDb(clipId, newAdjustment)
      } else {
        console.log(`[Adjustments] Skipping DB save for temp key: ${clipId}`)
      }
      
      return { ...prev, [clipId]: newAdjustment }
    })
  }, [saveAdjustmentToDb, saveUserAdjustmentsToDb])

  // Reset les ajustements aux valeurs IA (auto_adjustments) ou par défaut
  // V2: Supprime user_adjustments pour revenir aux valeurs auto
  const resetAdjustments = useCallback((clipId: string) => {
    if (!clipId) return
    
    // Trouver le clip par son ID
    const clip = [...clips, ...generatedClips].find(c => c?.id === clipId)
    if (!clip) return
    
    // V2: Utiliser auto_adjustments si disponible, sinon valeurs par défaut
    let resetAdjustment: ClipAdjustments
    if (clip.auto_adjustments) {
      resetAdjustment = {
        trimStart: clip.auto_adjustments.trim_start,
        trimEnd: clip.auto_adjustments.trim_end,
        speed: ensureMinSpeed(clip.auto_adjustments.speed),
      }
      console.log(`[Adjustments] Reset to AUTO values for clip id=${clipId}:`, resetAdjustment)
    } else {
      resetAdjustment = {
        trimStart: 0,
        trimEnd: clip.video?.duration || 6,
        speed: 1.0,
      }
      console.log(`[Adjustments] Reset to DEFAULT values for clip id=${clipId}:`, resetAdjustment)
    }
    
    setAdjustments(prev => ({
      ...prev,
      [clipId]: resetAdjustment
    }))
    
    // V2: Supprimer user_adjustments en BDD (revenir aux valeurs auto)
    // Supprimer user_adjustments (null)
    ;(supabase.from('campaign_clips') as any)
      .update({ user_adjustments: null })
      .eq('id', clipId)
      .then(({ error }: { error: Error | null }) => {
        if (error) {
          console.error('[Adjustments] Failed to reset user_adjustments:', error)
        } else {
          console.log('[Adjustments] ✓ Reset user_adjustments to null for clip:', clipId)
        }
      })
    
    // LEGACY: Aussi mettre à jour adjustments
    saveAdjustmentToDb(clipId, resetAdjustment)
  }, [clips, generatedClips, saveAdjustmentToDb, supabase])

  // ══════════════════════════════════════════════════════════════
  // VERSIONING: Sélectionner UN clip par beat pour l'assemblage
  // Priorité : is_selected = true, sinon le plus récent
  // ══════════════════════════════════════════════════════════════
  const getSelectedClipsForAssembly = useCallback((clipsToFilter: CampaignClip[]) => {
    const byBeat = new Map<number, CampaignClip[]>()
    
    // Grouper les clips avec vidéo par beat
    clipsToFilter.filter(c => c?.video?.raw_url || c?.video?.final_url).forEach(c => {
      const list = byBeat.get(c.order) || []
      list.push(c)
      byBeat.set(c.order, list)
    })
    
    // Pour chaque beat, prendre le clip sélectionné ou le plus récent
    return Array.from(byBeat.entries())
      .sort(([a], [b]) => a - b) // Trier par ordre de beat
      .map(([beat, versions]) => {
        // Priorité : is_selected, sinon le plus récent
        const selected = versions.find(v => v.is_selected)
        if (selected) {
          console.log(`[Assembly] Beat ${beat}: using selected clip ${selected.id}`)
          return selected
        }
        
        // Fallback : le plus récent
        const mostRecent = versions.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
        console.log(`[Assembly] Beat ${beat}: fallback to most recent clip ${mostRecent?.id}`)
        return mostRecent
      })
      .filter(Boolean)
  }, [])

  // Analyser un clip existant (transcription Whisper + analyse Claude)
  // Utile pour les clips générés avant l'ajout de cette feature
  // IMPORTANT: Utilise clipId (unique par version) pour être cohérent avec les ajustements
  const analyzeClip = useCallback(async (clipId: string) => {
    if (!clipId) return
    
    // Trouver le clip par son ID
    const clip = [...generatedClips, ...clips].find(c => c?.id === clipId)
    if (!clip?.video?.raw_url && !clip?.video?.final_url) {
      console.error('[Analyze] No video URL for clip id', clipId)
      return
    }

    setAnalyzingClips(prev => new Set([...prev, clipId]))

    try {
      const videoUrl = clip.video.final_url || clip.video.raw_url
      const response = await fetch('/api/generate/analyze-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipId: clip.id,
          videoUrl,
          originalScript: clip.script?.text,
          videoDuration: clip.video.duration,
        }),
      })

      if (!response.ok) {
        throw new Error('Analyse failed')
      }

      const result = await response.json()
      console.log('[Analyze] ✓ Clip id', clipId, 'analyzed:', result)

      // Mettre à jour le clip avec la transcription (par id)
      setGeneratedClips(prev => prev.map((c) => {
        if (c?.id === clipId) {
          return {
            ...c,
            transcription: {
              text: result.text,
              chunks: result.chunks,
              speech_start: result.speech_start,
              speech_end: result.speech_end,
              syllables_per_second: result.syllables_per_second,
              suggested_speed: result.suggested_speed,
            },
            // Aussi mettre à jour auto_adjustments
            auto_adjustments: {
              trim_start: Math.max(0, result.speech_start),
              trim_end: Math.min(result.speech_end, clip.video.duration),
              speed: ensureMinSpeed(result.suggested_speed || 1.0),
              updated_at: new Date().toISOString(),
            }
          }
        }
        return c
      }))

      // Appliquer les ajustements suggérés (par clip.id)
      if (result.speech_start !== undefined && result.speech_end !== undefined) {
        // Garder la précision max de Whisper pour un trim précis
        const trimStart = Math.max(0, result.speech_start)
        const trimEnd = Math.min(result.speech_end, clip.video.duration)
        const speed = ensureMinSpeed(result.suggested_speed || 1.0)

        setAdjustments(prev => ({
          ...prev,
          [clipId]: { trimStart, trimEnd, speed }
        }))
      }

    } catch (error) {
      console.error('[Analyze] Error:', error)
    } finally {
      setAnalyzingClips(prev => {
        const next = new Set(prev)
        next.delete(clipId)
        return next
      })
    }
  }, [clips, generatedClips])

  // Assembler la vidéo finale (applique les ajustements automatiquement)
  // Pré-traite les clips avec trim/speed via Transloadit (/api/generate/process-clip)
  const assembleVideo = useCallback(async () => {
    // ══════════════════════════════════════════════════════════════
    // VERSIONING: Utiliser la fonction de sélection pour prendre UN clip par beat
    // Priorité : is_selected = true, sinon le plus récent
    // ══════════════════════════════════════════════════════════════
    const selectedClips = getSelectedClipsForAssembly(generatedClips)
    
    console.log('[Assemble] Starting assembly...', {
      campaignId,
      generatedClipsCount: generatedClips.length,
      selectedClipsCount: selectedClips.length,
      selectedClipIds: selectedClips.map(c => ({ id: c.id, order: c.order, is_selected: c.is_selected }))
    })
    
    if (!campaignId) {
      console.error('[Assemble] No campaignId!')
      return
    }
    
    setAssembling(true)
    
    try {
      // Préparer les données avec les ajustements trim/speed
      // IMPORTANT: Utiliser clip.id comme clé (unique par version de clip)
      const clipsData = selectedClips
        .map((clip) => {
          // Récupérer les ajustements par clip.id (priorité) ou depuis auto_adjustments
          const adj = clip.id ? adjustments[clip.id] : undefined
          const autoAdj = clip.auto_adjustments
          const originalDuration = clip.video.duration || 6
          
          // Priorité: adjustments du state > auto_adjustments > valeurs par défaut
          const trimStart = adj?.trimStart ?? autoAdj?.trim_start ?? 0
          const trimEnd = adj?.trimEnd ?? autoAdj?.trim_end ?? originalDuration
          const speed = adj?.speed ?? autoAdj?.speed ?? 1.0
          const trimmedDuration = trimEnd - trimStart
          const duration = trimmedDuration / speed
          // TOUJOURS traiter avec Transloadit pour normaliser les timestamps
          // Les vidéos Veo ont des timestamps décalés qui causent des pertes de frames
          // lors du concat si on ne les normalise pas d'abord
          const needsProcessing = true
          
          return {
            clip,
            rawUrl: clip.video.final_url || clip.video.raw_url,
            duration,
            clipId: clip.id,
            clipOrder: clip.order,
            trimStart,
            trimEnd,
            speed,
            originalDuration,
            needsProcessing,
          }
        })
      
      // Pré-traiter TOUS les clips pour normaliser les timestamps
      // Les vidéos Veo ont des timestamps décalés qui causent des pertes de frames au concat
      const clipsNeedingProcessing = clipsData.filter(c => c.needsProcessing)
      
      console.log('[Assemble] Processing', clipsData.length, 'clips')
      console.log('[Assemble] Adjustments from state:', JSON.stringify(adjustments, null, 2))
      console.log('[Assemble] ClipsData with adjustments:', clipsData.map(c => ({
        order: c.clipOrder,
        trimStart: c.trimStart,
        trimEnd: c.trimEnd,
        speed: c.speed,
        originalDuration: c.originalDuration,
        calculatedDuration: c.duration
      })))
      console.log('[Assemble] Clips needing processing:', clipsNeedingProcessing.length)
      
      if (clipsNeedingProcessing.length > 0) {
        console.log('[Assemble] 🎬 Processing', clipsNeedingProcessing.length, 'clips with server-side FFmpeg...')
        
        // Collecter les erreurs de processing
        const processingErrors: { clipOrder: number; error: string }[] = []
        
        // Traiter en parallèle pour plus de rapidité
        await Promise.all(clipsNeedingProcessing.map(async (clipData) => {
          try {
            const payload = {
              videoUrl: clipData.rawUrl,
              trimStart: clipData.trimStart,
              trimEnd: clipData.trimEnd,
              speed: clipData.speed,
              duration: clipData.originalDuration,
            }
            console.log(`[Assemble] Processing clip ${clipData.clipOrder}:`, payload)
            
            const response = await fetch('/api/generate/process-clip', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })
            
            if (response.ok) {
              const result = await response.json()
              console.log(`[Assemble] Clip ${clipData.clipOrder} response:`, {
                processed: result.processed,
                hasUrl: !!result.videoUrl,
                newDuration: result.newDuration,
                originalDuration: result.originalDuration
              })
              if (result.processed && result.videoUrl) {
                console.log(`[Assemble] ✓ Clip ${clipData.clipOrder} processed:`, result.videoUrl.slice(0, 60))
                // Mettre à jour avec l'URL traitée - trim/speed déjà appliqués
                clipData.rawUrl = result.videoUrl
                clipData.trimStart = 0
                clipData.trimEnd = result.newDuration ?? clipData.duration
                clipData.speed = 1.0
                // IMPORTANT: Garder la duration calculée si newDuration n'est pas retourné
                clipData.duration = result.newDuration ?? clipData.duration
                clipData.needsProcessing = false
                console.log(`[Assemble] Clip ${clipData.clipOrder} after update:`, {
                  duration: clipData.duration,
                  newDurationFromApi: result.newDuration,
                  rawUrl: clipData.rawUrl?.slice(0, 50)
                })
              } else {
                console.warn(`[Assemble] ⚠️ Clip ${clipData.clipOrder} not processed:`, {
                  processed: result.processed,
                  hasUrl: !!result.videoUrl,
                  error: result.error
                })
                processingErrors.push({
                  clipOrder: clipData.clipOrder,
                  error: result.error || 'Échec du traitement'
                })
                // Garder la duration calculée même si le processing échoue
                console.log(`[Assemble] Keeping calculated duration for clip ${clipData.clipOrder}:`, clipData.duration)
              }
            } else {
              const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }))
              console.error(`[Assemble] ❌ Processing FAILED for clip ${clipData.clipOrder}:`, response.status, errorData)
              processingErrors.push({
                clipOrder: clipData.clipOrder,
                error: errorData.error || `HTTP ${response.status}`
              })
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue'
            console.warn(`[Assemble] ⚠️ Error processing clip ${clipData.clipOrder}:`, err)
            processingErrors.push({
              clipOrder: clipData.clipOrder,
              error: errorMsg
            })
          }
        }))
        
        // Si trop d'erreurs de processing, arrêter avant l'assemblage
        if (processingErrors.length > 0 && processingErrors.length >= clipsNeedingProcessing.length / 2) {
          const errorDetails = processingErrors
            .map(e => `Clip ${e.clipOrder}: ${e.error}`)
            .join('\n')
          throw new Error(`Échec du pré-traitement de ${processingErrors.length} clip(s):\n${errorDetails}`)
        }
        
        // Logger les erreurs mais continuer si moins de la moitié ont échoué
        if (processingErrors.length > 0) {
          console.warn(`[Assemble] ⚠️ ${processingErrors.length} clip(s) avec erreur de processing, mais on continue...`)
        }
      }
      
      // Préparer les clips pour l'assemblage final
      // Note: trim/speed déjà appliqués par Transloadit, donc on envoie juste les URLs
      console.log('[Assemble] clipsData BEFORE creating clipsForAssembly:',
        clipsData.map(c => ({ order: c.clipOrder, duration: c.duration, hasUrl: !!c.rawUrl }))
      )
      
      const clipsForAssembly = clipsData.map(({ rawUrl, duration, clipOrder }) => ({
        rawUrl,
        duration,
        clipOrder,
      }))
      
      console.log('[Assemble] Total clips:', clipsForAssembly.length)
      console.log('[Assemble] Adjustments state:', JSON.stringify(adjustments, null, 2))
      console.log('[Assemble] Clips for assembly:', JSON.stringify(clipsForAssembly, null, 2))
      console.log('[Assemble] Sending to API and waiting for response...')
      
      // 1. Mettre le status à "generating" AVANT tout (assembling n'est pas dans l'enum SQL)
      await (supabase.from('campaigns') as any)
        .update({ status: 'generating' })
        .eq('id', campaignId)
      
      // 2. Lancer l'assemblage et ATTENDRE LA RÉPONSE COMPLÈTE
      // C'est plus lent mais garantit que l'assemblage est bien fait
      const response = await fetch('/api/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clips: clipsForAssembly,
          campaignId
        })
      })
      
      const result = await response.json()
      console.log('[Assemble] API response:', response.status, result)
      
      // Afficher les infos de debug AVANT redirection
      if (result.debug?.processedClips) {
        console.log('[Assemble] ═══════════════════════════════════════')
        console.log('[Assemble] RÉSULTAT DES TRANSFORMATIONS:')
        result.debug.processedClips.forEach((clip: { clipOrder: number; urlUsed: string; hasTransforms: boolean }) => {
          console.log(`[Assemble]   Clip ${clip.clipOrder}: hasTransforms=${clip.hasTransforms}`)
          console.log(`[Assemble]   URL: ${clip.urlUsed}`)
        })
        console.log('[Assemble] ═══════════════════════════════════════')
        
        // Stocker dans localStorage pour debug sur la page suivante
        localStorage.setItem('lastAssemblyDebug', JSON.stringify({
          timestamp: new Date().toISOString(),
          videoUrl: result.videoUrl,
          clips: result.debug.processedClips
        }))
      }
      
      if (!response.ok) {
        // Gestion d'erreur améliorée avec détails
        let errorMessage = result.error || t('errors.assembly.default')
        
        // Si des clips invalides sont identifiés
        if (result.invalidClips?.length > 0) {
          const clipDetails = result.invalidClips
            .map((c: { clipOrder: number; error: string }) => `Clip ${c.clipOrder}: ${c.error}`)
            .join('\n')
          errorMessage = t('errors.assembly.invalidClips', {
            count: result.invalidClips.length,
            details: clipDetails,
          })
        }
        
        // Ajouter la suggestion si disponible
        if (result.suggestion) {
          errorMessage += `\n\n💡 ${result.suggestion}`
        }
        
        throw new Error(errorMessage)
      }
      
      // ✅ Mettre le status à "completed" AVANT la redirection
      await (supabase.from('campaigns') as any)
        .update({ status: 'completed' })
        .eq('id', campaignId)
      console.log('[Assemble] ✓ Campaign status set to completed')
      
      // Assemblage terminé ! Rediriger vers la page campagne
      console.log('[Assemble] ✅ Success! Redirecting to campaign page...')
      window.location.href = `/campaign/${campaignId}`
      
    } catch (err) {
      console.error('[Assemble] Error caught:', err)
      const errorMessage = err instanceof Error ? err.message : t('errors.assembly.unknown')
      
      // Afficher l'erreur de manière plus visible et formatée
      const formattedError = t('errors.assembly.alert', { message: errorMessage })
      alert(formattedError)
      
      setAssembling(false)
      // En cas d'erreur, mettre le status à failed
      await (supabase.from('campaigns') as any)
        .update({ status: 'failed' })
        .eq('id', campaignId)
    }
  }, [campaignId, generatedClips, adjustments, supabase, getSelectedClipsForAssembly])

  // ══════════════════════════════════════════════════════════════
  // SAUVEGARDE AUTOMATIQUE EN BASE
  // ══════════════════════════════════════════════════════════════
  
  // Créer la campagne en base
  const createCampaignInDb = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('User not authenticated')
        return null
      }

      const { data: campaign, error } = await (supabase
        .from('campaigns') as any)
        .insert({
          user_id: user.id,
          actor_id: state.actor_id,
          preset_id: state.preset_id,
          product: state.product,
          brief: state.brief,
          status: 'generating',
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating campaign:', error)
        return null
      }

      console.log('✓ Campaign created:', (campaign as any).id)
      return (campaign as any).id as string
    } catch (err) {
      console.error('Error creating campaign:', err)
      return null
    }
  }, [supabase, state.actor_id, state.preset_id, state.product, state.brief])

  // Sauvegarder les clips en base (UPSERT - met à jour si existe, insert sinon)
  // Utilise l'id du clip s'il existe, sinon cherche par campaign_id + order
  const saveClipsToDb = useCallback(async (dbCampaignId: string, clipsToSave: CampaignClip[]) => {
    if (!dbCampaignId || clipsToSave.length === 0) return

    setAutoSaveStatus('saving')
    const updatedClipsWithIds: CampaignClip[] = []

    try {
      for (const clip of clipsToSave) {
        const clipData = {
          campaign_id: dbCampaignId,
          order: clip.order,
          beat: clip.beat,
          first_frame: clip.first_frame,
          script: clip.script,
          video: clip.video,
          audio: clip.audio || {},
          transcription: clip.transcription || null,
          adjustments: clip.adjustments || null,        // LEGACY
          auto_adjustments: clip.auto_adjustments || null,  // V2: auto (Whisper/Claude)
          user_adjustments: clip.user_adjustments || null,  // V2: user (personnalisé)
          is_selected: clip.is_selected ?? true,  // Versioning: true par défaut pour nouveaux clips
          status: clip.status || 'pending',
        }

        // PRIORITÉ 1: Si le clip a un ID valide (UUID, pas temporaire), on UPDATE directement
        const hasValidId = clip.id && !clip.id.startsWith('temp-') && !clip.id.startsWith('clip-')
        
        if (hasValidId) {
          // UPDATE par ID
          const { error: updateError } = await (supabase
            .from('campaign_clips') as any)
            .update(clipData)
            .eq('id', clip.id)

          if (updateError) {
            console.error(`Error updating clip ${clip.id}:`, updateError)
          } else {
            console.log(`✓ Clip ${clip.order} updated (id: ${clip.id})`)
          }
          updatedClipsWithIds.push(clip)
        } else {
          // PRIORITÉ 2: Chercher si le clip existe par campaign_id + order
          // Prioriser is_selected=true, sinon prendre le premier clip trouvé
          const { data: existingList } = await (supabase
            .from('campaign_clips') as any)
            .select('id')
            .eq('campaign_id', dbCampaignId)
            .eq('order', clip.order)
            .order('is_selected', { ascending: false, nullsFirst: false })  // true first
            .limit(1)

          const existingClip = existingList?.[0]

          if (existingClip) {
            // UPDATE avec l'ID trouvé
            const { error: updateError } = await (supabase
              .from('campaign_clips') as any)
              .update(clipData)
              .eq('id', existingClip.id)

            if (updateError) {
              console.error(`Error updating clip ${clip.order}:`, updateError)
            } else {
              console.log(`✓ Clip ${clip.order} updated (found id: ${existingClip.id})`)
            }
            // Stocker l'ID pour le mettre à jour dans le state
            updatedClipsWithIds.push({ ...clip, id: existingClip.id })
          } else {
            // INSERT et récupérer l'ID généré
            const { data: insertedClip, error: insertError } = await (supabase
              .from('campaign_clips') as any)
              .insert(clipData)
              .select('id')
              .single()

            if (insertError) {
              console.error(`Error inserting clip ${clip.order}:`, insertError)
              updatedClipsWithIds.push(clip)
            } else {
              console.log(`✓ Clip ${clip.order} inserted (new id: ${insertedClip.id})`)
              // Stocker le nouvel ID
              updatedClipsWithIds.push({ ...clip, id: insertedClip.id })
            }
          }
        }
      }

      // Mettre à jour les clips avec leurs IDs de la BDD
      if (updatedClipsWithIds.some(c => c.id !== clipsToSave.find(orig => orig.order === c.order)?.id)) {
        console.log('[SaveClips] Updating clips with DB IDs')
        setGeneratedClips(updatedClipsWithIds)
      }

      console.log('✓ All clips saved:', clipsToSave.length)
      setAutoSaveStatus('saved')
    } catch (err) {
      console.error('Error saving clips:', err)
      setAutoSaveStatus('error')
    }
  }, [supabase])

  // Mettre à jour le status de la campagne
  const updateCampaignStatus = useCallback(async (dbCampaignId: string, newStatus: 'generating' | 'completed' | 'failed') => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('campaigns') as any).update({ status: newStatus }).eq('id', dbCampaignId)
      
      console.log('✓ Campaign status updated:', newStatus)
    } catch (err) {
      console.error('Error updating campaign status:', err)
    }
  }, [supabase])

  // Track si on vient de générer de nouvelles vidéos (pas juste charger depuis la base)
  const [hasNewlyGeneratedClips, setHasNewlyGeneratedClips] = useState(false)

  // Auto-save UNIQUEMENT quand des clips sont NOUVELLEMENT générés (pas au chargement)
  useEffect(() => {
    if (campaignId && generatedClips.length > 0 && !campaignId.startsWith('temp-') && hasNewlyGeneratedClips) {
      // TOUJOURS sauvegarder les clips générés, même si certains ont échoué
      // Cela garantit que les vidéos sont persistées en BDD
      const clipsWithVideo = generatedClips.filter(c => c.video?.raw_url || c.video?.final_url)
      console.log('[AutoSave] Saving newly generated clips:', generatedClips.length, 'with video:', clipsWithVideo.length)
      saveClipsToDb(campaignId, generatedClips)
      setHasNewlyGeneratedClips(false) // Reset après sauvegarde
    }
  }, [campaignId, generatedClips, saveClipsToDb, hasNewlyGeneratedClips])

  const handleStartGeneration = async () => {
    if (!actor || !preset || clips.length === 0) return

    // Un seul clip par beat : sélectionné prioritaire, sinon plus récent
    const primaryClips = getPrimaryClips(clips)

    // Enrichir avec les first frames générées à l'étape Plan (indexées par beat)
    const clipsWithFirstFrames = primaryClips.map((clip, index) => {
      const generatedFrame = state.generated_first_frames?.[index]
      if (generatedFrame?.url) {
        return {
          ...clip,
          first_frame: {
            ...clip.first_frame,
            image_url: generatedFrame.url
          }
        }
      }
      return clip
    })

    // Filtrer les clips qui n'ont pas encore de vidéo générée (une vidéo par beat)
    const clipsWithoutVideo = clipsWithFirstFrames.filter(c => !c.video?.raw_url)
    const clipsToGenerate = clipsWithoutVideo

    if (clipsToGenerate.length === 0) {
      console.log('Tous les clips ont déjà des vidéos')
      return
    }

    // ═══════════════════════════════════════════════════════════════════
    // VÉRIFICATION DES CRÉDITS AVANT GÉNÉRATION
    // ═══════════════════════════════════════════════════════════════════
    setCheckingCredits(true)
    
    try {
      // Calculer le coût total : vidéo + voix + ambiance pour chaque clip
      // On utilise video_veo31_fast par défaut (mode économique)
      const generations = [
        { type: 'video_veo31_fast' as const, count: clipsToGenerate.length * 6 }, // × durée en secondes
        { type: 'voice_chatterbox' as const, count: clipsToGenerate.length },
        { type: 'ambient_elevenlabs' as const, count: clipsToGenerate.length },
      ]
      
      const creditsCheck = await checkMultipleCredits(generations)
      
      if (creditsCheck && !creditsCheck.hasEnough) {
        // Pas assez de crédits ! Ouvrir le modal d'achat
        console.log('[Credits] Not enough credits:', creditsCheck)
        setCreditsNeeded({
          required: creditsCheck.requiredAmount,
          current: creditsCheck.currentBalance,
        })
        // C'est un premier achat si l'utilisateur n'a jamais fait d'achat (balance = 0 ou early bird eligible)
        setIsFirstPurchase(creditsCheck.isEarlyBirdEligible || creditsCheck.currentBalance === 0)
        setShowUpgradeModal(true)
        setCheckingCredits(false)
        return
      }
    } catch (err) {
      console.error('[Credits] Error checking credits:', err)
      // En cas d'erreur, on continue quand même (l'API échouera plus tard si pas de crédits)
    }
    
    setCheckingCredits(false)

    // ═══════════════════════════════════════════════════════════════════
    // LANCEMENT DE LA GÉNÉRATION
    // ═══════════════════════════════════════════════════════════════════
    setStarted(true)
    
    // Utiliser le campaign_id existant (depuis /new/[id]) ou en créer un nouveau
    let dbCampaignId: string | null = state.campaign_id || null
    
    if (!dbCampaignId) {
      // Pas de campaign_id dans le state, créer en base
      dbCampaignId = await createCampaignInDb()
      if (!dbCampaignId) {
        console.error('Failed to create campaign, using temp ID')
        setCampaignId(`temp-${Date.now()}`)
      } else {
        setCampaignId(dbCampaignId)
      }
    } else {
      // Campaign existe déjà, on l'utilise
      console.log('✓ Using existing campaign:', dbCampaignId)
      setCampaignId(dbCampaignId)
    }

    const results = await generateAllClips(
      clipsToGenerate,
      actor,
      dbCampaignId || `temp-${Date.now()}`,
      preset.ambient_audio.prompt,
      preset.id,
      videoQuality,
      state.product
    )

    // Marquer qu'on a de nouveaux clips générés (pour déclencher la sauvegarde)
    setHasNewlyGeneratedClips(true)
    
    // Initialiser les versions à 1 pour les nouveaux clips générés
    for (const clip of results) {
      if (clip.video?.raw_url && !clip.current_version) {
        clip.current_version = 1
      }
    }

    // Fusionner avec les clips existants - on utilise l'order comme clé unique
    // IMPORTANT: On ne compare pas les id car ils peuvent être undefined
    const clipsWithFirstFramesForMerge = clips.map((clip, index) => {
      const generatedFrame = state.generated_first_frames?.[index]
      if (generatedFrame?.url) {
        return {
          ...clip,
          first_frame: {
            ...clip.first_frame,
            image_url: generatedFrame.url
          }
        }
      }
      return clip
    })
    const updatedClips = clipsWithFirstFramesForMerge.map((clip, index) => {
      // Chercher par order (qui est unique et défini par Claude)
      const generated = results.find(r => r.order !== undefined && clip.order !== undefined && r.order === clip.order)
      return generated || clip
    })

    setGeneratedClips(updatedClips)
    onClipsUpdate(updatedClips) // Sauvegarder dans le state parent
    
    // Rafraîchir l'affichage des crédits dans le header
    triggerCreditsRefresh()

    // Mettre à jour le status de la campagne si terminé
    if (dbCampaignId) {
      const allCompleted = updatedClips.every(c => c.status === 'completed')
      const hasFailed = updatedClips.some(c => c.status === 'failed')
      
      if (allCompleted) {
        await updateCampaignStatus(dbCampaignId, 'completed')
      } else if (hasFailed) {
        await updateCampaignStatus(dbCampaignId, 'failed')
      }
    }
  }

  const handleConfirmRegenerate = async () => {
    if (!confirmRegen || !actor || !preset) return

    // FIX: Utiliser beatOrder pour trouver le bon clip
    // (au lieu de clipIndex qui était l'index dans uniqueBeats, pas dans clips)
    const { beatOrder, what, clipToRegenerate: passedClip } = confirmRegen
    const planClip = clips.find(c => c.order === beatOrder) // FIX: Recherche par order, pas par index
    
    if (!planClip) {
      console.error('[Regenerate] No plan clip found for beat order:', beatOrder)
      setConfirmRegen(null)
      return
    }
    
    // VERSIONING: Utiliser le clip passé directement (avec les dernières modifications)
    // OU trouver le clip via clipsByBeat (fallback pour les autres boutons de régénération)
    let clipToRegenerate: CampaignClip
    if (passedClip) {
      // Cas "Sauvegarder & Régénérer" : on utilise le clip avec le script mis à jour
      clipToRegenerate = passedClip
      console.log('[Regenerate] ═══════════════════════════════════════════════════')
      console.log('[Regenerate] Using passed clip with updated data:')
      console.log('[Regenerate] - Beat order:', beatOrder)
      console.log('[Regenerate] - Script text:', passedClip.script?.text?.slice(0, 80))
      console.log('[Regenerate] - Video prompt (first 200):', passedClip.video?.prompt?.slice(0, 200))
      console.log('[Regenerate] - Prompt contains script?:', passedClip.video?.prompt?.includes(passedClip.script?.text || ''))
      console.log('[Regenerate] ═══════════════════════════════════════════════════')
    } else {
      // Cas régénération standard : trouver via clipsByBeat
      const versions = clipsByBeat.get(beatOrder) || [] // FIX: Utiliser beatOrder directement
      const versionIndex = displayedVersionIndex[beatOrder] || 0
      const selectedClip = versions.find(v => v.is_selected) || versions[0]
      clipToRegenerate = versions[versionIndex] || selectedClip || planClip
    }
    
    const oldClipId = clipToRegenerate.id
    // beatOrder vient déjà de confirmRegen (pas besoin de le redéfinir)
    
    setConfirmRegen(null)
    
    // ══════════════════════════════════════════════════════════════
    // LANCER LA RÉGÉNÉRATION D'ABORD
    // (on archive APRÈS succès pour éviter les versions orphelines)
    // ══════════════════════════════════════════════════════════════
    const result = await regenerateSingleClip(
      clipToRegenerate,
      actor,
      campaignId || 'temp',
      preset.ambient_audio.prompt,
      what,
      preset.id,
      videoQuality,
      state.product
    )

    if (result) {
      // ══════════════════════════════════════════════════════════════
      // ARCHIVER LA VERSION ACTUELLE SEULEMENT APRÈS SUCCÈS
      // ══════════════════════════════════════════════════════════════
      const actionMap: Record<RegenerateWhat, ClipVersionAction> = {
        video: 'regenerate_video',
        voice: 'regenerate_voice',
        ambient: 'regenerate_ambient',
        frame: 'regenerate_frame',
        all: 'regenerate_all',
      }
      
      const newVersion = await archiveClipVersion(clipToRegenerate, actionMap[what])
      console.log(`[Regenerate] ✓ Generation succeeded, archived version ${newVersion - 1}, new version: ${newVersion}`)
      
      // ══════════════════════════════════════════════════════════════
      // VERSIONING: Créer un NOUVEAU clip et désélectionner l'ancien
      // ══════════════════════════════════════════════════════════════
      
      // Forcer la création d'un nouveau clip en supprimant l'ID
      // L'ancien clip sera gardé mais désélectionné
      const newClip: CampaignClip = {
        ...result,
        id: undefined as any, // Force INSERT d'un nouveau clip
        is_selected: true,
        current_version: newVersion,
        created_at: new Date().toISOString(),
      }
      
      console.log('[Regenerate] Creating new clip version:', {
        beatOrder,
        what,
        version: newVersion,
        oldClipId,
        raw_url: result.video?.raw_url?.slice(0, 80),
        final_url: result.video?.final_url?.slice(0, 80),
      })
      
      // 1. Désélectionner l'ancien clip en BDD
      if (oldClipId && campaignId) {
        await (supabase
          .from('campaign_clips') as any)
          .update({ is_selected: false })
          .eq('id', oldClipId)
        console.log(`[Versioning] ✓ Deselected old clip ${oldClipId}`)
      }
      
      // 2. Insérer le nouveau clip en BDD
      if (campaignId) {
        const clipData = {
          campaign_id: campaignId,
          order: newClip.order,
          beat: newClip.beat,
          first_frame: newClip.first_frame,
          script: newClip.script,
          video: newClip.video,
          audio: newClip.audio || {},
          transcription: newClip.transcription || null,
          adjustments: newClip.adjustments || null,
          auto_adjustments: newClip.auto_adjustments || null,
          user_adjustments: null, // Reset user adjustments pour nouveau clip
          is_selected: true,
          current_version: newVersion,
          status: newClip.status || 'completed',
        }
        
        const { data: insertedClip, error: insertError } = await (supabase
          .from('campaign_clips') as any)
          .insert(clipData)
          .select('id')
          .single()
        
        if (insertError) {
          console.error('[Versioning] Error inserting new clip:', insertError)
        } else if (insertedClip) {
          newClip.id = insertedClip.id
          console.log(`[Versioning] ✓ Inserted new clip ${insertedClip.id} for beat ${beatOrder}`)
        }
      }
      
      // 3. Mettre à jour le state local :
      // - Garder l'ancien clip avec is_selected = false
      // - Ajouter le nouveau clip avec is_selected = true
      // - L'UI affichera le nouveau clip car il est is_selected = true
      // FIX: Utiliser oldClipId (pas clipIndex) car clipIndex est l'index dans uniqueBeats,
      // pas dans generatedClips. Les deux tableaux peuvent avoir des ordres différents !
      const updatedClips = generatedClips.map((c) => {
        if (c.id === oldClipId) {
          // Garder l'ancien clip mais le marquer comme non sélectionné
          return { ...c, is_selected: false }
        }
        return c
      })
      
      // Ajouter le nouveau clip à la fin (il sera groupé par beat dans clipsByBeat)
      updatedClips.push(newClip)
      
      // Trier les clips : ceux avec is_selected = true en premier pour chaque beat
      // Cela garantit que l'UI affiche le bon clip
      const sortedClips = updatedClips.sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order
        // Pour le même beat, le sélectionné en premier
        if (a.is_selected && !b.is_selected) return -1
        if (!a.is_selected && b.is_selected) return 1
        // Sinon par date de création (plus récent en premier)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      
      setGeneratedClips(sortedClips)
      onClipsUpdate(sortedClips)
      
      // ═══════════════════════════════════════════════════════════════
      // VERSIONING: Réinitialiser l'index de version affiché pour ce beat
      // Cela garantit que la preview affiche automatiquement le nouveau clip
      // (qui est maintenant à l'index 0 car is_selected = true et trié en premier)
      // ═══════════════════════════════════════════════════════════════
      setDisplayedVersionIndex(prev => ({
        ...prev,
        [beatOrder]: 0
      }))
      
      // Rafraîchir l'affichage des crédits
      triggerCreditsRefresh()
      
      // NE PAS déclencher hasNewlyGeneratedClips car on a déjà fait l'insert manuellement
      // setHasNewlyGeneratedClips(true)
      
      // ═══════════════════════════════════════════════════════════════
      // V2: APPLIQUER auto_adjustments calculés par Whisper/Claude
      // user_adjustments est reset car nouvelle vidéo générée
      // ═══════════════════════════════════════════════════════════════
      if (result.auto_adjustments) {
        console.log(`[Regenerate] Applying auto_adjustments from Whisper:`, result.auto_adjustments)
        setAdjustments(prev => ({
          ...prev,
          [result.order]: {
            trimStart: result.auto_adjustments!.trim_start,
            trimEnd: result.auto_adjustments!.trim_end,
            speed: ensureMinSpeed(result.auto_adjustments!.speed || 1.0),
          }
        }))
      } else if (result.adjustments?.trimStart !== undefined && result.adjustments?.trimEnd !== undefined) {
        // LEGACY fallback
        console.log(`[Regenerate] Applying LEGACY adjustments:`, result.adjustments)
        setAdjustments(prev => ({
          ...prev,
          [result.order]: {
            trimStart: result.adjustments!.trimStart,
            trimEnd: result.adjustments!.trimEnd,
            speed: ensureMinSpeed(result.adjustments!.speed || 1.0),
          }
        }))
      } else {
        // Fallback: valeurs par défaut si pas de transcription
        console.log(`[Regenerate] No auto-adjustments, using defaults`)
        setAdjustments(prev => ({
          ...prev,
          [result.order]: {
            trimStart: 0,
            trimEnd: result.video.duration,
            speed: 1.0,
          }
        }))
      }
    }
  }

  // FIX: Utiliser beatOrder (clip.order) au lieu de l'index de la boucle
  // Car uniqueBeats est trié par order mais clips[] ne l'est pas
  // Voir CRITICAL_BEHAVIORS.md section 12 "Index uniqueBeats vs Index generatedClips"
  const askRegenerate = (beatOrder: number, what: RegenerateWhat, clipToRegenerate?: CampaignClip) => {
    const labels: Record<RegenerateWhat, string> = {
      video: 'la vidéo',
      voice: 'la voix',
      ambient: 'l\'ambiance',
      frame: 'l\'image',
      all: 'tout',
    }
    
    setConfirmRegen({
      beatOrder, // FIX: Utiliser l'order du beat, pas un index
      what,
      label: labels[what],
      warning: what === 'video' ? '⚠️ Coûteux (~1-2€)' : undefined,
      clipToRegenerate, // Clip avec les dernières modifications (optionnel)
    })
  }

  // ══════════════════════════════════════════════════════════════
  // ÉDITION DU SCRIPT (ce que dit l'acteur)
  // ══════════════════════════════════════════════════════════════
  const startEditingScript = (beatOrder: number, currentScript: string) => {
    setEditingScript(beatOrder)
    setEditScriptText(currentScript)
  }

  const cancelEditScript = () => {
    setEditingScript(null)
    setEditScriptText('')
  }

  const saveScript = async (beatOrder: number) => {
    if (!editScriptText.trim()) return
    
    // Trouver le clip à mettre à jour (le sélectionné ou le plus récent pour ce beat)
    const versions = clipsByBeat.get(beatOrder) || []
    const selectedClip = versions.find(v => v.is_selected) || versions[0]
    const planClip = clips.find(c => c.order === beatOrder)
    const clipToUpdate = selectedClip || planClip
    
    if (!clipToUpdate) {
      console.error('[Script] No clip found for beat', beatOrder)
      cancelEditScript()
      return
    }

    const newWordCount = editScriptText.split(/\s+/).filter(w => w.length > 0).length

    // Mettre à jour le clip dans le state local (script ET video.prompt)
    const updatedClips = generatedClips.map(c => {
      if (c.order === beatOrder) {
        // Utiliser la fonction helper robuste pour remplacer le script
        const updatedVideoPrompt = replaceScriptInPrompt(
          c.video?.prompt || '',
          c.script?.text || '',
          editScriptText
        )
        return {
          ...c,
          script: { text: editScriptText, word_count: newWordCount },
          video: { ...c.video, prompt: updatedVideoPrompt }
        }
      }
      return c
    })
    setGeneratedClips(updatedClips)
    
    // Mettre à jour aussi le state parent (clips du plan)
    onClipsUpdate(clips.map(c => {
      if (c.order === beatOrder) {
        const updatedVideoPrompt = replaceScriptInPrompt(
          c.video?.prompt || '',
          c.script?.text || '',
          editScriptText
        )
        return {
          ...c,
          script: { text: editScriptText, word_count: newWordCount },
          video: { ...c.video, prompt: updatedVideoPrompt }
        }
      }
      return c
    }))

    // Sauvegarder en BDD si le clip a un ID
    if (selectedClip?.id) {
      const updatedVideoPrompt = replaceScriptInPrompt(
        selectedClip.video?.prompt || '',
        selectedClip.script?.text || '',
        editScriptText
      )
      
      const { error } = await (supabase
        .from('campaign_clips') as any)
        .update({ 
          script: { text: editScriptText, word_count: newWordCount },
          video: { ...selectedClip.video, prompt: updatedVideoPrompt }
        })
        .eq('id', selectedClip.id)
      
      if (error) {
        console.error('[Script] Error saving to DB:', error)
      } else {
        console.log(`[Script] ✓ Saved new script for clip ${selectedClip.id}`)
      }
    }

    cancelEditScript()
  }

  const handleFinish = async () => {
    if (campaignId) {
      onComplete(campaignId)
    }
  }

  // Nombre de clips avec vidéo générée
  // VERSIONING: Compter les beats qui ont AU MOINS UN clip avec vidéo
  // (pas le nombre total de versions)
  const beatsWithVideo = new Set(
    clipsForDisplay
      .filter(c => c.video?.raw_url || c.video?.final_url)
      .map(c => c.order)
  ).size
  
  // VERSIONING: Nombre total de BEATS uniques dans le plan
  // (clips peut contenir plusieurs versions par beat, on ne compte que les beats uniques)
  const totalBeats = new Set(clips.map(c => c.order)).size
  
  const allClipsHaveVideo = beatsWithVideo === totalBeats && totalBeats > 0
  
  // VERSIONING: Tous les beats sont complétés si chaque beat a au moins un clip completed
  const beatsCompleted = new Set<number>()
  clipsForDisplay.forEach(c => {
    if (c.status === 'completed' && (c.video?.raw_url || c.video?.final_url)) {
      beatsCompleted.add(c.order)
    }
  })
  // VERSIONING: allCompleted = tous les beats ont au moins un clip completed avec vidéo
  // Note: ne PAS utiliser generatedClips.every() car ça inclut les clips "squelettes" sans vidéo
  const allCompleted = totalBeats > 0 && beatsCompleted.size === totalBeats

  const hasFailures = clipsForDisplay.some(c => c.status === 'failed')
  
  // Beats restants à générer (sans aucune version avec vidéo)
  const remainingClips = totalBeats - beatsWithVideo

  // FIX: Accepter le clip directement au lieu d'un index
  // Car l'index dans uniqueBeats.map() ≠ index dans clips[]
  // Voir CRITICAL_BEHAVIORS.md section 12 "Index uniqueBeats vs Index generatedClips"
  // FIX 2: Utiliser clip.order comme clé (pas clip.id) car l'order est stable pour chaque beat/tuile
  const getClipStatus = (clip: CampaignClip): ClipStatus => {
    const clipOrder = clip.order
    const clipProgress = progress[`clip-${clipOrder}`]
    // VERSIONING: Trouver le clip sélectionné ou le plus récent pour ce beat
    const versions = clipsByBeat.get(clipOrder) || []
    const selectedClip = versions.find(v => v.is_selected) || versions[0]
    // Si on a une vidéo générée, c'est completed
    const hasVideo = selectedClip?.video?.raw_url || selectedClip?.video?.final_url || clip?.video?.raw_url || clip?.video?.final_url
    if (hasVideo && !clipProgress) return 'completed'
    return clipProgress?.status || selectedClip?.status || 'pending'
  }

  // Vérifier si un clip a échoué par manque de crédits
  // FIX: Accepter le clip directement au lieu d'un index
  const getClipErrorInfo = (clip: CampaignClip): GenerationProgress | null => {
    const clipOrder = clip.order
    const clipProgress = progress[`clip-${clipOrder}`]
    if (clipProgress?.errorCode === 'INSUFFICIENT_CREDITS') {
      return clipProgress
    }
    return null
  }

  // Vérifier si un clip a échoué par manque de crédits
  const hasInsufficientCreditsError = Object.values(progress).some(
    p => p.errorCode === 'INSUFFICIENT_CREDITS'
  )

  // Ouvrir le modal d'upgrade avec les infos de crédits
  const openUpgradeModal = (required?: number, current?: number) => {
    if (required !== undefined && current !== undefined) {
      setCreditsNeeded({ required, current })
    }
    setShowUpgradeModal(true)
  }

  const getCurrentStep = (status: ClipStatus): number => {
    if (status === 'generating_video') return 0
    if (status === 'generating_voice') return 1
    if (status === 'generating_ambient') return 2
    if (status === 'completed') return 3
    return -1
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-3xl font-semibold tracking-tight">
          {!started ? 'Génération des vidéos' : generating ? 'Génération en cours...' : allCompleted ? '🎉 Vidéos prêtes !' : 'Génération terminée'}
        </h2>
        <p className="text-muted-foreground mt-3 text-lg">
          {!started 
            ? `${totalBeats} clips à générer` 
            : generating 
              ? 'Cela peut prendre quelques minutes...'
              : hasFailures
                ? 'Certains clips ont échoué'
                : 'Tu peux prévisualiser et ajuster tes vidéos'
          }
        </p>
      </div>

      {/* Not started state - seulement si aucune vidéo n'existe ET la campagne n'est pas déjà démarrée */}
      {!started && !hasExistingVideos && !campaignAlreadyStarted && (
        <Card className="rounded-2xl">
          <CardContent className="p-12 text-center">
            <div className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-muted flex items-center justify-center">
              <span className="text-5xl">🎬</span>
            </div>
            <h3 className="text-2xl font-semibold mb-3">
              Prêt à générer {totalBeats} clips
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Chaque clip passe par : Vidéo → Voix → Ambiance
            </p>
            
            {/* Sélecteur de qualité vidéo */}
            <div className="max-w-md mx-auto mb-8">
              <p className="text-sm font-medium text-muted-foreground mb-3">Qualité vidéo Veo 3.1</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setVideoQuality('fast')}
                  className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                    videoQuality === 'fast' 
                      ? 'border-green-500 bg-green-500/10' 
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Gauge className="w-4 h-4 text-green-500" />
                    <span className="font-semibold">Fast</span>
                    {videoQuality === 'fast' && (
                      <Check className="w-4 h-4 text-green-500 ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Économique • ~1.55€/clip</p>
                  <div className="mt-2 text-xs text-green-600 font-medium">
                    -54% vs Standard
                  </div>
                </button>
                
                <button
                  onClick={() => setVideoQuality('standard')}
                  className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                    videoQuality === 'standard' 
                      ? 'border-violet-500 bg-violet-500/10' 
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    <span className="font-semibold">Standard</span>
                    {videoQuality === 'standard' && (
                      <Check className="w-4 h-4 text-violet-500 ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Qualité max • ~3.35€/clip</p>
                  <div className="mt-2 text-xs text-violet-600 font-medium">
                    Meilleure qualité
                  </div>
                </button>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <Button variant="ghost" onClick={onBack} className="h-12 px-6 rounded-xl text-base">
                ← Modifier le plan
              </Button>
              <Button 
                onClick={handleStartGeneration}
                className="h-14 px-10 rounded-xl font-medium text-lg"
                size="lg"
                disabled={checkingCredits}
              >
                {checkingCredits ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Vérification...
                  </>
                ) : (
                  <>🚀 Lancer la génération ({videoQuality === 'fast' ? 'Fast' : 'Standard'})</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generation in progress / Completed */}
      {started && (
        <div className="space-y-6">
          {/* Sélecteur de qualité persistant (pour régénération) */}
          {!generating && (
            <div className="flex items-center justify-center gap-2 py-2">
              <span className="text-sm text-muted-foreground mr-2">Qualité vidéo :</span>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setVideoQuality('fast')}
                  className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition-all ${
                    videoQuality === 'fast' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-background hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <Gauge className="w-4 h-4" />
                  Fast
                  <span className="text-xs opacity-75">1.55€</span>
                </button>
                <button
                  onClick={() => setVideoQuality('standard')}
                  className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition-all ${
                    videoQuality === 'standard' 
                      ? 'bg-violet-500 text-white' 
                      : 'bg-background hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Standard
                  <span className="text-xs opacity-75">3.35€</span>
                </button>
              </div>
            </div>
          )}
          
          {/* Overall progress - Design moderne avec dégradé */}
          {generating && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-[1px]">
              <div className="relative rounded-2xl bg-gradient-to-br from-violet-950/90 via-purple-950/90 to-indigo-950/90 backdrop-blur-sm px-6 py-5">
                {/* Effet de brillance animé */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-violet-300 animate-pulse" />
                      </div>
                      <div>
                        <span className="font-semibold text-white">Génération en cours</span>
                        <p className="text-xs text-violet-200/70">
                          {beatsWithVideo}/{totalBeats} clips terminés
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-bold text-white tabular-nums">
                        {Math.round(getOverallProgress())}
                        <span className="text-lg font-normal text-violet-200/70">%</span>
                      </span>
                    </div>
                  </div>
                  
                  {/* Barre de progression custom */}
                  <div className="relative h-3 rounded-full bg-white/10 overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 transition-all duration-500 ease-out"
                      style={{ width: `${getOverallProgress()}%` }}
                    >
                      {/* Effet de brillance sur la barre */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Clips grid - UNE tuile par beat (order unique) */}
          <div className="space-y-5">
            {uniqueBeats.map((clip, index) => {
              // ══════════════════════════════════════════════════════════════
              // VERSIONING: Trouver le clip à afficher pour ce beat
              // Priorité : clip sélectionné (is_selected = true), sinon le plus récent
              // ══════════════════════════════════════════════════════════════
              const versions = clipsByBeat.get(clip.order) || []
              const versionIndex = displayedVersionIndex[clip.order] || 0
              const selectedClip = versions.find(v => v.is_selected)
              // Afficher la version navigée, ou la sélectionnée, ou la première (plus récente)
              const generatedClip = versions[versionIndex] || selectedClip || versions[0] || generatedClips.find(c => c.order === clip.order)
              
              const currentStatus = getClipStatus(clip)
              const currentStep = getCurrentStep(currentStatus)
              const clipProgress = progress[`clip-${clip.order}`]
              const isCompleted = currentStatus === 'completed'
              const isFailed = currentStatus === 'failed'
              const isGenerating = currentStatus !== 'pending' && currentStatus !== 'completed' && currentStatus !== 'failed'
              
              // Utiliser final_url (vidéo mixée avec audio) en priorité, sinon raw_url
              // Ajouter un cache-buster basé sur clip.id pour forcer le refresh lors de la navigation entre versions
              const baseVideoUrl = generatedClip?.video?.final_url || generatedClip?.video?.raw_url
              const clipCacheBuster = generatedClip?.id || generatedClip?.created_at || ''
              const videoUrl = baseVideoUrl ? `${baseVideoUrl}${baseVideoUrl.includes('?') ? '&' : '?'}v=${clipCacheBuster}` : undefined
              const firstFrameUrl = clip.first_frame?.image_url || state.generated_first_frames?.[index]?.url
              
              return (
                <div 
                  key={clip.id || index} 
                  className={`rounded-xl overflow-hidden border border-border/60 bg-card/50 backdrop-blur-sm transition-all duration-200 shadow-sm hover:shadow-md ${
                    isCompleted ? 'border-emerald-500/20' : 
                    isFailed ? 'border-rose-500/30 bg-rose-500/5' : ''
                  }`}
                >
                  {/* Header en haut de la carte */}
                  <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </span>
                    <Badge className={`${BEAT_COLORS[clip.beat]} text-white text-xs px-2.5 py-0.5`}>
                      {t(BEAT_LABEL_KEYS[clip.beat] as any)}
                    </Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{clip.video.duration}s</span>
                    </div>
                    {/* Pastilles status - compactes en haut à droite quand complété */}
                    {isCompleted && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <div className="flex items-center gap-1 text-emerald-600">
                          <Check className="w-3 h-3" />
                          <span className="text-[10px] font-medium">Prêt</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Layout principal : vidéo à gauche, contenu à droite */}
                  <div className="flex">
                    {/* Zone vidéo avec navigation - fond gris */}
                    <div className="flex items-center gap-2 p-3 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800">
                      {/* Flèche gauche */}
                    {(() => {
                      const versions = clipsByBeat.get(clip.order) || []
                      const hasMultipleVersions = versions.length > 1
                      const versionIndex = displayedVersionIndex[clip.order] || 0
                      const canGoPrev = versionIndex > 0
                      
                      if (!hasMultipleVersions) return null
                      
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigateVersion(clip.order, 'prev') }}
                          disabled={!canGoPrev}
                          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                            canGoPrev 
                              ? 'bg-white dark:bg-slate-700 shadow-md hover:shadow-lg text-slate-700 dark:text-slate-200 hover:scale-105' 
                              : 'bg-slate-200/50 dark:bg-slate-700/30 text-slate-300 dark:text-slate-600'
                          }`}
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                      )
                    })()}
                    
                    {/* Vidéo */}
                    <div className="relative group w-[200px] shrink-0 rounded-lg overflow-hidden shadow-lg">
                      {videoUrl ? (
                        <>
                          <video 
                            key={videoUrl}
                            src={videoUrl} 
                            className="w-full h-auto object-cover"
                            poster={firstFrameUrl}
                            autoPlay
                            muted
                            loop
                            playsInline
                            ref={(video) => {
                              const clipKey = getClipKey(generatedClip)
                              if (video && clipKey) {
                                const adj = adjustments[clipKey]
                                if (adj) {
                                  video.playbackRate = adj.speed || 1
                                  const videoDuration = generatedClip.video?.duration || clip.video.duration
                                  const handleTimeUpdate = () => {
                                    const trimEnd = adj.trimEnd ?? videoDuration
                                    const trimStart = adj.trimStart ?? 0
                                    if (video.currentTime >= trimEnd || video.currentTime < trimStart) {
                                      video.currentTime = trimStart
                                    }
                                  }
                                  video.ontimeupdate = handleTimeUpdate
                                  if (adj.trimStart && video.currentTime < adj.trimStart) {
                                    video.currentTime = adj.trimStart
                                  }
                                }
                              }
                            }}
                          />
                          {/* Overlay preview - toujours légèrement visible */}
                          <button
                            onClick={() => { setPreviewingClip(getClipKey(generatedClip) || null); setFullscreenVideo(videoUrl) }}
                            className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-black/40 via-transparent to-transparent hover:from-black/60 transition-all cursor-pointer"
                          >
                            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-white text-xs">
                              <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <Play className="w-3 h-3 fill-white text-white" />
                              </div>
                              <span className="opacity-80 group-hover:opacity-100 transition-opacity">Plein écran</span>
                            </div>
                          </button>
                        </>
                      ) : firstFrameUrl ? (
                        <>
                          <img src={firstFrameUrl} alt={`Clip ${index + 1}`} className="w-full h-auto object-cover" />
                          {isGenerating && (
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                              <Loader2 className="w-8 h-8 animate-spin text-white mb-2" />
                              <span className="text-white text-xs font-medium">
                                {currentStatus === 'generating_video' ? 'Vidéo...' : 
                                 currentStatus === 'generating_voice' ? 'Voix...' : 
                                 currentStatus === 'generating_ambient' ? 'Ambiance...' : ''}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="w-full min-h-[120px] flex items-center justify-center bg-slate-200 dark:bg-slate-700">
                          <Play className="w-8 h-8 text-slate-400" />
                        </div>
                      )}
                      
                      {/* Badge check */}
                      {isCompleted && (
                        <div className="absolute top-2 right-2 z-10 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-md">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      
                      {/* Indicateur version en haut à gauche */}
                      {(() => {
                        const versions = clipsByBeat.get(clip.order) || []
                        if (versions.length <= 1) return null
                        const versionIndex = displayedVersionIndex[clip.order] || 0
                        
                        return (
                          <div className="absolute top-2 left-2 z-10">
                            <span className="text-white text-xs font-semibold bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md">
                              {versionIndex + 1} / {versions.length}
                            </span>
                          </div>
                        )
                      })()}
                      
                      {/* Bouton utiliser si pas sélectionné */}
                      {(() => {
                        const versions = clipsByBeat.get(clip.order) || []
                        if (versions.length <= 1) return null
                        const versionIndex = displayedVersionIndex[clip.order] || 0
                        const displayedClipForSelect = versions[versionIndex] || generatedClip
                        
                        if (displayedClipForSelect?.is_selected) return null
                        
                        return (
                          <button
                            onClick={(e) => { e.stopPropagation(); selectVersion(displayedClipForSelect?.id || '', clip.order) }}
                            className="absolute bottom-3 right-3 z-10 text-xs px-3 py-1.5 rounded-md bg-white text-slate-800 font-semibold shadow-lg hover:bg-slate-50 transition-colors"
                          >
                            Utiliser
                          </button>
                        )
                      })()}
                    </div>
                    
                    {/* Flèche droite */}
                    {(() => {
                      const versions = clipsByBeat.get(clip.order) || []
                      const hasMultipleVersions = versions.length > 1
                      const versionIndex = displayedVersionIndex[clip.order] || 0
                      const canGoNext = versionIndex < versions.length - 1
                      
                      if (!hasMultipleVersions) return null
                      
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigateVersion(clip.order, 'next') }}
                          disabled={!canGoNext}
                          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                            canGoNext 
                              ? 'bg-white dark:bg-slate-700 shadow-md hover:shadow-lg text-slate-700 dark:text-slate-200 hover:scale-105' 
                              : 'bg-slate-200/50 dark:bg-slate-700/30 text-slate-300 dark:text-slate-600'
                          }`}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      )
                    })()}
                    </div>
                    {/* Fin zone vidéo grise */}

                    {/* Right: Content - fond blanc */}
                    <div className="flex-1 p-4 flex flex-col bg-card">
                      {/* Script éditable - seulement si clip complété */}
                      <div className="mb-4">
                          {isCompleted && editingScript === clip.order ? (
                            <div className="space-y-2">
                              <textarea
                                value={editScriptText}
                                onChange={(e) => setEditScriptText(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg p-2 text-sm min-h-[60px] focus:border-primary focus:outline-none resize-none"
                                placeholder="Le texte que dit l'acteur..."
                              />
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  {editScriptText.split(/\s+/).filter(w => w.length > 0).length} mots
                                </span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={cancelEditScript}
                                    className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                                  >
                                    Annuler
                                  </button>
                                  <button
                                    onClick={() => saveScript(clip.order)}
                                    className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded"
                                  >
                                    Sauvegarder
                                  </button>
                                  <button
                                    onClick={async () => {
                                      // Construire le clip avec le script mis à jour AVANT de sauvegarder
                                      // pour éviter les problèmes de timing avec le state React
                                      const newWordCount = editScriptText.split(/\s+/).filter(w => w.length > 0).length
                                      const originalPrompt = generatedClip?.video?.prompt || clip.video?.prompt || ''
                                      // CRITIQUE: Fallback vers clip.script.text si generatedClip n'a pas de script
                                      const oldScript = generatedClip?.script?.text || clip.script?.text || ''
                                      
                                      // Utiliser la fonction helper robuste pour remplacer le script
                                      const updatedVideoPrompt = replaceScriptInPrompt(originalPrompt, oldScript, editScriptText)
                                      
                                      console.log('[Script] ═══════════════════════════════════════════════════')
                                      console.log('[Script] Sauvegarder & Régénérer clicked:')
                                      console.log('[Script] - generatedClip exists?:', !!generatedClip)
                                      console.log('[Script] - generatedClip.script.text:', generatedClip?.script?.text?.slice(0, 50))
                                      console.log('[Script] - clip.script.text (fallback):', clip.script?.text?.slice(0, 50))
                                      console.log('[Script] - oldScript used:', oldScript?.slice(0, 50))
                                      console.log('[Script] - newScript (editScriptText):', editScriptText.slice(0, 50))
                                      console.log('[Script] - originalPrompt (first 100):', originalPrompt?.slice(0, 100))
                                      console.log('[Script] - promptChanged:', updatedVideoPrompt !== originalPrompt)
                                      console.log('[Script] - updatedPrompt (first 100):', updatedVideoPrompt.slice(0, 100))
                                      console.log('[Script] ═══════════════════════════════════════════════════')
                                      
                                      const clipWithUpdatedScript: CampaignClip = {
                                        ...(generatedClip || clip),
                                        script: { text: editScriptText, word_count: newWordCount },
                                        video: { ...(generatedClip?.video || clip.video), prompt: updatedVideoPrompt }
                                      }
                                      
                                      await saveScript(clip.order)
                                      askRegenerate(clip.order, 'video', clipWithUpdatedScript)
                                    }}
                                    className="px-2 py-1 text-xs bg-orange-500 text-white hover:bg-orange-600 rounded font-medium"
                                  >
                                    Sauvegarder & Régénérer
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="group/script">
                              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/30 border border-slate-200/60 dark:border-slate-700/40 shadow-sm hover:shadow transition-all">
                                <p className="text-sm text-foreground leading-relaxed flex-1">
                                  "{generatedClip?.script?.text || clip.script.text}"
                                </p>
                                {isCompleted && (
                                  <button
                                    onClick={() => startEditingScript(clip.order, generatedClip?.script?.text || clip.script.text)}
                                    className="shrink-0 w-8 h-8 rounded-lg bg-white dark:bg-slate-700 shadow-sm hover:shadow flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-primary transition-all"
                                    title="Modifier le script"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                      </div>

                      {/* Generation steps indicator - seulement pendant la génération */}
                      {isGenerating && (
                        <div className="flex items-center gap-3 mb-4">
                          {STATUS_STEPS.map((step, stepIndex) => {
                            const StepIcon = step.icon
                            const isActive = stepIndex === currentStep
                            const isDone = stepIndex < currentStep
                            
                            return (
                              <div key={step.status} className="flex items-center gap-1.5">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                  isDone ? 'bg-emerald-500/20' : 
                                  isActive ? 'bg-foreground' : 
                                  'bg-muted'
                                }`}>
                                  {isDone ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : isActive ? (
                                    <Loader2 className="w-3.5 h-3.5 text-background animate-spin" />
                                  ) : (
                                    <StepIcon className="w-3.5 h-3.5 text-muted-foreground" />
                                  )}
                                </div>
                                <span
                                  className={`text-xs font-medium ${
                                    isDone
                                      ? 'text-emerald-600'
                                      : isActive
                                        ? 'text-foreground'
                                        : 'text-muted-foreground'
                                  }`}
                                >
                                  {t(step.labelKey as any)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Progress message */}
                      {clipProgress && !['completed', 'failed'].includes(clipProgress.status) && (
                        <div className="mb-4">
                          <Progress value={clipProgress.progress} className="h-1.5 mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {clipProgress.message}
                          </p>
                        </div>
                      )}

                      {/* Failed state - distinguish credits errors from other errors */}
                      {isFailed && (
                        <div className="mb-4">
                          {(() => {
                            const errorInfo = getClipErrorInfo(clip)
                            const isCreditsError = errorInfo?.errorCode === 'INSUFFICIENT_CREDITS'
                            
                            if (isCreditsError) {
                              // Erreur de crédits insuffisants
                              return (
                                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Zap className="w-5 h-5 text-amber-500" />
                                    <span className="font-semibold text-amber-600">{t('errors.credits.title')}</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-3">
                                    {t('errors.credits.description')}
                                    {errorInfo.errorDetails?.missing && (
                                      <span className="block mt-1 font-medium text-amber-600">
                                        {t('errors.credits.missing', { amount: (errorInfo.errorDetails.missing / 100).toFixed(2) })}
                                      </span>
                                    )}
                                  </p>
                                  <Button 
                                    size="sm"
                                    className="h-9 text-sm rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                                    onClick={() => openUpgradeModal(
                                      errorInfo.errorDetails?.required,
                                      errorInfo.errorDetails?.current
                                    )}
                                  >
                                    <Zap className="w-4 h-4 mr-1" />
                                    {t('errors.credits.cta')}
                                  </Button>
                                </div>
                              )
                            } else {
                              // Autre erreur
                              return (
                                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                                  <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                    <span className="font-semibold text-red-600">{t('errors.generic.title')}</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-3">
                                    {clipProgress?.message || t('errors.generic.description')}
                                  </p>
                                  <Button 
                                    variant="destructive" 
                                    size="sm"
                                    className="h-9 text-sm rounded-lg"
                                    onClick={() => askRegenerate(clip.order, 'all')}
                                    disabled={isClipRegenerating(`clip-${clip.order}`)}
                                  >
                                    <RefreshCw className="w-4 h-4 mr-1" />
                                    {t('errors.generic.retry')}
                                  </Button>
                                </div>
                              )
                            }
                          })()}
                        </div>
                      )}

                      {/* Completed: Sections Ajuster + Régénérer */}
                      {isCompleted && generatedClip && (
                        <div className="mt-auto pt-3 space-y-3">
                          {/* Section Ajustements */}
                          <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800/30 dark:to-slate-900/20 shadow-sm overflow-hidden">
                            <div className="px-3 py-2.5 bg-slate-100/50 dark:bg-slate-800/30 border-b border-slate-200/40 dark:border-slate-700/30 flex items-center gap-2">
                              <Scissors className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-xs font-medium">Ajustements</span>
                              {/* Bouton Auto-détecter - toujours visible */}
                              {generatedClip?.id && (
                                <button
                                  onClick={() => analyzeClip(generatedClip.id)}
                                  disabled={analyzingClips.has(getClipKey(generatedClip))}
                                  className="ml-auto px-2 py-1 text-[10px] font-medium text-foreground bg-foreground/5 hover:bg-foreground/10 rounded-md flex items-center gap-1 transition-colors disabled:opacity-50"
                                >
                                  {analyzingClips.has(getClipKey(generatedClip)) ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Sparkles className="w-3 h-3" />
                                      Auto
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                            <div className="p-3 space-y-3">
                            
                            {/* Trim Slider */}
                            {(() => {
                              const clipKey = getClipKey(generatedClip)
                              const videoDuration = generatedClip?.video?.duration || clip.video.duration
                              const adj = clipKey ? adjustments[clipKey] : undefined
                              return (
                                <div>
                                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                                    <span className="font-medium">Trim</span>
                                    <span className="tabular-nums">
                                      {adj?.trimStart?.toFixed(2) || '0.00'}s → {adj?.trimEnd?.toFixed(2) || videoDuration.toFixed(2)}s
                                    </span>
                                  </div>
                                  <Slider
                                    value={[
                                      adj?.trimStart || 0,
                                      adj?.trimEnd || videoDuration
                                    ]}
                                    min={0}
                                    max={videoDuration}
                                    step={0.01}
                                    onValueChange={([start, end]) => {
                                      // Utiliser le vrai ID pour sauvegarder en BDD (si disponible)
                                      const saveKey = generatedClip?.id || clipKey
                                      if (saveKey) updateAdjustment(saveKey, { trimStart: start, trimEnd: end })
                                    }}
                                    className="w-full"
                                  />
                                </div>
                              )
                            })()}
                            
                            {/* Speed Buttons */}
                            {(() => {
                              const clipKey = getClipKey(generatedClip)
                              const adj = clipKey ? adjustments[clipKey] : undefined
                              return (
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-medium text-muted-foreground">Vitesse</span>
                                    <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
                                      {SPEED_OPTIONS.map((opt) => {
                                        const isSuggested = generatedClip?.transcription?.suggested_speed === opt.value
                                        const isSelected = (adj?.speed || 1.0) === opt.value
                                        const saveKey = generatedClip?.id || clipKey
                                        return (
                                          <button
                                            key={opt.value}
                                            onClick={() => saveKey && updateAdjustment(saveKey, { speed: opt.value })}
                                            className={`px-2.5 py-1 text-[11px] rounded-md transition-all relative ${
                                              isSelected
                                                ? 'bg-foreground text-background font-semibold shadow-sm'
                                                : isSuggested
                                                  ? 'text-primary font-medium hover:bg-muted'
                                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }`}
                                          >
                                            {opt.label}
                                            {isSuggested && !isSelected && (
                                              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full" />
                                            )}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                  {/* Indicateur débit dynamique (syllabes/seconde) */}
                                  {(() => {
                                    // Calculer le débit en temps réel avec les ajustements actuels
                                    const scriptText = generatedClip?.script?.text || clip.script?.text || ''
                                    const trimStart = adj?.trimStart || 0
                                    const trimEnd = adj?.trimEnd || (generatedClip?.video?.duration || clip.video?.duration || 6)
                                    const speed = adj?.speed || 1.0
                                    
                                    if (!scriptText) return null
                                    
                                    const syllablesPerSecond = calculateSyllablesPerSecond(scriptText, trimStart, trimEnd, speed)
                                    
                                    if (syllablesPerSecond <= 0) return null
                                    
                                    // Seuils pour UGC TikTok DYNAMIQUE (débit rapide requis)
                                    // < 5 s/s = trop lent, ennuyeux
                                    // 5-7 s/s = bon rythme UGC
                                    // > 7 s/s = très dynamique, excellent pour TikTok
                                    const isSlow = syllablesPerSecond < 5
                                    const isFast = syllablesPerSecond > 7
                                    
                                    const badgeConfig = isSlow 
                                      ? { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', label: 'Lent', icon: '🐢' }
                                      : isFast 
                                        ? { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', label: 'Dynamique', icon: '⚡' }
                                        : { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', label: 'Bon', icon: '✓' }
                                    
                                    return (
                                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${badgeConfig.bg}`}>
                                        <span className="text-[9px]">{badgeConfig.icon}</span>
                                        <span className={`text-[10px] font-semibold tabular-nums ${badgeConfig.text}`}>
                                          {syllablesPerSecond.toFixed(1)}
                                        </span>
                                        <span className={`text-[9px] font-medium ${badgeConfig.text}`}>
                                          {badgeConfig.label}
                                        </span>
                                      </div>
                                    )
                                  })()}
                                </div>
                              )
                            })()}
                            
                            {/* Durée + Reset */}
                            {(() => {
                              const clipKey = getClipKey(generatedClip)
                              const videoDuration = generatedClip?.video?.duration || clip.video.duration
                              const adj = clipKey ? adjustments[clipKey] : undefined
                              const isModified = adj && (
                                adj.trimStart !== 0 ||
                                adj.trimEnd !== videoDuration ||
                                adj.speed !== 1.0
                              )
                              if (!adj) return null
                              return (
                                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                                  <span className="text-[11px] text-muted-foreground">
                                    Durée finale : <span className="font-semibold text-foreground tabular-nums">{calculateAdjustedDuration(
                                      videoDuration,
                                      adj.trimStart,
                                      adj.trimEnd,
                                      adj.speed
                                    ).toFixed(2)}s</span>
                                  </span>
                                  {isModified && generatedClip?.id && (
                                    <button
                                      onClick={() => resetAdjustments(generatedClip.id)}
                                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      Reset
                                    </button>
                                  )}
                                </div>
                              )
                            })()}
                            </div>
                          </div>
                          
                          {/* Section RÉGÉNÉRER (coûteux) - design amélioré */}
                          <div className="rounded-xl border border-orange-200/40 dark:border-orange-900/30 bg-gradient-to-br from-orange-50/50 to-amber-50/30 dark:from-orange-950/20 dark:to-amber-950/10 shadow-sm overflow-hidden">
                            <div className="px-3 py-2 bg-orange-100/30 dark:bg-orange-900/20 border-b border-orange-200/30 dark:border-orange-800/20 flex items-center gap-2">
                              <RefreshCw className="w-3.5 h-3.5 text-orange-600/70" />
                              <span className="text-xs font-medium text-orange-700 dark:text-orange-400">Régénérer</span>
                            </div>
                            <div className="p-2.5 flex items-center gap-2">
                              <button 
                                onClick={() => askRegenerate(clip.order, 'video')}
                                disabled={isClipRegenerating(`clip-${clip.order}`)}
                                className="flex-1 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/60 dark:bg-slate-800/40 border border-orange-200/50 dark:border-orange-800/30 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none group"
                              >
                                <Video className="w-4 h-4 text-orange-500/70 group-hover:text-orange-600 transition-colors" />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 group-hover:text-orange-700">Vidéo</span>
                                <span className="text-[10px] text-slate-400">~150 cr</span>
                              </button>
                              <button 
                                onClick={() => askRegenerate(clip.order, 'voice')}
                                disabled={isClipRegenerating(`clip-${clip.order}`)}
                                className="flex-1 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/60 dark:bg-slate-800/40 border border-orange-200/50 dark:border-orange-800/30 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none group"
                              >
                                <Mic className="w-4 h-4 text-violet-500/70 group-hover:text-violet-600 transition-colors" />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 group-hover:text-violet-700">Voix</span>
                                <span className="text-[10px] text-slate-400">20 cr</span>
                              </button>
                              <button 
                                onClick={() => askRegenerate(clip.order, 'ambient')}
                                disabled={isClipRegenerating(`clip-${clip.order}`)}
                                className="flex-1 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/60 dark:bg-slate-800/40 border border-orange-200/50 dark:border-orange-800/30 hover:border-fuchsia-400 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20 hover:shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none group"
                              >
                                <Music className="w-4 h-4 text-fuchsia-500/70 group-hover:text-fuchsia-600 transition-colors" />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 group-hover:text-fuchsia-700">Ambiance</span>
                                <span className="text-[10px] text-slate-400">15 cr</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-6">
            {generating ? (
              <Button variant="destructive" onClick={cancel} className="h-12 px-6 rounded-xl text-base">
                {t('actions.cancel')}
              </Button>
            ) : (
              <Button variant="ghost" onClick={onBack} className="h-12 px-6 rounded-xl text-base">
                {t('actions.backToPlan')}
              </Button>
            )}

            <div className="flex items-center gap-3">
              {/* Bouton pour continuer la génération si des clips restent */}
              {!generating && remainingClips > 0 && (
                <Button 
                  onClick={handleStartGeneration}
                  className="h-12 px-6 rounded-xl font-medium text-base"
                >
                  {t('actions.generateRemaining', { count: remainingClips })}
                </Button>
              )}

              {allCompleted && (
                <Button 
                  onClick={assembleVideo}
                  disabled={assembling}
                  className="h-12 px-8 rounded-xl font-medium text-base bg-green-600 hover:bg-green-500"
                >
                  {assembling ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('actions.assemblingInProgress')}
                    </>
                  ) : (
                    <>
                      <Film className="w-4 h-4 mr-2" />
                      {t('actions.assembleFinal')}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal d'assemblage */}
      <AssemblyModal 
        isOpen={assembling} 
        clipCount={generatedClips.filter(c => c?.video?.raw_url).length} 
      />

      {/* Modal confirmation régénération */}
      <ConfirmModal
        isOpen={!!confirmRegen}
        onCancel={() => setConfirmRegen(null)}
        onConfirm={handleConfirmRegenerate}
        title={t('confirmRegen.title', { label: confirmRegen?.label || '' })}
        message={
          confirmRegen?.warning 
            ? t('confirmRegen.messageWithWarning', { warning: confirmRegen.warning, label: confirmRegen.label })
            : t('confirmRegen.message', { label: confirmRegen?.label || '' })
        }
        confirmText={t('confirmRegen.confirm')}
        variant={confirmRegen?.what === 'video' ? 'danger' : 'warning'}
      />

      {/* Modal vidéo plein écran avec ajustements HTML5 */}
      {fullscreenVideo && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => { setFullscreenVideo(null); setPreviewingClip(null) }}
        >
          <button
            onClick={() => { setFullscreenVideo(null); setPreviewingClip(null) }}
            className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          
          {/* Afficher les infos d'ajustement */}
          {previewingClip !== null && adjustments[previewingClip] && (
            <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-sm">
              <div className="flex items-center gap-4">
                <span>⏱ {adjustments[previewingClip].trimStart?.toFixed(2)}s → {adjustments[previewingClip].trimEnd?.toFixed(2)}s</span>
                <span>⚡ {adjustments[previewingClip].speed}x</span>
              </div>
            </div>
          )}
          
          <video 
            key={fullscreenVideo} // Force remount when URL changes
            src={fullscreenVideo} 
            className="max-h-[85vh] max-w-full rounded-xl"
            controls
            autoPlay
            onClick={(e) => e.stopPropagation()}
            ref={(video) => {
              if (video && previewingClip !== null) {
                const adj = adjustments[previewingClip]
                if (adj) {
                  // Appliquer la vitesse
                  video.playbackRate = adj.speed || 1
                  // Démarrer au bon timing (trim start)
                  if (adj.trimStart > 0 && video.currentTime < adj.trimStart) {
                    video.currentTime = adj.trimStart
                  }
                  // Boucler à la fin du trim
                  video.ontimeupdate = () => {
                    if (video.currentTime >= (adj.trimEnd || video.duration)) {
                      video.currentTime = adj.trimStart || 0
                    }
                  }
                }
              }
            }}
          />
        </div>
      )}

      {/* Modal d'achat de crédits - Première campagne */}
      {isFirstPurchase ? (
        <FirstPurchaseModal
          isOpen={showUpgradeModal}
          onClose={() => {
            setShowUpgradeModal(false)
            setCreditsNeeded(null)
            setIsFirstPurchase(false)
          }}
          requiredCredits={creditsNeeded?.required}
          currentBalance={creditsNeeded?.current}
          clipCount={totalBeats}
          onSuccess={() => {
            setShowUpgradeModal(false)
            setCreditsNeeded(null)
            setIsFirstPurchase(false)
            // Refresh la page pour avoir les nouveaux crédits
            window.location.reload()
          }}
        />
      ) : (
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => {
            setShowUpgradeModal(false)
            setCreditsNeeded(null)
          }}
          requiredCredits={creditsNeeded?.required}
          currentBalance={creditsNeeded?.current}
          onSuccess={() => {
            setShowUpgradeModal(false)
            setCreditsNeeded(null)
            // Refresh la page pour avoir les nouveaux crédits
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
