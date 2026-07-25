import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Endpoint público (URL con UUID no adivinable) para que el solicitante corrija su registro
// tras un "Solicitar ajustes" desde Superadmin — mismo patrón de seguridad por obscuridad ya
// usado en /api/nomina/colaborador-publico/[id] y /mis-solicitudes/[colaboradorId].
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('solicitudes_registro')
    .select('nombres, nombre_tienda, pais_matriz, notas_admin, estado, docs_urls')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  if (data.estado !== 'pendiente') return NextResponse.json({ error: `Esta solicitud ya está en estado "${data.estado}"` }, { status: 400 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabaseAdmin()

  const { data: solicitud, error: solErr } = await supabase.from('solicitudes_registro').select('estado, docs_urls').eq('id', id).single()
  if (solErr || !solicitud) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  if (solicitud.estado !== 'pendiente') return NextResponse.json({ error: `Esta solicitud ya está en estado "${solicitud.estado}"` }, { status: 400 })

  const form = await req.formData()
  const docsActuales = (solicitud.docs_urls as Record<string, string>) || {}
  const docsNuevos: Record<string, string> = { ...docsActuales }

  for (const key of ['id_a', 'id_b', 'doc_legal']) {
    const file = form.get(key) as File | null
    if (!file || file.size === 0) continue
    const path = `registro/${Date.now()}_${key}_${file.name}`
    const { error: upErr } = await supabase.storage.from('documentos-registro').upload(path, file, { contentType: file.type || 'application/pdf' })
    if (upErr) return NextResponse.json({ error: `Error subiendo ${key}: ${upErr.message}` }, { status: 500 })
    const { data: { publicUrl } } = supabase.storage.from('documentos-registro').getPublicUrl(path)
    docsNuevos[key] = publicUrl
  }

  const { error: updErr } = await supabase.from('solicitudes_registro').update({
    docs_urls: docsNuevos,
    notas_admin: null,
  }).eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
