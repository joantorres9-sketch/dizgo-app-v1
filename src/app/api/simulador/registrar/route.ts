import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/apiAuth'

// Registro de cada cálculo del simulador público como una "consulta" — construye la base de
// leads/conocimiento de uso descrita en el requerimiento del producto. No expone lectura pública
// (RLS solo permite insert), y esta ruta nunca devuelve el listado de leads a un cliente.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id, nombre, whatsapp, email, pais, moneda, nombre_producto,
      costo_proveedor, flete_envio, flete_devolucion, costo_admin_pedido,
      pct_devolucion, pct_cancelacion, pct_publicidad, pct_comisiones, pct_margen_deseado,
      costos_extra, porcentajes_extra,
      costos_totales, pvp_sugerido, contacto_solicitado,
    } = body

    const supabase = getSupabaseAdmin()

    if (id) {
      // Actualiza una consulta ya registrada cuando el usuario pide recibir el resultado (agrega contacto)
      const { error } = await supabase.from('simulador_leads')
        .update({ nombre, whatsapp, email, contacto_solicitado: true })
        .eq('id', id)
      if (error) throw error
      return NextResponse.json({ ok: true, id })
    }

    const { data, error } = await supabase.from('simulador_leads').insert({
      nombre: nombre || null,
      whatsapp: whatsapp || null,
      email: email || null,
      pais, moneda, nombre_producto,
      costo_proveedor, flete_envio, flete_devolucion, costo_admin_pedido,
      pct_devolucion, pct_cancelacion, pct_publicidad, pct_comisiones, pct_margen_deseado,
      costos_extra: costos_extra || [], porcentajes_extra: porcentajes_extra || [],
      costos_totales, pvp_sugerido,
      contacto_solicitado: !!contacto_solicitado,
    }).select('id').single()
    if (error) throw error

    return NextResponse.json({ ok: true, id: data.id })
  } catch (err) {
    console.error('Error registrando cálculo del simulador:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
