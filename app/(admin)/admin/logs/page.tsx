'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Activity, 
  Clock, 
  DollarSign, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Image,
  Video,
  Mic,
  Music
} from 'lucide-react'

interface GenerationLog {
  id: string
  user_id: string
  generation_type: string
  model_path: string
  fal_request_id: string | null
  input_params: Record<string, unknown>
  output_url: string | null
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  estimated_cost_cents: number | null
  actual_cost_cents: number | null
  billed_cost_cents: number | null
  status: string
  error_message: string | null
  campaign_id: string | null
  created_at: string
}

interface Summary {
  total: number
  completed: number
  failed: number
  totalEstimatedCost: number
  totalActualCost: number
  totalBilled: number
  avgDurationMs: number
}

export default function GenerationLogsPage() {
  const [logs, setLogs] = useState<GenerationLog[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<{ type?: string; status?: string }>({})

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter.type) params.set('type', filter.type)
      if (filter.status) params.set('status', filter.status)
      
      const response = await fetch(`/api/admin/generation-logs?${params}`)
      const data = await response.json()
      setLogs(data.logs || [])
      setSummary(data.summary || null)
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [filter])

  const formatPrice = (cents: number | null) => {
    if (cents === null) return '-'
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100)
  }

  const formatDuration = (ms: number | null) => {
    if (ms === null) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'first_frame': return <Image className="w-4 h-4" />
      case 'video_veo31': return <Video className="w-4 h-4" />
      case 'voice_chatterbox': return <Mic className="w-4 h-4" />
      case 'ambient_elevenlabs': return <Music className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'first_frame': return 'First Frame'
      case 'video_veo31': return 'Vidéo Veo 3.1'
      case 'voice_chatterbox': return 'Voice'
      case 'ambient_elevenlabs': return 'Ambient'
      default: return type
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Terminé</Badge>
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Échec</Badge>
      case 'processing':
        return <Badge className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> En cours</Badge>
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> En attente</Badge>
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Logs de génération</h1>
          <p className="text-muted-foreground mt-2">
            Suivi détaillé de chaque appel API Fal.ai
          </p>
        </div>
        <Button onClick={fetchLogs} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total (30j)</p>
              <p className="text-2xl font-bold">{summary.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Réussies</p>
              <p className="text-2xl font-bold text-green-500">{summary.completed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Échouées</p>
              <p className="text-2xl font-bold text-red-500">{summary.failed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Coût estimé</p>
              <p className="text-2xl font-bold">{formatPrice(summary.totalEstimatedCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Coût réel</p>
              <p className="text-2xl font-bold">{formatPrice(summary.totalActualCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Facturé</p>
              <p className="text-2xl font-bold text-green-500">{formatPrice(summary.totalBilled)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Durée moy.</p>
              <p className="text-2xl font-bold">{formatDuration(summary.avgDurationMs)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={!filter.type ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter(f => ({ ...f, type: undefined }))}
        >
          Tous
        </Button>
        {['first_frame', 'video_veo31', 'voice_chatterbox', 'ambient_elevenlabs'].map(type => (
          <Button
            key={type}
            variant={filter.type === type ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f => ({ ...f, type }))}
          >
            {getTypeIcon(type)}
            <span className="ml-1">{getTypeLabel(type)}</span>
          </Button>
        ))}
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Dernières générations</CardTitle>
          <CardDescription>50 derniers appels API</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucune génération enregistrée
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-left p-3">Statut</th>
                    <th className="text-right p-3">Durée</th>
                    <th className="text-right p-3">Estimé</th>
                    <th className="text-right p-3">Facturé</th>
                    <th className="text-left p-3">Modèle</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-mono text-xs">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(log.generation_type)}
                          <span>{getTypeLabel(log.generation_type)}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {getStatusBadge(log.status)}
                        {log.error_message && (
                          <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate">
                            {log.error_message}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {formatDuration(log.duration_ms)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {formatPrice(log.estimated_cost_cents)}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold">
                        {formatPrice(log.billed_cost_cents)}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground font-mono max-w-[150px] truncate">
                        {log.model_path}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost Warning */}
      <Card className="bg-amber-500/10 border-amber-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-500">Attention aux coûts Veo 3</p>
              <p className="text-sm text-muted-foreground">
                Veo 3 coûte <strong>$0.40/seconde</strong> sur Fal.ai. Une vidéo de 6s = $2.40 (~2.20€).
                Assure-toi que tes prix de vente couvrent ces coûts avec une marge suffisante.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}





