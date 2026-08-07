import type { SupabaseClient } from '@supabase/supabase-js'

// Extraído de /api/admin/aprobar-registro para reutilizarlo también en la creación de
// tenants de cortesía (/api/admin/crear-usuario-cortesia).
const DIACRITICOS = new RegExp('[̀-ͯ]', 'g')

function slugBase(nombre: string): string {
  return nombre
    .normalize('NFD').replace(DIACRITICOS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tienda'
}

export async function slugUnico(supabase: SupabaseClient, nombre: string): Promise<string> {
  const base = slugBase(nombre)
  let candidato = base
  let intento = 1
  while (true) {
    const { data } = await supabase.from('tenants').select('id').eq('slug', candidato).maybeSingle()
    if (!data) return candidato
    intento += 1
    candidato = `${base}-${intento}`
  }
}
