import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  CreditCard, 
  TrendingUp, 
  Clock, 
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Image,
  Video,
  Mic,
  Music,
  AlertTriangle
} from 'lucide-react'
import { BillingActions } from './billing-actions'
import { formatCredits, formatAsCredits, getRemainingGenerations, getAllGenerationCosts, CreditTransaction } from '@/lib/credits'
import { isAdmin } from '@/lib/admin'

export default async function BillingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('billing')
  const supabase = await createClient()
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect(`/${locale}/login`)
  }

  const userIsAdmin = isAdmin(user.email)

  // Get user credits
  const { data: userCredits, error: creditsError } = await (supabase
    .from('user_credits') as any)
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (creditsError) {
    console.error('Error fetching credits:', creditsError)
  }

  // Get recent transactions
  const { data: transactionsData } = await (supabase
    .from('credit_transactions') as any)
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  
  const transactions = transactionsData as CreditTransaction[] | null

  // Get costs and remaining
  const costs = await getAllGenerationCosts()
  const remaining = userCredits ? await getRemainingGenerations(userCredits.balance) : null

  // Check Early Bird eligibility
  const now = new Date()
  const earlyBirdDeadline = userCredits?.early_bird_eligible_until 
    ? new Date(userCredits.early_bird_eligible_until)
    : null
  const isEarlyBirdEligible = earlyBirdDeadline 
    ? now < earlyBirdDeadline && !userCredits?.early_bird_used
    : false

  // Check for negative balance
  const isNegativeBalance = (userCredits?.balance || 0) < 0

  // Format subscription tier display - labels come from translations
  const getTierLabel = (tier: string) => t(`tiers.${tier}`)

  const tierColors: Record<string, string> = {
    free: 'bg-muted text-muted-foreground',
    early_bird: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
    starter: 'bg-blue-500 text-white',
    pro: 'bg-purple-500 text-white',
    business: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white',
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTransactionIcon = (type: string, generationType?: string | null) => {
    if (type === 'usage') {
      switch (generationType) {
        case 'first_frame': return <Image className="w-4 h-4" />
        case 'video_veo31': return <Video className="w-4 h-4" />
        case 'voice_chatterbox': return <Mic className="w-4 h-4" />
        case 'ambient_elevenlabs': return <Music className="w-4 h-4" />
        default: return <ArrowDownRight className="w-4 h-4" />
      }
    }
    return <ArrowUpRight className="w-4 h-4" />
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t('header.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('header.subtitle')}
        </p>
      </div>

      {/* Negative Balance Alert */}
      {isNegativeBalance && (
        <Card className="bg-gradient-to-r from-red-500/10 to-rose-500/10 border-red-500/40 shadow-lg shadow-red-500/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center animate-pulse">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-red-600 dark:text-red-400">
                  {t('negativeBalance.title', { amount: formatAsCredits(userCredits?.balance || 0) })}
                </h3>
                <p className="text-muted-foreground">
                  {t('negativeBalance.description')}
                </p>
              </div>
              <BillingActions 
                hasStripeCustomer={!!userCredits?.stripe_customer_id}
                showEarlyBird={false}
                isAdmin={userIsAdmin}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Early Bird Banner */}
      {isEarlyBirdEligible && !isNegativeBalance && (
        <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{t('earlyBird.title')}</h3>
                <p className="text-muted-foreground">
                  {t('earlyBird.description')}
                </p>
              </div>
              <BillingActions 
                hasStripeCustomer={!!userCredits?.stripe_customer_id}
                showEarlyBird={true}
                isAdmin={userIsAdmin}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Balance Card */}
        <Card className={isNegativeBalance ? 'border-red-500/40 bg-red-500/5' : ''}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">{t('balance.title')}</CardTitle>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isNegativeBalance 
                  ? 'bg-red-500/10' 
                  : 'bg-green-500/10'
              }`}>
                {isNegativeBalance ? (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                ) : (
                  <CreditCard className="w-5 h-5 text-green-500" />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className={`text-4xl font-bold ${isNegativeBalance ? 'text-red-500' : ''}`}>
              {formatAsCredits(userCredits?.balance || 0)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {isNegativeBalance 
                ? t('balance.rechargeRequired') 
                : t('balance.available')}
            </p>
          </CardContent>
        </Card>

        {/* Subscription Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">{t('subscription.title')}</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Badge className={tierColors[userCredits?.subscription_tier || 'free']}>
              {getTierLabel(userCredits?.subscription_tier || 'free')}
            </Badge>
            {userCredits?.subscription_current_period_end && (
              <p className="text-sm text-muted-foreground mt-2">
                {t('subscription.renewalDate', { date: formatDate(userCredits.subscription_current_period_end) })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Remaining Generations Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">{t('remaining.title')}</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {remaining ? (
              <div className="space-y-1">
                <p className="text-2xl font-bold">{t('remaining.campaigns', { count: remaining.fullCampaigns })}</p>
                <p className="text-sm text-muted-foreground">
                  {t('remaining.details', { videos: remaining.videos, images: remaining.firstFrames })}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">-</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Costs Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t('costs.title')}</CardTitle>
          <CardDescription>
            {t('costs.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <Image className="w-5 h-5 text-blue-500" />
              <div>
                <p className="font-medium">{t('costs.firstFrame')}</p>
                <p className="text-sm text-muted-foreground">{formatAsCredits(costs.first_frame)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <Video className="w-5 h-5 text-purple-500" />
              <div>
                <p className="font-medium">{t('costs.video')}</p>
                <p className="text-sm text-muted-foreground">{formatAsCredits(costs.video_veo31_fast || costs.video_veo31)}/s</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <Mic className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium">{t('costs.voice')}</p>
                <p className="text-sm text-muted-foreground">{formatAsCredits(costs.voice_chatterbox)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <Music className="w-5 h-5 text-amber-500" />
              <div>
                <p className="font-medium">{t('costs.ambient')}</p>
                <p className="text-sm text-muted-foreground">{formatAsCredits(costs.ambient_elevenlabs)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <BillingActions 
          hasStripeCustomer={!!userCredits?.stripe_customer_id}
          showEarlyBird={false}
          isAdmin={userIsAdmin}
        />
      </div>

      {/* Transactions History */}
      <Card>
        <CardHeader>
          <CardTitle>{t('transactions.title')}</CardTitle>
          <CardDescription>
            {t('transactions.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions && transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      tx.amount > 0 ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                    }`}>
                      {getTransactionIcon(tx.type, tx.generation_type)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      tx.amount > 0 ? 'text-green-500' : 'text-foreground'
                    }`}>
                      {tx.amount > 0 ? '+' : ''}{formatAsCredits(tx.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('transactions.balanceAfter', { amount: formatAsCredits(tx.balance_after) })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {t('transactions.empty')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
