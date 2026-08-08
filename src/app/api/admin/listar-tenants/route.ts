import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verificarSuperadmin } from '@/lib/apiAuth'

// Lista todos los tenants de la plataforma (compradores de plan + cortesía) para que el
// superadmin de DIZGO pueda ver/editar el techo de módulos de cada uno. RLS de tenants
// (tenant_isolation_tenants) solo deja ver el propio tenant desde el cliente — por eso esta
// ruta con service role, igual que listar-perfiles y usuarios-cortesia.
//
// Detectado en producción: sin esto, el navegador cacheaba la respuesta GET por URL (la
// Authorization header no participa en la clave de caché) y seguía mostrando permisos_dizgo/
// paises_habilitados viejos después de guardar un cambio real — confirmado comparando la
// respuesta cacheada contra el valor real en Postgres. force-dynamic + no-store fuerza a que
// cada carga de "Permisos por Tenant" traiga el estado actual.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(req: NextRequest) {
  const auth = await verificarSuperadmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = getSupabaseAdmin()
  const { data: tenants, error } = await supabase.from('tenants')
    .select('id, nombre, plan, pais, slug, permisos_dizgo, paises_habilitados')
    .order('nombre')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tenants: tenants || [] }, { headers: { 'Cache-Control': 'no-store, must-revalidate' } })
}
