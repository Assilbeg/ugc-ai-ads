import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent, stripe } from '@/lib/stripe'
import { addCredits, updateSubscription } from '@/lib/credits'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Use service role for webhook (no auth context)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    let event: Stripe.Event

    try {
      event = constructWebhookEvent(body, signature)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`)

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────────────────────────
// CHECKOUT COMPLETED (First payment)
// ─────────────────────────────────────────────────────────────────

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id
  const planId = session.metadata?.plan_id
  const customerId = session.customer as string

  if (!userId || !planId) {
    console.error('Missing metadata in checkout session')
    return
  }

  console.log(`[Stripe] Checkout completed for user ${userId}, plan ${planId}`)

  // Update user's Stripe customer ID
  await supabaseAdmin
    .from('user_credits')
    .update({ stripe_customer_id: customerId })
    .eq('user_id', userId)

  // Handle custom admin payment
  if (planId === 'custom_admin') {
    const creditsAmount = parseInt(session.metadata?.credits_amount || '0')
    if (creditsAmount > 0) {
      const result = await addCredits(
        userId,
        creditsAmount,
        `Recharge Admin ${(creditsAmount / 100).toFixed(2)}€`,
        'purchase',
        session.payment_intent as string
      )
      if (result.success) {
        console.log(`[Stripe] Added ${creditsAmount} custom credits to admin ${userId}`)
      } else {
        console.error('Failed to add custom credits:', result.errorMessage)
      }
    }
    return
  }

  // Get plan details
  const { data: plan } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .eq('id', planId)
    .single()

  if (!plan) {
    console.error(`Plan ${planId} not found`)
    return
  }

  if (plan.is_one_time) {
    // One-time payment (Early Bird)
    await handleOneTimePayment(userId, plan, session)
  } else {
    // Subscription - credits will be added via invoice.paid event
    // Just update subscription info here
    const subscriptionId = session.subscription as string
    
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any
      
      await updateSubscription(userId, {
        subscription_tier: planId,
        subscription_stripe_id: subscriptionId,
        subscription_status: 'active',
        subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        stripe_customer_id: customerId,
      })
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// ONE-TIME PAYMENT (Early Bird)
// ─────────────────────────────────────────────────────────────────

async function handleOneTimePayment(
  userId: string,
  plan: { id: string; name: string; monthly_credits: number; is_early_bird: boolean },
  session: Stripe.Checkout.Session
) {
  // Add credits
  const result = await addCredits(
    userId,
    plan.monthly_credits,
    `Achat ${plan.name}`,
    'purchase',
    session.payment_intent as string
  )

  if (!result.success) {
    console.error('Failed to add credits:', result.errorMessage)
    return
  }

  console.log(`[Stripe] Added ${plan.monthly_credits} credits to user ${userId}`)

  // If Early Bird, mark as used
  if (plan.is_early_bird) {
    await supabaseAdmin
      .from('user_credits')
      .update({ 
        early_bird_used: true,
        subscription_tier: 'early_bird',
      })
      .eq('user_id', userId)
    
    console.log(`[Stripe] Early Bird marked as used for user ${userId}`)
  }
}

// ─────────────────────────────────────────────────────────────────
// INVOICE PAID (Subscription renewals)
// ─────────────────────────────────────────────────────────────────

async function handleInvoicePaid(invoice: any) {
  // Skip if not a subscription invoice
  if (!invoice.subscription) return
  
  const customerId = invoice.customer as string
  
  // Get user by Stripe customer ID
  const { data: userCredits } = await supabaseAdmin
    .from('user_credits')
    .select('user_id, subscription_tier')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!userCredits) {
    console.error(`No user found for customer ${customerId}`)
    return
  }

  // Get plan details
  const { data: plan } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .eq('id', userCredits.subscription_tier)
    .single()

  if (!plan) {
    console.error(`Plan ${userCredits.subscription_tier} not found`)
    return
  }

  // Skip one-time plans
  if (plan.is_one_time) return

  // Add monthly credits
  const result = await addCredits(
    userCredits.user_id,
    plan.monthly_credits,
    `Renouvellement ${plan.name}`,
    'subscription_credit',
    undefined,
    invoice.id
  )

  if (result.success) {
    console.log(`[Stripe] Added ${plan.monthly_credits} subscription credits to user ${userCredits.user_id}`)
  } else {
    console.error('Failed to add subscription credits:', result.errorMessage)
  }
}

// ─────────────────────────────────────────────────────────────────
// SUBSCRIPTION UPDATED
// ─────────────────────────────────────────────────────────────────

async function handleSubscriptionUpdated(subscription: any) {
  const customerId = subscription.customer as string
  
  // Get user by Stripe customer ID
  const { data: userCredits } = await supabaseAdmin
    .from('user_credits')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!userCredits) {
    console.error(`No user found for customer ${customerId}`)
    return
  }

  // Get plan from price
  const priceId = subscription.items.data[0]?.price.id
  
  const { data: plan } = await supabaseAdmin
    .from('subscription_plans')
    .select('id')
    .eq('stripe_price_id', priceId)
    .single()

  const status = subscription.status === 'active' ? 'active' 
    : subscription.status === 'past_due' ? 'past_due'
    : subscription.status === 'canceled' ? 'canceled'
    : 'none'

  await updateSubscription(userCredits.user_id, {
    subscription_tier: plan?.id || 'free',
    subscription_status: status,
    subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
  })

  console.log(`[Stripe] Subscription updated for user ${userCredits.user_id}: ${status}`)
}

// ─────────────────────────────────────────────────────────────────
// SUBSCRIPTION DELETED
// ─────────────────────────────────────────────────────────────────

async function handleSubscriptionDeleted(subscription: any) {
  const customerId = subscription.customer as string
  
  // Get user by Stripe customer ID
  const { data: userCredits } = await supabaseAdmin
    .from('user_credits')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!userCredits) {
    console.error(`No user found for customer ${customerId}`)
    return
  }

  await updateSubscription(userCredits.user_id, {
    subscription_tier: 'free',
    subscription_stripe_id: null,
    subscription_status: 'canceled',
    subscription_current_period_end: null,
  })

  console.log(`[Stripe] Subscription canceled for user ${userCredits.user_id}`)
}

