import { NextResponse } from 'next/server'
import { getStripe, STRIPE_PRICE_POR_PLAN } from '@/lib/stripe'

export async function POST(req: Request) {
  try {
    const { solicitudId, plan, email } = await req.json()
    if (!solicitudId || !plan) {
      return NextResponse.json({ error: 'solicitudId y plan son requeridos' }, { status: 400 })
    }
    const priceId = STRIPE_PRICE_POR_PLAN[plan]
    if (!priceId) {
      return NextResponse.json({ error: `Plan "${plan}" no tiene price_id de Stripe configurado` }, { status: 400 })
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://app.dizgo.app'
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: solicitudId,
      customer_email: email || undefined,
      success_url: `${origin}/auth/pendiente?pago=ok`,
      cancel_url: `${origin}/auth/pendiente?pago=cancelado`,
    })

    if (!session.url) throw new Error('Stripe no devolvió una URL de checkout')
    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error creando el checkout de Stripe' }, { status: 500 })
  }
}
