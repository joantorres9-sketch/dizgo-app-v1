// Meta Marketing API — SOLO crea objetos en estado PAUSED. Ninguna función de este archivo
// puede dejar algo gastando dinero salvo activarCampana(), que se llama explícitamente y nunca
// en cadena automática con la creación. No cambiar ese comportamiento sin repensar los
// guardarraíles del plan original (ver C:\Users\JHOAN\.claude\plans\lexical-rolling-sloth.md).

const GRAPH_VERSION = 'v21.0'

type ResultadoMeta<T> = { ok: true; data: T } | { ok: false; error: string }

async function llamarGraph(path: string, params: Record<string, string>): Promise<ResultadoMeta<any>> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) return { ok: false, error: 'META_ACCESS_TOKEN no configurado' }
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, access_token: token }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: data?.error?.message || `Error ${res.status} en Meta Ads` }
  return { ok: true, data }
}

export async function crearCampanaBorrador(nombre: string, objetivo: string, presupuestoDiarioCop: number): Promise<ResultadoMeta<{ campaignId: string; adsetId: string; adId: string }>> {
  const adAccount = process.env.META_AD_ACCOUNT_ID
  const pageId = process.env.META_PAGE_ID
  if (!adAccount || !pageId) return { ok: false, error: 'META_AD_ACCOUNT_ID o META_PAGE_ID no configurados' }

  // 1. Campaña -- status PAUSED forzado, no viene del caller
  const campana = await llamarGraph(`${adAccount}/campaigns`, {
    name: nombre, objective: objetivo, status: 'PAUSED', special_ad_categories: '[]',
  })
  if (!campana.ok) return campana
  const campaignId = campana.data.id

  // 2. Ad Set -- status PAUSED forzado
  const adset = await llamarGraph(`${adAccount}/adsets`, {
    name: `${nombre} - Conjunto`, campaign_id: campaignId, status: 'PAUSED',
    daily_budget: String(Math.round(presupuestoDiarioCop)),
    billing_event: 'IMPRESSIONS', optimization_goal: 'LINK_CLICKS',
    targeting: JSON.stringify({ geo_locations: { countries: ['CO'] } }),
  })
  if (!adset.ok) return adset
  const adsetId = adset.data.id

  // 3. Creativo -- referencia la Página real
  const creativo = await llamarGraph(`${adAccount}/adcreatives`, {
    name: `${nombre} - Creativo`,
    object_story_spec: JSON.stringify({ page_id: pageId, link_data: { message: nombre, link: 'https://www.dizgo.app' } }),
  })
  if (!creativo.ok) return creativo

  // 4. Anuncio -- status PAUSED forzado
  const anuncio = await llamarGraph(`${adAccount}/ads`, {
    name: `${nombre} - Anuncio`, adset_id: adsetId, status: 'PAUSED',
    creative: JSON.stringify({ creative_id: creativo.data.id }),
  })
  if (!anuncio.ok) return anuncio

  return { ok: true, data: { campaignId, adsetId, adId: anuncio.data.id } }
}

// Única función que puede poner a gastar una campaña real. Se llama solo desde
// /api/crm/facebook/campana/activar, nunca automáticamente.
export async function activarCampana(metaCampaignId: string): Promise<ResultadoMeta<null>> {
  const r = await llamarGraph(metaCampaignId, { status: 'ACTIVE' })
  if (!r.ok) return r
  return { ok: true, data: null }
}

export async function obtenerRendimiento(metaCampaignId: string): Promise<ResultadoMeta<{ spend: string; impressions: string; clicks: string }>> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) return { ok: false, error: 'META_ACCESS_TOKEN no configurado' }
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${metaCampaignId}/insights?fields=spend,impressions,clicks&access_token=${token}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: data?.error?.message || `Error ${res.status} leyendo rendimiento` }
  const fila = data?.data?.[0] || { spend: '0', impressions: '0', clicks: '0' }
  return { ok: true, data: fila }
}
