import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verificarSuperadmin } from '@/lib/apiAuth'

// Actualiza el techo de módulos y/o países que DIZGO habilita para un tenant completo (comprador
// de plan o cortesía) — tenants.permisos_dizgo/paises_habilitados, distinto de profiles.permisos
// (la matriz interna que cada owner define para sus propios colaboradores). Cuando DIZGO apaga un
// módulo o país aquí, se cascada de verdad a todo el tenant vía puede()/paisesHabilitados en
// src/lib/permisos.ts, incluido el owner.
export async function POST(req: NextRequest) {
  try {
    const { tenantId, permisos, paises } = await req.json() as {
      tenantId: string; permisos: Record<string, Record<string, boolean>>; paises?: string[]
    }
    if (!tenantId || !permisos) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

    const auth = await verificarSuperadmin(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const supabase = getSupabaseAdmin()
    const cambios: { permisos_dizgo: typeof permisos; paises_habilitados?: string[] } = { permisos_dizgo: permisos }
    if (paises) cambios.paises_habilitados = paises
    const { error } = await supabase.from('tenants').update(cambios).eq('id', tenantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error actualizando permisos de tenant:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
