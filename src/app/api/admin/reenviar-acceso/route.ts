import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verificarTenantStaff } from '@/lib/apiAuth'
import { enviarCorreoInvitacion, generarPasswordTemporal } from '@/lib/emailInvitacion'

// Genera una nueva contraseña temporal para un perfil (colaborador o cortesía) y la reenvía por
// correo — no guardamos la contraseña original en texto plano en ningún lado, así que "reenviar"
// significa emitir una nueva.
export async function POST(req: NextRequest) {
  try {
    const { tenantId, profileId } = await req.json() as { tenantId: string; profileId: string }
    if (!tenantId || !profileId) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

    const auth = await verificarTenantStaff(req, tenantId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const supabase = getSupabaseAdmin()
    const { data: perfil } = await supabase.from('profiles').select('tenant_id, email, nombre, rol').eq('id', profileId).single()
    if (!perfil) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    if (perfil.tenant_id !== tenantId) return NextResponse.json({ error: 'Ese perfil no pertenece a este tenant' }, { status: 403 })
    if (perfil.rol === 'owner' || perfil.rol === 'superadmin') return NextResponse.json({ error: 'No aplica para cuentas owner/superadmin' }, { status: 400 })

    const passwordTemporal = generarPasswordTemporal()
    const { error: pwErr } = await supabase.auth.admin.updateUserById(profileId, { password: passwordTemporal })
    if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 500 })

    const correo = await enviarCorreoInvitacion({ email: perfil.email, nombre: perfil.nombre || perfil.email, passwordTemporal })
    return NextResponse.json({ ok: true, correoEnviado: correo.ok, avisoCorreo: correo.error })
  } catch (err) {
    console.error('Error reenviando acceso:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
