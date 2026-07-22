import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Endpoint público de solo lectura para el flujo de autorregistro de novedades
// (/mis-solicitudes/[colaboradorId]) — expone únicamente nombre/apellido, nunca salario,
// documentos ni datos bancarios. El colaborador no tiene cuenta de acceso al sistema, por eso
// esto se resuelve server-side con el service role en vez de abrir una policy RLS pública sobre
// toda la tabla `colaboradores`.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('colaboradores')
    .select('nombres, apellidos, activo, tenant_id')
    .eq('id', id)
    .single()

  if (error || !data || !data.activo) {
    return NextResponse.json({ error: 'Colaborador no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ nombres: data.nombres, apellidos: data.apellidos, tenant_id: data.tenant_id })
}
