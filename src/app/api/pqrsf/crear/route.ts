import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/apiAuth'

const TIPO_INFO: Record<string, { label: string; dias: number }> = {
  P: { label: 'petición', dias: 15 },
  Q: { label: 'queja', dias: 10 },
  R: { label: 'reclamo', dias: 10 },
  S: { label: 'sugerencia', dias: 15 },
  F: { label: 'felicitación', dias: 15 },
}

// Autorregistro público de PQRSF — el cliente no tiene sesión, así que el insert se hace
// server-side con el service role (mismo patrón que solicitud-novedad de Nómina). numero_radicado
// lo genera el trigger de la base de datos; aquí no se manda para no duplicar esa lógica.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { slug, tipo, nombre_cliente, email_cliente, telefono, orden_id, asunto, descripcion } = body

    if (!slug || !tipo || !nombre_cliente || !asunto || !descripcion) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }
    if (!TIPO_INFO[tipo]) {
      return NextResponse.json({ error: 'Tipo de caso no válido' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants').select('id, activo').eq('slug', slug).single()
    if (tenantErr || !tenant || !tenant.activo) {
      return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
    }

    const dias = TIPO_INFO[tipo].dias
    const limite = new Date(Date.now() + dias * 24 * 60 * 60 * 1000)

    const { data: creado, error: insErr } = await supabase.from('pqrsf').insert({
      tenant_id: tenant.id, tipo, nombre_cliente,
      email_cliente: email_cliente || null, telefono: telefono || null,
      orden_id: orden_id || null, asunto, descripcion,
      estado: 'RECIBIDO', fecha_limite: limite.toISOString(),
    }).select('numero_radicado').single()

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    // Reclamo/Queja generan alerta inmediata al equipo, igual que al crearla desde el dashboard.
    if (['R', 'Q'].includes(tipo)) {
      await supabase.from('alertas').insert({
        tenant_id: tenant.id, tipo: 'atencion', categoria: 'operativa',
        titulo: `Nueva PQRSF: ${asunto}`,
        mensaje: `${nombre_cliente} radicó un(a) ${TIPO_INFO[tipo].label}. Hay ${dias} días hábiles para responder.`,
      })
    }

    return NextResponse.json({ ok: true, numero_radicado: creado?.numero_radicado })
  } catch (err) {
    console.error('Error creando PQRSF pública:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
