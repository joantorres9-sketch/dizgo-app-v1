import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/apiAuth'
import { paisPorCodigo } from '@/lib/paises'

const DIACRITICOS = new RegExp('[̀-ͯ]', 'g')

function slugBase(nombre: string): string {
  return nombre
    .normalize('NFD').replace(DIACRITICOS, '') // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tienda'
}

async function slugUnico(supabase: ReturnType<typeof getSupabaseAdmin>, nombre: string): Promise<string> {
  const base = slugBase(nombre)
  let candidato = base
  let intento = 1
  while (true) {
    const { data } = await supabase.from('tenants').select('id').eq('slug', candidato).maybeSingle()
    if (!data) return candidato
    intento += 1
    candidato = `${base}-${intento}`
  }
}

async function requiereSuperadmin(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { ok: false as const, error: 'No autenticado', status: 401 }
  const supabase = getSupabaseAdmin()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { ok: false as const, error: 'Sesión inválida', status: 401 }
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'superadmin') return { ok: false as const, error: 'Solo superadmin puede aprobar registros', status: 403 }
  return { ok: true as const, userId: user.id }
}

export async function POST(req: Request) {
  const auth = await requiereSuperadmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { solicitudId, accion } = await req.json()
  if (!solicitudId || !['aprobar', 'rechazar'].includes(accion)) {
    return NextResponse.json({ error: 'solicitudId y accion (aprobar|rechazar) son requeridos' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data: solicitud, error: solErr } = await supabase.from('solicitudes_registro').select('*').eq('id', solicitudId).single()
  if (solErr || !solicitud) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  if (solicitud.estado !== 'pendiente') return NextResponse.json({ error: `La solicitud ya está en estado "${solicitud.estado}"` }, { status: 400 })

  if (accion === 'rechazar') {
    await supabase.from('solicitudes_registro').update({
      estado: 'rechazado', aprobado_por: auth.userId, fecha_aprobacion: new Date().toISOString(),
    }).eq('id', solicitudId)
    return NextResponse.json({ ok: true })
  }

  // accion === 'aprobar'
  const esPago = solicitud.plan_elegido !== 'explorador'
  if (esPago && solicitud.pago_estado !== 'pagado') {
    return NextResponse.json({ error: 'No se puede aprobar un plan pago sin confirmar el pago primero' }, { status: 400 })
  }

  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers()
  if (authErr) return NextResponse.json({ error: `No se pudo ubicar el usuario: ${authErr.message}` }, { status: 500 })
  const authUser = authUsers.users.find(u => u.email === solicitud.email_personal)
  if (!authUser) return NextResponse.json({ error: 'No se encontró la cuenta de autenticación de esta solicitud' }, { status: 404 })

  const licenciaVence = esPago
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : null
  const slug = await slugUnico(supabase, solicitud.nombre_tienda)
  const moneda = paisPorCodigo(solicitud.pais_matriz)?.moneda || 'COP'

  const { data: tenant, error: tenantErr } = await supabase.from('tenants').insert({
    nombre: solicitud.nombre_tienda,
    slug,
    pais: solicitud.pais_matriz,
    moneda,
    plan: solicitud.plan_elegido,
    licencia: 'activa',
    licencia_vence: licenciaVence,
  }).select('id').single()
  if (tenantErr || !tenant) return NextResponse.json({ error: `Error creando el tenant: ${tenantErr?.message}` }, { status: 500 })

  const { error: profileErr } = await supabase.from('profiles').upsert({
    id: authUser.id,
    tenant_id: tenant.id,
    rol: 'owner',
    nombre: `${solicitud.nombres} ${solicitud.apellidos}`.trim(),
  }, { onConflict: 'id' })
  if (profileErr) return NextResponse.json({ error: `Tenant creado pero falló el perfil: ${profileErr.message}` }, { status: 500 })

  await supabase.from('solicitudes_registro').update({
    estado: 'aprobado', aprobado_por: auth.userId, fecha_aprobacion: new Date().toISOString(),
  }).eq('id', solicitudId)

  return NextResponse.json({ ok: true, tenantId: tenant.id })
}
