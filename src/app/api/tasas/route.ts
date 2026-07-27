import { NextResponse } from 'next/server'

const TTL_MS = 6 * 60 * 60 * 1000 // 6 horas — suficiente para precios públicos, evita golpear el proveedor externo en cada visita
let cache: { rates: Record<string, number>; actualizado: string; ts: number } | null = null

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' }

// Proxy con caché en memoria a una fuente de tasas de cambio en vivo (open.er-api.com, gratis,
// sin API key, base USD). Usado por el simulador/registro de esta app y por dizgo-home (CORS
// abierto a propósito: son solo tasas públicas, sin datos sensibles). Si el proveedor falla,
// devuelve la última caché conocida (marcada stale) en vez de romper la web.
export async function GET() {
  if (cache && Date.now() - cache.ts < TTL_MS) {
    return NextResponse.json({ rates: cache.rates, actualizado: cache.actualizado, cache: true }, { headers: CORS_HEADERS })
  }
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
    const data = await res.json()
    if (data?.result !== 'success' || !data?.rates) throw new Error('Respuesta inválida del proveedor de tasas')
    cache = { rates: data.rates, actualizado: data.time_last_update_utc, ts: Date.now() }
    return NextResponse.json({ rates: cache.rates, actualizado: cache.actualizado, cache: false }, { headers: CORS_HEADERS })
  } catch (err) {
    if (cache) return NextResponse.json({ rates: cache.rates, actualizado: cache.actualizado, cache: true, stale: true }, { headers: CORS_HEADERS })
    return NextResponse.json({ error: 'No se pudieron obtener tasas de cambio en vivo' }, { status: 502, headers: CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
