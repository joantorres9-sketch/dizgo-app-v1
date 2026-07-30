import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verificarSuperadmin } from '@/lib/apiAuth'
import { activarCampana } from '@/lib/metaAds'

// Único endpoint de todo el sistema que puede poner una campaña real a gastar dinero.
// Exige que el presupuesto que el usuario confirmó en pantalla coincida exacto con el
// guardado -- si no coincide, se rechaza (evita activar con un numero distinto al que se vio).
export async function POST(req: NextRequest) {
  const auth = await verificarSuperadmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id, presupuestoConfirmado } = await req.json()
  if (!id || presupuestoConfirmado === undefined) {
    return NextResponse.json({ error: 'Faltan id o presupuestoConfirmado' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data: campana } = await supabase.from('crm_campanas').select('*').eq('id', id).single()
  if (!campana) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
  if (campana.estado === 'activa') return NextResponse.json({ error: 'Esta campaña ya está activa' }, { status: 409 })
  if (Number(campana.presupuesto_diario_cop) !== Number(presupuestoConfirmado)) {
    return NextResponse.json({ error: 'El presupuesto confirmado no coincide con el presupuesto guardado -- refresca y vuelve a intentar' }, { status: 409 })
  }
  if (!campana.meta_campaign_id) return NextResponse.json({ error: 'Esta campaña no tiene meta_campaign_id' }, { status: 400 })

  const resultado = await activarCampana(campana.meta_campaign_id)
  if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: 502 })

  await supabase.from('crm_campanas').update({ estado: 'activa', activada_at: new Date().toISOString() }).eq('id', id)
  return NextResponse.json({ ok: true })
}
