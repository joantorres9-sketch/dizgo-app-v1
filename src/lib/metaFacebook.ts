// Publicación en la Página de Facebook "Dizgo Finanzas" — usa META_ACCESS_TOKEN (permisos de
// Página + Ads), distinto de META_WHATSAPP_TOKEN que solo tiene permisos de mensajería.

const GRAPH_VERSION = 'v21.0'

export async function publicarEnPagina(texto: string, imagenUrl?: string): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  const systemUserToken = process.env.META_ACCESS_TOKEN
  const pageId = process.env.META_PAGE_ID
  if (!systemUserToken || !pageId) {
    return { ok: false, error: 'META_ACCESS_TOKEN o META_PAGE_ID no configurados' }
  }

  // Publicar EN NOMBRE de la Página exige el token propio de la Página, no el del Usuario del
  // Sistema directamente -- se deriva pidiendo el access_token de la Página con el token del
  // sistema (funciona porque la Página está asignada al Usuario del Sistema).
  const pageTokenRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}?fields=access_token&access_token=${systemUserToken}`)
  const pageTokenData = await pageTokenRes.json().catch(() => ({}))
  const token = pageTokenData?.access_token
  if (!token) return { ok: false, error: pageTokenData?.error?.message || 'No se pudo obtener el token de la Página' }

  const endpoint = imagenUrl
    ? `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`
    : `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`
  const body: Record<string, string> = imagenUrl
    ? { url: imagenUrl, caption: texto, access_token: token }
    : { message: texto, access_token: token }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: data?.error?.message || `Error ${res.status} publicando en la Página` }
  return { ok: true, postId: data?.post_id || data?.id || '' }
}
