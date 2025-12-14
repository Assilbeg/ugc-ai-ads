import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  CreditCard, 
  Settings,
  Zap,
  TrendingUp,
  Image,
  Video,
  Mic,
  Music,
  DollarSign,
  Globe
} from 'lucide-react'
import { GenerationCostsForm } from './generation-costs-form'
import { SubscriptionPlansForm } from './subscription-plans-form'
import { CurrencyConfigForm } from './currency-config-form'

export default async function AdminBillingPage() {
  const supabase = await createClient()

  // Get generation costs
  const { data: costs } = await supabase
    .from('generation_costs')
    .select('*')
    .order('id')

  // Get subscription plans
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('display_order')

  // Get currency configs
  const { data: currencyConfigs } = await supabase
    .from('currency_config')
    .select('*')
    .order('language_code')

  // Get some stats
  const { count: totalUsers } = await supabase
    .from('user_credits')
    .select('*', { count: 'exact', head: true })

  const { count: paidUsers } = await supabase
    .from('user_credits')
    .select('*', { count: 'exact', head: true })
    .neq('subscription_tier', 'free')

  const { data: recentTransactions } = await (supabase
    .from('credit_transactions') as any)
    .select('amount, type')
    .eq('type', 'purchase')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  const monthlyRevenue = (recentTransactions as { amount: number; type: string }[] | null)?.reduce((sum, tx) => sum + tx.amount, 0) || 0

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100)
  }

  const getCostIcon = (id: string) => {
    switch (id) {
      case 'first_frame': return <Image className="w-5 h-5 text-blue-500" />
      case 'video_veo31': return <Video className="w-5 h-5 text-purple-500" />
      case 'voice_chatterbox': return <Mic className="w-5 h-5 text-green-500" />
      case 'ambient_elevenlabs': return <Music className="w-5 h-5 text-amber-500" />
      default: return <DollarSign className="w-5 h-5" />
    }
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Billing Admin</h1>
        <p className="text-muted-foreground mt-2">
          Gérer les coûts de génération et les plans d'abonnement
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Utilisateurs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalUsers || 0}</p>
            <p className="text-sm text-muted-foreground">Total inscrits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Abonnés payants</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{paidUsers || 0}</p>
            <p className="text-sm text-muted-foreground">Tier payant actif</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Revenus (30j)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">{formatPrice(monthlyRevenue)}</p>
            <p className="text-sm text-muted-foreground">Crédits achetés</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Taux conversion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {totalUsers ? Math.round(((paidUsers || 0) / totalUsers) * 100) : 0}%
            </p>
            <p className="text-sm text-muted-foreground">Free → Payant</p>
          </CardContent>
        </Card>
      </div>

      {/* Generation Costs */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Coûts de génération</CardTitle>
              <CardDescription>
                Configurer les prix facturés aux utilisateurs par type de génération
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <GenerationCostsForm costs={costs || []} />
        </CardContent>
      </Card>

      {/* Subscription Plans */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Plans d'abonnement</CardTitle>
              <CardDescription>
                Gérer les plans et leurs crédits mensuels. N'oubliez pas de créer les produits/prix correspondants sur Stripe.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <SubscriptionPlansForm plans={plans || []} />
        </CardContent>
      </Card>

      {/* Currency Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Configuration des devises</CardTitle>
              <CardDescription>
                Configurer les devises affichées selon la langue du navigateur et les taux de change
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CurrencyConfigForm configs={currencyConfigs || []} />
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">Configuration Stripe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-2">1. Créer les produits sur Stripe</h4>
            <p className="text-muted-foreground">
              Pour chaque plan, créez un produit sur Stripe Dashboard avec le prix mensuel correspondant.
              Copiez le Price ID (price_xxx) et collez-le dans le champ "Stripe Price ID" ci-dessus.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">2. Configurer le webhook</h4>
            <p className="text-muted-foreground">
              Ajoutez l'URL <code className="bg-muted px-2 py-1 rounded">{process.env.NEXT_PUBLIC_APP_URL}/api/stripe/webhook</code> dans Stripe Webhooks.
              Sélectionnez les événements: checkout.session.completed, invoice.paid, customer.subscription.updated, customer.subscription.deleted
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">3. Variables d'environnement</h4>
            <p className="text-muted-foreground">
              Assurez-vous d'avoir configuré STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET dans votre .env.local
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

