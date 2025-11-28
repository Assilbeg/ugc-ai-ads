'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ClipData {
  id: string
  order: number
  beat: string
  first_frame: { prompt?: string; image_url?: string; expression?: string }
  script: { text?: string; word_count?: number }
  video: { engine?: string; duration?: number; prompt?: string; url?: string }
  audio: { voice_url?: string; ambient_url?: string; final_url?: string }
  status: string
}

interface CampaignClipsViewProps {
  clips: ClipData[]
  campaignId: string
}

const BEAT_LABELS: Record<string, string> = {
  hook: 'HOOK',
  problem: 'PROBLÈME',
  agitation: 'AGITATION',
  solution: 'SOLUTION',
  proof: 'PREUVE',
  cta: 'CTA',
}

const BEAT_COLORS: Record<string, string> = {
  hook: 'bg-amber-600',
  problem: 'bg-red-600',
  agitation: 'bg-orange-600',
  solution: 'bg-green-600',
  proof: 'bg-blue-600',
  cta: 'bg-violet-600',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  generating_frame: 'Génération image...',
  generating_video: 'Génération vidéo...',
  generating_voice: 'Clonage voix...',
  generating_ambient: 'Ambiance sonore...',
  completed: 'Terminé',
  failed: 'Échec',
}

export function CampaignClipsView({ clips, campaignId }: CampaignClipsViewProps) {
  const [regenerating, setRegenerating] = useState<string | null>(null)

  const handleRegenerateClip = async (clipId: string) => {
    setRegenerating(clipId)
    // TODO: Implement clip regeneration
    setTimeout(() => setRegenerating(null), 2000)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Clips générés</h2>
      
      <div className="grid gap-4">
        {clips.map((clip, index) => (
          <Card key={clip.id} className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                  <Badge className={`${BEAT_COLORS[clip.beat]} text-white`}>
                    {BEAT_LABELS[clip.beat] || clip.beat}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {clip.video?.duration || 0}s • {clip.video?.engine?.toUpperCase() || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={clip.status === 'completed' ? 'default' : 'secondary'}
                    className={clip.status === 'completed' ? 'bg-green-600' : ''}
                  >
                    {STATUS_LABELS[clip.status] || clip.status}
                  </Badge>
                  {clip.status === 'completed' && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleRegenerateClip(clip.id)}
                      disabled={regenerating === clip.id}
                    >
                      {regenerating === clip.id ? '...' : '🔄'}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Script */}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Script :</p>
                  <p className="text-foreground">
                    "{clip.script?.text || 'Pas de script'}"
                  </p>
                  {clip.script?.word_count && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {clip.script.word_count} mots
                    </p>
                  )}
                </div>

                {/* Preview */}
                <div>
                  {clip.video?.url ? (
                    <div className="rounded-lg overflow-hidden bg-muted aspect-video">
                      <video 
                        src={clip.video.url} 
                        className="w-full h-full object-cover"
                        controls
                        poster={clip.first_frame?.image_url}
                      />
                    </div>
                  ) : clip.first_frame?.image_url ? (
                    <div className="rounded-lg overflow-hidden bg-muted aspect-video">
                      <img 
                        src={clip.first_frame.image_url} 
                        alt={`Clip ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg bg-muted aspect-video flex items-center justify-center">
                      <span className="text-muted-foreground">Pas de preview</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

