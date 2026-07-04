import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function validarToken(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  const token = process.env.DIZGO_MCP_TOKEN
  if (!token) return false
  return auth === `Bearer ${token}`
}

export async function POST(req: NextRequest) {
  try {
    if (!validarToken(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { herramienta, params } = await req.json()

    if (herramienta === 'read_data') {
      const { tabla, filtros, limite, columnas } = params
      const supabase = getSupabaseAdmin()
      let query = supabase.from(tabla).select(columnas || '*')
      if (filtros) for (const [col, val] of Object.entries(filtros)) query = query.eq(col, val as string)
      if (limite) query = query.limit(limite)
      const { data, error } = await query
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, data, tabla })
    }

    if (herramienta === 'write_data') {
      const { tabla, operacion, datos, filtro_id } = params
      const supabase = getSupabaseAdmin()
      let result
      if (operacion === 'insert') result = await supabase.from(tabla).insert(datos)
      else if (operacion === 'update' && filtro_id) result = await supabase.from(tabla).update(datos).eq('id', filtro_id)
      else if (operacion === 'upsert') result = await supabase.from(tabla).upsert(datos)
      else if (operacion === 'delete' && filtro_id) result = await supabase.from(tabla).delete().eq('id', filtro_id)
      else return NextResponse.json({ error: 'Operacion no valida' }, { status: 400 })
      if (result?.error) return NextResponse.json({ error: result.error.message }, { status: 400 })
      return NextResponse.json({ ok: true, operacion, tabla })
    }

    if (herramienta === 'update_file') {
      const { ruta, contenido, mensaje_commit } = params
      const token = process.env.GITHUB_TOKEN
      const repo = process.env.GITHUB_REPO || 'joantorres9-sketch/dizgo-app-v1'
      if (!token) return NextResponse.json({ error: 'GITHUB_TOKEN no configurado' }, { status: 500 })
      const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${ruta}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' }
      })
      const getJson = await getRes.json() as { sha?: string }
      const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${ruta}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: mensaje_commit || 'fix: update via DIZGO MCP', content: Buffer.from(contenido).toString('base64'), sha: getJson.sha }),
      })
      if (!putRes.ok) return NextResponse.json({ error: await putRes.text() }, { status: putRes.status })
      return NextResponse.json({ ok: true, ruta, mensaje: 'Archivo actualizado. Vercel desplegara en ~40s.' })
    }

    if (herramienta === 'describe_table') {
      const { tabla } = params
      const supabase = getSupabaseAdmin()
      const { data, error } = await supabase.from('information_schema.columns' as string).select('column_name, data_type, is_nullable').eq('table_name', tabla).eq('table_schema', 'public')
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, tabla, columnas: data })
    }

    return NextResponse.json({ error: `Herramienta no reconocida: ${herramienta}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  if (!validarToken(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  return NextResponse.json({ ok: true, nombre: 'DIZGO MCP Server', version: '1.0', herramientas: ['read_data', 'write_data', 'update_file', 'describe_table'] })
}
