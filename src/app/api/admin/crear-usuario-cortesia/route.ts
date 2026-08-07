import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verificarSuperadmin } from '@/lib/apiAuth'
import { slugUnico } from '@/lib/tenantSlug'
import { sembrarTenantDemo, PASOS_SEED, CONFIG_PAIS } from '@/lib/seedDemoTenant'
import { enviarCorreoInvitacion, generarPasswordTemporal } from '@/lib/emailInvitacion'
import { matrizTodoTrue } from '@/lib/modulos'

// Crea un tenant de cortesía completo: tenant nuevo (plan:'cortesia') + datos demo pre-cargados
// (mismo sembrador que usa Superadmin → Seed de datos demo, reutilizado server-side) + login con
// acceso a todos los módulos y países + correo de bienvenida con guía rápida. Solo superadmin
// (este flujo crea tenants nuevos, es un privilegio a nivel de toda la plataforma DIZGO, distinto
// de crear-acceso-colaborador que un owner puede hacer solo dentro de su propio tenant).
export async function POST(req: NextRequest) {
  try {
    const auth = await verificarSuperadmin(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json() as {
      email: string; nombres?: string; apellidos?: string; tipo_doc?: string; numero_doc?: string
      celular?: string; nombre_tienda?: string; pais?: string
    }
    if (!body.email) return NextResponse.json({ error: 'El correo es obligatorio para crear el acceso' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const paisCodigo = body.pais && CONFIG_PAIS[body.pais] ? body.pais : 'COL'
    const cfgPais = CONFIG_PAIS[paisCodigo]
    const nombreCompleto = `${body.nombres || ''} ${body.apellidos || ''}`.trim() || body.email
    const nombreTenant = body.nombre_tienda?.trim() || `Cortesía — ${nombreCompleto}`

    const slug = await slugUnico(supabase, nombreTenant)
    const { data: tenant, error: tenantErr } = await supabase.from('tenants').insert({
      nombre: nombreTenant, slug, pais: paisCodigo, moneda: cfgPais.moneda, plan: 'cortesia', licencia: 'activa',
    }).select('id').single()
    if (tenantErr || !tenant) return NextResponse.json({ error: `Error creando el tenant: ${tenantErr?.message}` }, { status: 500 })

    await sembrarTenantDemo(supabase, tenant.id, paisCodigo)

    const passwordTemporal = generarPasswordTemporal()
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: body.email, password: passwordTemporal, email_confirm: true,
    })
    if (authErr || !authUser?.user) return NextResponse.json({ error: `Tenant creado pero falló el usuario: ${authErr?.message}`, tenantId: tenant.id }, { status: 500 })

    // handle_new_user() ya insertó una fila mínima en profiles (rol:'owner', sin tenant) apenas
    // se creó el usuario en Auth — hay que hacer upsert, no insert, o choca con la llave primaria.
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: authUser.user.id, email: body.email, tenant_id: tenant.id, rol: 'colaborador',
      nombre: nombreCompleto, es_cortesia: true, colaborador_id: null,
      permisos: matrizTodoTrue(), horario_acceso: 'todos', notificar_actividad_inusual: true,
    }, { onConflict: 'id' })
    if (profileErr) return NextResponse.json({ error: `Usuario creado pero falló el perfil: ${profileErr.message}`, tenantId: tenant.id }, { status: 500 })

    const guia = PASOS_SEED.slice(0, 8).map(p => `${p.label}: ${p.desc}`)
    const correo = await enviarCorreoInvitacion({ email: body.email, nombre: nombreCompleto, passwordTemporal, guia })

    return NextResponse.json({
      ok: true, tenantId: tenant.id, profileId: authUser.user.id, correoEnviado: correo.ok, avisoCorreo: correo.error,
      // Solo se expone si el correo falló, para que el superadmin pueda compartirla manualmente
      // en vez de quedar con una cuenta creada pero sin forma de entregar el acceso.
      passwordTemporal: correo.ok ? undefined : passwordTemporal,
    })
  } catch (err) {
    console.error('Error creando usuario de cortesía:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
