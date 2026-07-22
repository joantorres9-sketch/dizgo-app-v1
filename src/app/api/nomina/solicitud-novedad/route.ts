import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Autorregistro de novedades (vacaciones/incapacidad/auxilio) sin cuenta de usuario. El
// colaborador no tiene sesión de Supabase, así que el insert se hace server-side con el
// service role (igual que el resto de esta fase evita abrir policies RLS públicas nuevas) tras
// validar que el colaborador_id es real y pertenece al tenant indicado.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const colaboradorId = String(form.get('colaboradorId') || '')
    const tipo = String(form.get('tipo') || '')
    const camposRaw = String(form.get('campos') || '{}')
    const fechaInicio = form.get('fecha_inicio') ? String(form.get('fecha_inicio')) : null
    const fechaFin = form.get('fecha_fin') ? String(form.get('fecha_fin')) : null
    const soporte = form.get('soporte') as File | null

    if (!colaboradorId || !tipo) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }
    if (!['vacaciones', 'incapacidad', 'auxilio'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de solicitud no permitido' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: col, error: colErr } = await supabase
      .from('colaboradores')
      .select('id, tenant_id, nombres, apellidos, activo')
      .eq('id', colaboradorId)
      .single()
    if (colErr || !col || !col.activo) {
      return NextResponse.json({ error: 'Colaborador no encontrado' }, { status: 404 })
    }

    let soporte_url: string | null = null
    if (soporte && soporte.size > 0) {
      if (soporte.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'El soporte supera el máximo de 5MB' }, { status: 400 })
      }
      const path = `nomina-novedades/${col.tenant_id}/${Date.now()}_${colaboradorId}_${soporte.name}`
      const { error: upErr } = await supabase.storage
        .from('documentos-nomina')
        .upload(path, soporte, { contentType: soporte.type || 'application/pdf' })
      if (upErr) return NextResponse.json({ error: `Error al subir el soporte: ${upErr.message}` }, { status: 500 })
      soporte_url = path
    }

    let campos: Record<string, unknown> = {}
    try { campos = JSON.parse(camposRaw) } catch { campos = {} }

    const { error: insErr } = await supabase.from('nomina_solicitudes').insert({
      tenant_id: col.tenant_id,
      tipo,
      colaborador_id: colaboradorId,
      nombres: col.nombres,
      apellidos: col.apellidos,
      estado: 'pendiente',
      docs_urls: soporte_url ? { soporte: soporte_url } : {},
      campos,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    })
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error en solicitud-novedad:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
