import Stripe from 'stripe'

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY no configurada')
  return new Stripe(key)
}

export const STRIPE_PRICE_POR_PLAN: Record<string, string | undefined> = {
  emprendedor: process.env.STRIPE_PRICE_EMPRENDEDOR,
  empresarial: process.env.STRIPE_PRICE_EMPRESARIAL,
}
