import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/apiAuth'

// Lookup público de solo lectura para el formulario de PQRSF sin sesión — expone únicamente el
// nombre de la tienda, nunca datos internos. Mismo patrón que colaborador-publico en Nómina.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!slug) return NextResponse.json({ error: 'Falta slug' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, nombre, activo')
    .eq('slug', slug)
    .single()

  if (error || !data || !data.activo) {
    return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
  }

  return NextResponse.json({ tenant_id: data.id, nombre: data.nombre })
}
