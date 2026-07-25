import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/apiAuth'
import type Stripe from 'stripe'

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET no configurada' }, { status: 500 })

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Falta stripe-signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret)
  } catch (err: any) {
    return NextResponse.json({ error: `Firma inválida: ${err.message}` }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  await supabase.from('pagos_log').insert({ proveedor: 'stripe', evento: event.type, payload: event as any })

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const solicitudId = session.client_reference_id
      if (solicitudId) {
        await supabase.from('solicitudes_registro').update({
          pago_estado: 'pagado',
          proveedor_pago: 'stripe',
          pago_ref: session.id,
        }).eq('id', solicitudId)
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      const { data: tenant } = await supabase.from('tenants').select('id').eq('stripe_subscription_id', sub.id).maybeSingle()
      if (tenant) {
        const activa = sub.status === 'active' || sub.status === 'trialing'
        const vence = sub.items.data[0]?.current_period_end
          ? new Date(sub.items.data[0].current_period_end * 1000).toISOString().slice(0, 10)
          : null
        await supabase.from('tenants').update({
          licencia: activa ? 'activa' : (sub.status === 'canceled' ? 'cancelada' : 'vencida'),
          licencia_vence: vence,
        }).eq('id', tenant.id)
      }
    }
  } catch (err: any) {
    // El evento ya quedó en pagos_log para reprocesar a mano si algo falla aquí.
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
