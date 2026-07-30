import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verificarSuperadmin } from '@/lib/apiAuth'
import { obtenerRendimiento } from '@/lib/metaAds'

export async function GET(req: NextRequest) {
  const auth = await verificarSuperadmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = getSupabaseAdmin()
  const { data: campanas } = await supabase.from('crm_campanas').select('*').order('creado_at', { ascending: false })

  const conRendimiento = await Promise.all((campanas || []).map(async (c) => {
    if (!c.meta_campaign_id || c.estado === 'borrador') return { ...c, rendimiento: null }
    const r = await obtenerRendimiento(c.meta_campaign_id)
    return { ...c, rendimiento: r.ok ? r.data : null }
  }))

  return NextResponse.json({ campanas: conRendimiento })
}
