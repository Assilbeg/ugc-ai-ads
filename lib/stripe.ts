// ═══════════════════════════════════════════════════════════════
// STRIPE CLIENT & HELPERS
// ═══════════════════════════════════════════════════════════════

import Stripe from 'stripe'

// Lazy initialization of Stripe client
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover' as any,
      typescript: true,
    })
  }
  return _stripe
}

// For backwards compatibility
export const stripe = {
  get customers() { return getStripe().customers },
  get subscriptions() { return getStripe().subscriptions },
  get checkout() { return getStripe().checkout },
  get billingPortal() { return getStripe().billingPortal },
  get prices() { return getStripe().prices },
  get webhooks() { return getStripe().webhooks },
}

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: string
  name: string
  description: string | null
  price_cents: number
  monthly_credits: number
  stripe_price_id: string | null
  is_early_bird: boolean
  is_one_time: boolean
  is_active: boolean
  display_order: number
  features: string[]
}

export interface CheckoutSessionParams {
  userId: string
  userEmail: string
  planId: string
  stripePriceId: string
  isSubscription: boolean
  successUrl: string
  cancelUrl: string
  stripeCustomerId?: string
}

// ─────────────────────────────────────────────────────────────────
// CREATE OR GET STRIPE CUSTOMER
// ─────────────────────────────────────────────────────────────────

export async function createOrGetStripeCustomer(
  userId: string,
  email: string,
  existingCustomerId?: string
): Promise<string> {
  // If customer already exists, return it
  if (existingCustomerId) {
    return existingCustomerId
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      supabase_user_id: userId,
    },
  })

  return customer.id
}

// ─────────────────────────────────────────────────────────────────
// CREATE CHECKOUT SESSION
// ─────────────────────────────────────────────────────────────────

export async function createCheckoutSession({
  userId,
  userEmail,
  planId,
  stripePriceId,
  isSubscription,
  successUrl,
  cancelUrl,
  stripeCustomerId,
}: CheckoutSessionParams): Promise<Stripe.Checkout.Session> {
  // Get or create customer
  const customerId = await createOrGetStripeCustomer(
    userId,
    userEmail,
    stripeCustomerId
  )

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: isSubscription ? 'subscription' : 'payment',
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      user_id: userId,
      plan_id: planId,
    },
    // Allow promotion codes
    allow_promotion_codes: true,
  }

  // Add subscription-specific options
  if (isSubscription) {
    sessionParams.subscription_data = {
      metadata: {
        user_id: userId,
        plan_id: planId,
      },
    }
  } else {
    // For one-time payments (like Early Bird)
    sessionParams.payment_intent_data = {
      metadata: {
        user_id: userId,
        plan_id: planId,
      },
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams)
  return session
}

// ─────────────────────────────────────────────────────────────────
// CREATE CUSTOMER PORTAL SESSION
// ─────────────────────────────────────────────────────────────────

export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return session
}

// ─────────────────────────────────────────────────────────────────
// GET SUBSCRIPTION DETAILS
// ─────────────────────────────────────────────────────────────────

export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    return subscription
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────
// CANCEL SUBSCRIPTION
// ─────────────────────────────────────────────────────────────────

export async function cancelSubscription(
  subscriptionId: string,
  immediately: boolean = false
): Promise<Stripe.Subscription> {
  if (immediately) {
    return stripe.subscriptions.cancel(subscriptionId)
  }
  
  // Cancel at end of period
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })
}

// ─────────────────────────────────────────────────────────────────
// VERIFY WEBHOOK SIGNATURE
// ─────────────────────────────────────────────────────────────────

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Format price for display
// ─────────────────────────────────────────────────────────────────

export function formatPrice(cents: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Get plan from Stripe Price ID
// ─────────────────────────────────────────────────────────────────

export async function getPriceDetails(
  priceId: string
): Promise<Stripe.Price | null> {
  try {
    const price = await stripe.prices.retrieve(priceId, {
      expand: ['product'],
    })
    return price
  } catch {
    return null
  }
}

