import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verificarSuperadmin } from '@/lib/apiAuth'
import { crearCampanaBorrador } from '@/lib/metaAds'

// Crea la campaña completa (Campaign + Ad Set + Creative + Ad) siempre en PAUSED.
// Esta ruta NUNCA puede activar gasto -- eso vive únicamente en /campana/activar.
export async function POST(req: NextRequest) {
  const auth = await verificarSuperadmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { nombre, objetivo, presupuestoDiarioCop } = await req.json()
  if (!nombre || !objetivo || !presupuestoDiarioCop) {
    return NextResponse.json({ error: 'Faltan nombre, objetivo o presupuestoDiarioCop' }, { status: 400 })
  }

  const resultado = await crearCampanaBorrador(nombre, objetivo, presupuestoDiarioCop)
  if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: 502 })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('crm_campanas').insert({
    nombre, objetivo, presupuesto_diario_cop: presupuestoDiarioCop,
    meta_campaign_id: resultado.data.campaignId, meta_adset_id: resultado.data.adsetId, meta_ad_id: resultado.data.adId,
    estado: 'pausada',
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: data.id })
}
