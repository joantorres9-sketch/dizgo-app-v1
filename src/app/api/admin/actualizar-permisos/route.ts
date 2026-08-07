import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verificarTenantStaff } from '@/lib/apiAuth'

// RLS de profiles es `auth.uid() = id` para TODO comando — un owner no puede actualizar el
// perfil de otro colaborador directo desde el cliente, por diseño (evita que cualquier fila con
// acceso de lectura a profiles pueda tocar campos de otro usuario). Este endpoint hace ese
// update con service role, después de confirmar que quien llama es owner/superadmin del mismo
// tenant del perfil objetivo.
export async function POST(req: NextRequest) {
  try {
    const { tenantId, profileId, permisos, horario_acceso, notificar_actividad_inusual, activo } = await req.json() as {
      tenantId: string; profileId: string
      permisos: Record<string, Record<string, boolean>>
      horario_acceso: string; notificar_actividad_inusual: boolean; activo: boolean
    }
    if (!tenantId || !profileId || !permisos || !horario_acceso) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const auth = await verificarTenantStaff(req, tenantId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const supabase = getSupabaseAdmin()

    const { data: perfilObjetivo } = await supabase.from('profiles').select('tenant_id, rol').eq('id', profileId).single()
    if (!perfilObjetivo) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    if (perfilObjetivo.tenant_id !== tenantId) return NextResponse.json({ error: 'Ese perfil no pertenece a este tenant' }, { status: 403 })
    if (perfilObjetivo.rol !== 'colaborador') return NextResponse.json({ error: 'Solo se puede editar la matriz de perfiles con rol colaborador' }, { status: 400 })

    const { error } = await supabase.from('profiles').update({
      permisos, horario_acceso, notificar_actividad_inusual, activo,
    }).eq('id', profileId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error actualizando permisos:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
