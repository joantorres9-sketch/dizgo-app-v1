import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verificarSuperadmin } from '@/lib/apiAuth'
import { publicarEnPagina } from '@/lib/metaFacebook'

export async function POST(req: NextRequest) {
  const auth = await verificarSuperadmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { texto, imagenUrl } = await req.json()
  if (!texto) return NextResponse.json({ error: 'Falta el texto de la publicación' }, { status: 400 })

  const resultado = await publicarEnPagina(texto, imagenUrl || undefined)
  const supabase = getSupabaseAdmin()

  if (!resultado.ok) {
    await supabase.from('crm_publicaciones').insert({ texto, imagen_url: imagenUrl || null, estado: 'borrador' })
    return NextResponse.json({ error: resultado.error }, { status: 502 })
  }

  await supabase.from('crm_publicaciones').insert({
    texto, imagen_url: imagenUrl || null, fb_post_id: resultado.postId, estado: 'publicado', publicado_at: new Date().toISOString(),
  })
  return NextResponse.json({ ok: true, postId: resultado.postId })
}
