import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Verifica que el bearer token del request pertenezca a un usuario autenticado cuyo tenant_id
// coincide con el tenant sobre el que se pide actuar. Las rutas API de este proyecto no usan
// cookies de servidor (@supabase/ssr) — el cliente manda su access_token de sesión y aquí se
// valida contra Supabase Auth con el service role, igual de seguro sin esa dependencia extra.
export async function verificarTenantStaff(req: Request, tenantId: string): Promise<{ ok: true; userId: string } | { ok: false; error: string; status: number }> {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return { ok: false, error: 'No autenticado', status: 401 }

  const supabase = getSupabaseAdmin()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { ok: false, error: 'Sesión inválida', status: 401 }

  const { data: profile } = await supabase.from('profiles').select('tenant_id, rol').eq('id', user.id).single()
  if (!profile) return { ok: false, error: 'Perfil no encontrado', status: 403 }
  if (profile.tenant_id !== tenantId && profile.rol !== 'superadmin') {
    return { ok: false, error: 'No autorizado para este tenant', status: 403 }
  }
  return { ok: true, userId: user.id }
}
