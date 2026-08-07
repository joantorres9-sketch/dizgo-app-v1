import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verificarSuperadmin } from '@/lib/apiAuth'

// Lista todos los usuarios de cortesía de todos los tenants — RLS de profiles es `auth.uid()=id`
// para todo comando, así que un superadmin no puede leer perfiles de otros tenants desde el
// cliente. Este endpoint hace la lectura con service role, solo superadmin.
export async function GET(req: NextRequest) {
  const auth = await verificarSuperadmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = getSupabaseAdmin()
  const { data: perfiles, error } = await supabase.from('profiles')
    .select('id, email, nombre, activo, created_at, tenant_id, rol, colaborador_id, permisos, horario_acceso, notificar_actividad_inusual')
    .eq('es_cortesia', true).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tenantIds = Array.from(new Set((perfiles || []).map(p => p.tenant_id).filter(Boolean)))
  const { data: tenants } = tenantIds.length
    ? await supabase.from('tenants').select('id, nombre, plan, pais, slug').in('id', tenantIds)
    : { data: [] }
  const mapaTenants = new Map((tenants || []).map(t => [t.id, t]))

  const resultado = (perfiles || []).map(p => ({ ...p, tenant: mapaTenants.get(p.tenant_id) || null }))
  return NextResponse.json({ usuarios: resultado })
}
