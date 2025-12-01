'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Video, Clock, Calendar, Pencil, Trash2 } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/confirm-modal'

interface CampaignCardProps {
  campaign: {
    id: string
    status: string
    final_video_url?: string
    created_at: string
    brief?: { what_selling?: string; target_duration?: number }
    campaign_clips?: { count: number }[]
    actors?: { id: string; name: string; soul_image_url: string } | null
  }
  presetName?: string
  statusConfig: Record<string, { label: string; color: string; bg: string }>
  onDelete?: () => void
}

export function CampaignCard({ campaign, presetName, statusConfig, onDelete }: CampaignCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const status = statusConfig[campaign.status] || statusConfig.draft
  const title = campaign.brief?.what_selling || 'Sans titre'
  const duration = campaign.brief?.target_duration || 30
  const clipsCount = campaign.campaign_clips?.[0]?.count || 0
  const actor = campaign.actors

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const supabase = createClient()
      await (supabase.from('campaigns') as any).delete().eq('id', campaign.id)
      onDelete?.()
      // Force refresh
      window.location.reload()
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  return (
    <>
      <div className="group relative bg-card rounded-xl border overflow-hidden hover:shadow-xl hover:shadow-black/5 hover:border-foreground/20 transition-all duration-300">

        <Link href={`/campaign/${campaign.id}`}>
          {/* Video area - Format 9:16 */}
          <div className="relative aspect-[9/16] bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 overflow-hidden cursor-pointer">
            {campaign.final_video_url ? (
              <video 
                src={campaign.final_video_url} 
                className="w-full h-full object-cover"
                muted
                playsInline
              />
            ) : actor?.soul_image_url ? (
              <img 
                src={actor.soul_image_url} 
                alt={actor.name}
                className="w-full h-full object-cover opacity-50"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-white/10 dark:bg-black/20 backdrop-blur flex items-center justify-center">
                  <Video className="w-6 h-6 text-zinc-400" />
                </div>
              </div>
            )}
            
            {/* Edit overlay on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 shadow-lg">
                <Pencil className="w-4 h-4 text-zinc-900" />
                <span className="text-sm font-medium text-zinc-900">Éditer</span>
              </div>
            </div>

            {/* Status badge */}
            <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${status.bg} ${status.color} backdrop-blur-sm`}>
              {status.label}
            </div>

            {/* Duration badge */}
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {duration}s
            </div>

            {/* Actor badge */}
            {actor && (
              <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm">
                <img 
                  src={actor.soul_image_url} 
                  alt={actor.name}
                  className="w-5 h-5 rounded-full object-cover ring-1 ring-white/30"
                />
                <span className="text-white text-[11px] font-medium truncate">{actor.name}</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-3">
            {/* Intention/Preset name */}
            {presetName && (
              <div className="text-[10px] font-medium text-violet-500 uppercase tracking-wide mb-1">
                {presetName}
              </div>
            )}
            
            {/* Title (what_selling) */}
            <h3 className="font-medium text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-tight">
              {title}
            </h3>
            
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {new Date(campaign.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
                {clipsCount > 0 && (
                  <>
                    <span className="text-border">•</span>
                    <span>{clipsCount} clip{clipsCount > 1 ? 's' : ''}</span>
                  </>
                )}
              </div>
              
              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowDeleteModal(true)
                }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                title="Supprimer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </Link>
      </div>

      {/* Delete confirmation modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Supprimer la campagne"
        message="Es-tu sûr de vouloir supprimer cette campagne ? Cette action est irréversible."
        confirmText={deleting ? "Suppression..." : "Supprimer"}
        cancelText="Annuler"
        variant="danger"
      />
    </>
  )
}

