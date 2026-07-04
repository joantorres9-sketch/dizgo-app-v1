import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ── CLIENTE SUPABASE CON SERVICE ROLE (permisos admin) ────────
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada en Vercel')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ── AUTENTICACIÓN DEL MCP ─────────────────────────────────────
function validarToken(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  const token = process.env.DIZGO_MCP_TOKEN
  if (!token) return false
  return auth === `Bearer ${token}`
}

// ── HERRAMIENTAS DISPONIBLES ──────────────────────────────────
type Herramienta = 'read_data' | 'write_data' | 'execute_sql' | 'update_file' | 'list_tables' | 'describe_table'

export async function POST(req: NextRequest) {
  try {
    // Validar autenticación
    if (!validarToken(req)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { herramienta, params } = await req.json() as { herramienta: Herramienta; params: Record<string, unknown> }

    // ── 1. READ DATA — leer datos de cualquier tabla ──────────
    if (herramienta === 'read_data') {
      const { tabla, filtros, limite, columnas } = params as {
        tabla: string; filtros?: Record<string, unknown>; limite?: number; columnas?: string
      }
      const supabase = getSupabaseAdmin()
      let query = supabase.from(tabla).select(columnas || '*')
      if (filtros) {
        for (const [col, val] of Object.entries(filtros)) {
          query = query.eq(col, val)
        }
      }
      if (limite) query = query.limit(limite)
      const { data, error, count } = await query
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, data, count, tabla })
    }

    // ── 2. WRITE DATA — insertar o actualizar datos ───────────
    if (herramienta === 'write_data') {
      const { tabla, operacion, datos, filtro_id } = params as {
        tabla: string; operacion: 'insert' | 'update' | 'upsert' | 'delete'
        datos?: Record<string, unknown> | Record<string, unknown>[]
        filtro_id?: string
      }
      const supabase = getSupabaseAdmin()
      let result

      if (operacion === 'insert') {
        result = await supabase.from(tabla).insert(datos as Record<string, unknown>[])
      } else if (operacion === 'update' && filtro_id) {
        result = await supabase.from(tabla).update(datos as Record<string, unknown>).eq('id', filtro_id)
      } else if (operacion === 'upsert') {
        result = await supabase.from(tabla).upsert(datos as Record<string, unknown>[])
      } else if (operacion === 'delete' && filtro_id) {
        result = await supabase.from(tabla).delete().eq('id', filtro_id)
      } else {
        return NextResponse.json({ error: 'Operación no válida o filtro_id requerido' }, { status: 400 })
      }

      if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 })
      return NextResponse.json({ ok: true, operacion, tabla, afectados: result.count || 1 })
    }

    // ── 3. EXECUTE SQL — SQL directo con service_role ─────────
    if (herramienta === 'execute_sql') {
      const { query } = params as { query: string }
      const supabase = getSupabaseAdmin()
      const { data, error } = await supabase.rpc('execute_raw_sql', { sql_query: query })
      if (error) {
        // Fallback: intentar como query directo si RPC no existe
        return NextResponse.json({
          error: error.message,
          hint: 'Para SQL directo, ejecuta en Supabase SQL Editor: ' + query.slice(0, 200)
        }, { status: 400 })
      }
      return NextResponse.json({ ok: true, data })
    }

    // ── 4. UPDATE FILE — actualizar archivo en GitHub ─────────
    if (herramienta === 'update_file') {
      const { ruta, contenido, mensaje_commit } = params as {
        ruta: string; contenido: string; mensaje_commit: string
      }
      const token = process.env.GITHUB_TOKEN
      const repo = process.env.GITHUB_REPO || 'joantorres9-sketch/dizgo-app-v1'
      if (!token) return NextResponse.json({ error: 'GITHUB_TOKEN no configurado' }, { status: 500 })

      // Obtener SHA del archivo actual
      const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${ruta}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' }
      })
      const getJson = await getRes.json() as { sha?: string; message?: string }
      const sha = getJson.sha

      // Actualizar el archivo
      const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${ruta}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: mensaje_commit || `fix: actualización via DIZGO MCP`,
          content: Buffer.from(contenido).toString('base64'),
          sha,
        }),
      })

      if (!putRes.ok) {
        const err = await putRes.json()
        return NextResponse.json({ error: JSON.stringify(err) }, { status: putRes.status })
      }

      return NextResponse.json({ ok: true, ruta, mensaje: `Archivo actualizado. Vercel desplegará en ~40s.` })
    }

    // ── 5. LIST TABLES — listar tablas disponibles ────────────
    if (herramienta === 'list_tables') {
      const supabase = getSupabaseAdmin()
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .order('table_name')
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, tablas: (data || []).map((r: {table_name: string}) => r.table_name) })
    }

    // ── 6. DESCRIBE TABLE — ver columnas de una tabla ─────────
    if (herramienta === 'describe_table') {
      const { tabla } = params as { tabla: string }
      const supabase = getSupabaseAdmin()
      const { data, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', tabla)
        .eq('table_schema', 'public')
        .order('ordinal_position')
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, tabla, columnas: data })
    }

    return NextResponse.json({ error: `Herramienta '${herramienta}' no reconocida` }, { status: 400 })

  } catch (err) {
    console.error('DIZGO MCP Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── GET — verificar que el MCP está activo ────────────────────
export async function GET(req: NextRequest) {
  if (!validarToken(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  return NextResponse.json({
    ok: true,
    nombre: 'DIZGO MCP Server',
    version: '1.0',
    herramientas: ['read_data', 'write_data', 'execute_sql', 'update_file', 'list_tables', 'describe_table'],
    timestamp: new Date().toISOString(),
  })
}
