import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verificarTenantStaff } from '@/lib/apiAuth'

// La única política RLS de `profiles` es "profiles_self: auth.uid() = id" para TODOS los
// comandos — un SELECT desde el cliente con .eq('tenant_id', tid) igual queda filtrado a una
// sola fila (la del propio usuario logueado), sin importar el filtro que se le ponga. Por eso
// Gestión de Accesos necesita esta ruta con service role para poder listar los perfiles de los
// demás colaboradores del tenant, igual que ya se hace para crear/editar sus accesos.
export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await req.json() as { tenantId: string }
    if (!tenantId) return NextResponse.json({ error: 'Falta tenantId' }, { status: 400 })

    const auth = await verificarTenantStaff(req, tenantId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const supabase = getSupabaseAdmin()
    const { data: perfiles, error } = await supabase.from('profiles')
      .select('id,email,nombre,rol,activo,es_cortesia,colaborador_id,permisos,horario_acceso,notificar_actividad_inusual,created_at')
      .eq('tenant_id', tenantId).order('created_at')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, perfiles: perfiles || [] })
  } catch (err) {
    console.error('Error listando perfiles:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
