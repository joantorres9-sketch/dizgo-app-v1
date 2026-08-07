import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verificarTenantStaff } from '@/lib/apiAuth'

// Botón "Borrar datos de prueba" del propio usuario de cortesía — cualquier miembro del tenant
// puede dispararlo (verificarTenantStaff no exige rol owner, solo que pertenezca al tenant), pero
// solo aplica sobre tenants plan='cortesia' (guardia server-side, no se puede usar contra un
// tenant real por accidente ni manipulando el body). Usa service role porque `tenants` solo
// permite UPDATE a superadmin por RLS (tenant_isolation_tenants es de solo lectura).
const TABLAS_DEMO = [
  'pedidos', 'productos', 'costos_fijos', 'pauta', 'wallet_transacciones', 'libro_caja', 'metas',
  'bodegas', 'inventario', 'pqrsf', 'alertas', 'colaboradores', 'nomina_tasas_historico',
  'nomina_procesos', 'inversiones_activos', 'inversiones_creditos', 'inversiones_capital',
  'inversiones_socios', 'cuentas_por_pagar', 'metas_seguimiento_diario', 'pe_configuraciones',
  'whatsapp_store_context', 'whatsapp_templates_config',
]

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await req.json() as { tenantId: string }
    if (!tenantId) return NextResponse.json({ error: 'Falta tenantId' }, { status: 400 })

    const auth = await verificarTenantStaff(req, tenantId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const supabase = getSupabaseAdmin()
    const { data: tenant } = await supabase.from('tenants').select('plan').eq('id', tenantId).single()
    if (tenant?.plan !== 'cortesia') {
      return NextResponse.json({ error: 'Esta acción solo aplica a tenants de cortesía' }, { status: 400 })
    }

    await Promise.all(TABLAS_DEMO.map(tabla => supabase.from(tabla).delete().eq('tenant_id', tenantId)))
    await supabase.from('tenants').update({ plan: 'explorador' }).eq('id', tenantId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error borrando datos de prueba:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
