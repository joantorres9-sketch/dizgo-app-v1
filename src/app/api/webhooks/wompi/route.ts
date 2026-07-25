import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getSupabaseAdmin } from '@/lib/apiAuth'

function resolvePath(obj: any, path: string) {
  return path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), obj)
}

function checksumValido(evento: any): boolean {
  const secret = process.env.WOMPI_EVENTS_SECRET
  if (!secret) return false
  const props: string[] = evento?.signature?.properties || []
  const checksumRecibido: string = evento?.signature?.checksum || ''
  const cadena = props.map(p => String(resolvePath(evento.data, p))).join('') + String(evento.timestamp) + secret
  const calculado = createHash('sha256').update(cadena).digest('hex')
  return calculado.toUpperCase() === checksumRecibido.toUpperCase()
}

export async function POST(req: Request) {
  const evento = await req.json()
  if (!checksumValido(evento)) {
    return NextResponse.json({ error: 'Checksum inválido' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  await supabase.from('pagos_log').insert({ proveedor: 'wompi', evento: evento.event, payload: evento })

  const tx = evento?.data?.transaction
  if (evento.event === 'transaction.updated' && tx?.status === 'APPROVED' && tx?.reference) {
    await supabase.from('solicitudes_registro').update({
      pago_estado: 'pagado',
      proveedor_pago: 'wompi',
      pago_ref: tx.id,
    }).eq('id', tx.reference)
  }

  return NextResponse.json({ received: true })
}
