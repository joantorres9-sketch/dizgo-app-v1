import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/apiAuth'

// Devuelve solo el código de país de un tenant — usado por la página pública de
// autorregistro de colaborador (/registro-colaborador/[tenantId]) para precargar el país
// correcto en vez de asumir Colombia. Sin autenticación a propósito: la página que la llama
// también es pública (el link de registro lo comparte la empresa con externos), y RLS de
// tenants (tenant_isolation_tenants: solo el propio tenant vía auth.uid()) bloquearía por
// completo un SELECT anónimo — no hay otra forma de leer esto desde el cliente sin login.
// No expone nada más sensible que el código de país.
export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  if (!tenantId) return NextResponse.json({ error: 'Falta tenantId' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('tenants').select('pais').eq('id', tenantId).single()
  if (error || !data) return NextResponse.json({ pais: null })

  return NextResponse.json({ pais: data.pais }, { headers: { 'Cache-Control': 'no-store' } })
}
