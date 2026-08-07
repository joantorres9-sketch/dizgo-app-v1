import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verificarTenantStaff } from '@/lib/apiAuth'
import { enviarCorreoInvitacion, generarPasswordTemporal } from '@/lib/emailInvitacion'
import { matrizTodoFalse } from '@/lib/modulos'

// Crea el login (Supabase Auth + profiles) de un colaborador de Nómina que todavía no tiene
// acceso a la app. Solo owner/superadmin del tenant (verificarTenantStaff, mismo patrón que el
// resto de rutas de admin). Permisos arrancan todos en false — el admin los activa desde la
// Matriz de Permisos justo después de crear el acceso, no se asume nada por defecto.
export async function POST(req: NextRequest) {
  try {
    const { tenantId, colaboradorId, email } = await req.json() as { tenantId: string; colaboradorId: string; email: string }
    if (!tenantId || !colaboradorId || !email) {
      return NextResponse.json({ error: 'Faltan datos (tenantId, colaboradorId, email)' }, { status: 400 })
    }

    const auth = await verificarTenantStaff(req, tenantId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const supabase = getSupabaseAdmin()

    const { data: colaborador, error: colErr } = await supabase.from('colaboradores')
      .select('id, nombres, apellidos, tenant_id').eq('id', colaboradorId).single()
    if (colErr || !colaborador) return NextResponse.json({ error: 'Colaborador no encontrado' }, { status: 404 })
    if (colaborador.tenant_id !== tenantId) return NextResponse.json({ error: 'El colaborador no pertenece a este tenant' }, { status: 403 })

    const { data: yaExiste } = await supabase.from('profiles').select('id').eq('colaborador_id', colaboradorId).maybeSingle()
    if (yaExiste) return NextResponse.json({ error: 'Este colaborador ya tiene acceso creado' }, { status: 400 })

    const passwordTemporal = generarPasswordTemporal()
    const nombreCompleto = `${colaborador.nombres} ${colaborador.apellidos}`.trim()

    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email, password: passwordTemporal, email_confirm: true,
    })
    if (authErr || !authUser?.user) return NextResponse.json({ error: `No se pudo crear el usuario: ${authErr?.message}` }, { status: 500 })

    // handle_new_user() ya insertó una fila mínima en profiles (rol:'owner', sin tenant) apenas
    // se creó el usuario en Auth — hay que hacer upsert, no insert, o choca con la llave primaria.
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: authUser.user.id, email, tenant_id: tenantId, rol: 'colaborador',
      nombre: nombreCompleto, colaborador_id: colaboradorId,
      permisos: matrizTodoFalse(), horario_acceso: 'todos', notificar_actividad_inusual: true, es_cortesia: false,
    }, { onConflict: 'id' })
    if (profileErr) return NextResponse.json({ error: `Usuario creado pero falló el perfil: ${profileErr.message}` }, { status: 500 })

    const correo = await enviarCorreoInvitacion({ email, nombre: nombreCompleto, passwordTemporal })

    return NextResponse.json({ ok: true, profileId: authUser.user.id, correoEnviado: correo.ok, avisoCorreo: correo.error })
  } catch (err) {
    console.error('Error creando acceso de colaborador:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
