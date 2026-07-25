import { NextResponse } from 'next/server'
import { WOMPI_MONTO_POR_PLAN, firmaIntegridadWompi } from '@/lib/wompi'

export async function POST(req: Request) {
  try {
    const { solicitudId, plan, email } = await req.json()
    if (!solicitudId || !plan) {
      return NextResponse.json({ error: 'solicitudId y plan son requeridos' }, { status: 400 })
    }
    const monto = WOMPI_MONTO_POR_PLAN[plan]
    if (!monto) {
      return NextResponse.json({ error: `Plan "${plan}" no tiene monto de Wompi configurado` }, { status: 400 })
    }
    const publicKey = process.env.WOMPI_PUBLIC_KEY
    if (!publicKey) {
      return NextResponse.json({ error: 'WOMPI_PUBLIC_KEY no configurada' }, { status: 500 })
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://app.dizgo.app'
    const amountInCents = monto * 100
    const currency = 'COP'
    const signature = firmaIntegridadWompi(solicitudId, amountInCents, currency)

    const params = new URLSearchParams({
      'public-key': publicKey,
      currency,
      'amount-in-cents': String(amountInCents),
      reference: solicitudId,
      'signature:integrity': signature,
      'redirect-url': `${origin}/auth/pendiente?pago=ok`,
    })
    if (email) params.set('customer-data:email', email)

    return NextResponse.json({ url: `https://checkout.wompi.co/p/?${params.toString()}` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error creando el checkout de Wompi' }, { status: 500 })
  }
}
